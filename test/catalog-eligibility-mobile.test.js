import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {mkdtemp, mkdir, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {prepareCatalogue} from '../scripts/build-catalog-pages.mjs';

const now=Date.parse('2026-10-31T15:00:00Z');
const source=name=>readFileSync(new URL('../espelho/'+name,import.meta.url),'utf8');
const machine=(id,extra={})=>({id,publicCode:id,title:'Escavadeira '+id,category:'maquinas',price:100000,image:'/original.jpg',publishedAt:'2026-10-31',...extra});
const inventory=[
 machine('RECENT'),
 machine('OWNER',{publishedAt:'2025-01-01',retentionPolicy:'owner_confirmation'}),
 machine('NO-PHOTO',{image:''}),
 machine('BLANK-PHOTO',{image:'  '}),
 machine('EXPIRED',{publishedAt:'2026-09-01'}),
 machine('UNDATED',{publishedAt:''}),
 machine('INVALID-DATE',{publishedAt:'2026-02-30'}),
 machine('FUTURE',{publishedAt:'2026-11-01'}),
 machine('OTHER-TYPE',{title:'Caminhão pipa'}),
 machine('EMPTY-TYPE',{title:'Pá carregadeira',image:''})
];
class FixedDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}

async function client(items,{type='escavadeira',offers=false,fail=false}={}){
 const nodes=Object.fromEntries(['catalog-page-list','catalog-page-count','catalog-page-categories','catalog-page-sort','page-order'].map(id=>[id,{dataset:{},innerHTML:'',value:'low',addEventListener(){}}]));
 const root={dataset:{catalogType:type,catalogOffers:String(offers)}};
 const context={URL,URLSearchParams,Date:FixedDate,location:new URL('https://example.com/maquinas/escavadeira'),history:{replaceState(){}},setInterval(){},CustomEvent:class{},document:{hidden:false,querySelector:()=>root,getElementById:id=>nodes[id],addEventListener(){},dispatchEvent(){}},fetch:async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>({items})};}};
 context.window=context;context.GoullartRuntime={timeout(){}};vm.createContext(context);
 for(const file of ['listing-policy.js','catalog-types.js','catalog-data.js','catalog-page-client.js'])vm.runInContext(source(file),context);
 await new Promise(resolve=>setImmediate(resolve));
 return nodes;
}

test('live category cards and counts use the homepage eligibility policy',async()=>{
 const before=JSON.stringify(inventory),nodes=await client(inventory),cards=nodes['catalog-page-list'].innerHTML,nav=nodes['catalog-page-categories'].innerHTML;
 assert.equal(nodes['catalog-page-count'].textContent,'2 anúncios encontrados');
 for(const id of ['RECENT','OWNER'])assert.ok(cards.includes(id),id);
 for(const item of inventory.filter(i=>!['RECENT','OWNER'].includes(i.id)))assert.ok(!cards.includes(item.id),item.id);
 assert.match(nav,/Escavadeira<\/span><strong>2<\/strong>/);
 assert.match(nav,/Caminhão Pipa<\/span><strong>1<\/strong>/);
 assert.doesNotMatch(nav,/Pá Carregadeira/);
 assert.match(cards,/src="\/original.jpg"/);assert.match(cards,/https:\/\/wa.me\/5562999427276\?text=/);
 assert.equal(JSON.stringify(inventory),before);
});

test('live offers require eligibility as well as a verified matching discount',async()=>{
 const offer={verified:true,price:100000,discountPercent:20};
 const nodes=await client([machine('VALID-OFFER',{offer}),machine('NO-PHOTO',{image:'',offer}),machine('OLD-OFFER',{publishedAt:'2025-01-01',offer}),machine('UNVERIFIED',{offer:{...offer,verified:false}}),machine('CHANGED-PRICE',{offer:{...offer,price:90000}})],{type:'',offers:true});
 assert.equal(nodes['catalog-page-count'].textContent,'1 anúncio encontrado');
 assert.match(nodes['catalog-page-list'].innerHTML,/VALID-OFFER/);
 assert.doesNotMatch(nodes['catalog-page-list'].innerHTML,/NO-PHOTO|OLD-OFFER|UNVERIFIED|CHANGED-PRICE/);
});

test('an ineligible category is empty; a network failure retains the static snapshot',async()=>{
 const empty=await client([machine('NO-PHOTO',{image:''})]);
 assert.equal(empty['catalog-page-count'].textContent,'0 anúncios encontrados');
 assert.match(empty['catalog-page-list'].innerHTML,/No momento sem unidades/);
 assert.equal(empty['catalog-page-categories'].innerHTML,'');
 const offline=await client(inventory,{fail:true});
 assert.equal(offline['catalog-page-list'].dataset.rendered,undefined);
});

test('static category and offer snapshots filter eligibility without deleting source listings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'goullart-eligibility-'));
 try{
  await mkdir(join(dir,'api'));await mkdir(join(dir,'maquinas'));
  const items=inventory.map(i=>({...i,offer:{verified:true,price:i.price,discountPercent:20}}));
  await writeFile(join(dir,'api/catalog.json'),JSON.stringify({items}));
  const html='<nav><div id="catalog-page-categories"></div></nav><p id="catalog-page-count"></p><section id="catalog-page-list"></section>';
  for(const file of ['index.html','ofertas.html','maquinas/escavadeira.html','maquinas/pa-carregadeira.html'])await writeFile(join(dir,file),html);
  await prepareCatalogue(dir,now);
  const category=await readFile(join(dir,'maquinas/escavadeira.html'),'utf8');
  assert.match(category,/2 anúncios encontrados/);assert.match(category,/RECENT/);assert.match(category,/OWNER/);
  assert.doesNotMatch(category,/NO-PHOTO|BLANK-PHOTO|EXPIRED|UNDATED|INVALID-DATE|FUTURE|OTHER-TYPE|EMPTY-TYPE/);
  const offers=await readFile(join(dir,'ofertas.html'),'utf8');assert.match(offers,/3 anúncios encontrados/);assert.doesNotMatch(offers,/NO-PHOTO|EXPIRED|FUTURE/);
  assert.match(await readFile(join(dir,'maquinas/pa-carregadeira.html'),'utf8'),/No momento sem unidades/);
  const saved=JSON.parse(await readFile(join(dir,'api/catalog.json'),'utf8')).items;
  assert.equal(saved.length,items.length);
  assert.deepEqual(saved.map(i=>[i.id,i.image,i.price]),items.map(i=>[i.id,i.image,i.price]));
 }finally{await rm(dir,{recursive:true,force:true});}
});

const dockHtml=()=>source('index.html').match(/<nav class="mobile-dock"[^>]*>([\s\S]*?)<\/nav>/)[1];
test('the mobile home shortcut clears every area, item, type and hash before scripts run',()=>{
 const href=dockHtml().match(/<a href="([^"]+)"[^>]*>[\s\S]*?<span>Início<\/span>/)[1];
 for(const area of ['pecas','maquinas','locacao','implementos','magazine']){
  const destination=new URL(href,'https://example.com/?area='+area+'&item=GOUL-404&tipo=escavadeira#pecas');
  assert.equal(destination.href,'https://example.com/');
 }
});

test('the mobile dock still marks home current and removes that mark on area pages',()=>{
 const homeHref=dockHtml().match(/<a href="([^"]+)"/)[1];
 const links=[homeHref,'#maquinas','#pecas','#locacao'].map(href=>({hash:new URL(href,'https://example.com/').hash,attrs:{href},getAttribute(key){return this.attrs[key];},setAttribute(key,value){this.attrs[key]=value;},removeAttribute(key){delete this.attrs[key];}}));
 for(const areaPage of [false,true]){
  const context={URLSearchParams,location:{search:areaPage?'?area=pecas':'',hash:''},document:{querySelector:s=>s==='.mobile-dock'?{querySelectorAll:()=>links}:null,getElementById:id=>['maquinas','canal'].includes(id)?{getBoundingClientRect:()=>({top:1000})}:null,body:{classList:{contains:()=>areaPage}},addEventListener(){}},scrollY:0,addEventListener(){}};
  context.window=context;vm.createContext(context);vm.runInContext(source('mobile-navigation.js'),context);
  assert.equal(links[0].attrs['aria-current'],areaPage?undefined:'location');
  assert.equal(links[2].attrs['aria-current'],areaPage?'location':undefined);
 }
});

test('the production build loads the shared policy before every category client',async()=>{
 execFileSync(process.execPath,['scripts/preparar-espelho.mjs'],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
 const pages=['ofertas.html',...(await readdir('site-novo/maquinas')).filter(n=>n.endsWith('.html')).map(n=>'maquinas/'+n)];
 for(const page of pages){
  for(const filename of [page,page.replace(/\.html$/,'/index.html')]){
   const html=await readFile('site-novo/'+filename,'utf8');
   const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
   const policy=scripts.findIndex(s=>s.startsWith('/listing-policy.js'));
   const client=scripts.findIndex(s=>s.startsWith('/catalog-page-client.js'));
   assert.ok(policy>=0&&policy<client,filename);
   assert.match(scripts[client],/v=elegibilidade-inicio-20261031/);
   // Resolve como o navegador: o base também afeta links de fragmento.
   for (const path of filename.endsWith('/index.html') ? [filename, filename.replace(/index\.html$/, ''), filename.replace(/\/index\.html$/, '')] : [filename]) {
    const documentURL = new URL('/' + path, 'https://example.com');
    const baseHref = html.match(/<base\b[^>]*href="([^"]+)"/)?.[1];
    const base = baseHref ? new URL(baseHref, documentURL) : documentURL;
    const href = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>Ir para os anúncios<\/a>/)?.[1];
    assert.ok(href, filename);
    const resolved = new URL(href, base);
    assert.equal(resolved.pathname, '/' + (filename.endsWith('/index.html') ? filename.replace(/index\.html$/, '') : filename), path);
    assert.equal(resolved.hash, '#catalog-page-list');
    assert.match(html, /<section id="catalog-page-list"/);
   }
  }
 }
});
