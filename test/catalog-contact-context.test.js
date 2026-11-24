import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync('_site/'+path,'utf8');
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const attr=(tag,name)=>decode(tag.match(new RegExp('\\b'+name+'="([^"]*)"'))?.[1]||'');

test('trocar o banner não muda a intenção dos botões de atendimento geral',()=>{
 const element=()=>({events:{},setAttribute(){},addEventListener(name,fn){this.events[name]=fn;}});
 const contacts=['Atendimento geral GOULLART','Falar com a equipe GOULLART'].map(message=>({
  ...element(),dataset:{contact:message},href:'https://wa.me/5562999427276?text='+encodeURIComponent(message),
 }));
 const messages=['Tenho interesse na escavadeira GOUL-TESTE-1','Tenho interesse no gerador GOUL-TESTE-2'];
 const links=messages.map(message=>({href:'https://wa.me/5562999427276?text='+encodeURIComponent(message)}));
 const slides=links.map(link=>({hidden:false,inert:false,querySelector:selector=>selector==='a[data-machine-whatsapp]'?link:{loading:'lazy'}}));
 const controls=Object.fromEntries(['data-banner-pause','data-banner-next','data-banner-prev','data-banner-position'].map(key=>['['+key+']',element()]));
 const root={...element(),dataset:{bannerInterval:'2000'},matches:()=>false,
  querySelectorAll:selector=>selector==='[data-slide]'?slides:[],querySelector:selector=>controls[selector]||null};
 const events={},context={location:new URL('https://example.com/'),setTimeout(){return 1;},clearTimeout(){},
  matchMedia:()=>({matches:false,addEventListener(){}}),
  addEventListener(name,fn){events[name]=fn;},
  document:{hidden:false,getElementById:id=>id==='approved-banner'?root:null,
   querySelector:()=>null,querySelectorAll:()=>contacts,addEventListener(name,fn){events[name]=fn;}},
 };
 context.window=context;vm.createContext(context);
 const expected=contacts.map(contact=>contact.href);
 vm.runInContext(readFileSync('espelho/approved-layout.js','utf8'),context);
 assert.deepEqual(contacts.map(contact=>contact.href),expected);
 controls['[data-banner-next]'].onclick();
 assert.equal(slides[0].hidden,true);
 assert.equal(slides[1].hidden,false);
 for(const contact of contacts)for(const event of ['focus','click','contextmenu'])contact.events[event]?.();
 for(const event of ['popstate','hashchange','goullart:catalogupdate'])events[event]?.();
 assert.deepEqual(contacts.map(contact=>contact.href),expected);
 assert.deepEqual(links.map(link=>new URL(link.href).searchParams.get('text')),messages);
});

test('o atendimento geral preserva sua mensagem na home e em todas as categorias',()=>{
 const categories=readdirSync('espelho/maquinas').filter(file=>file.endsWith('.html')).map(file=>'maquinas/'+file.slice(0,-5)+'/index.html');
 for(const path of ['index.html','maquinas.html','ofertas/index.html',...categories]){
  const html=read(path);
  const tags=[...html.matchAll(/<a\b[^>]*class="[^"]*\b(?:header-contact|dock-whatsapp)\b[^"]*"[^>]*>/g)].map(match=>match[0]);
  assert.ok(tags.length>0,path);
  for(const tag of tags){
   const url=new URL(attr(tag,'href'));
   const message=url.searchParams.get('text');
   assert.equal(url.hostname,'wa.me',path);
   assert.equal(url.pathname,'/5562999427276',path);
   assert.ok(attr(tag,'data-contact'),path);
   assert.equal(message,attr(tag,'data-contact'),path+' deve usar a própria mensagem geral, sem herdar a máquina do banner.');
   assert.doesNotMatch(message,/GOUL-|RADAR-|HYUNDAI|ESCAVADEIRA/i,path);
  }
 }
});

test('contatos dos anúncios continuam ligados ao código de cada equipamento',()=>{
 for(const category of ['caminhoes','geradores','outros-equipamentos']){
  const html=read('maquinas/'+category+'/index.html');
  const articles=[...html.matchAll(/<article id="anuncio-([^"]+)"[\s\S]*?<\/article>/g)];
  assert.ok(articles.length>0,category);
  for(const article of articles){
   const tag=article[0].match(/<a\b[^>]*class="catalog-page-contact"[^>]*>/)?.[0];
   assert.ok(tag,article[1]);
   const url=new URL(attr(tag,'href'));
   assert.equal(url.hostname,'wa.me',article[1]);
   assert.equal(url.pathname,'/5562999427276',article[1]);
   assert.ok(url.searchParams.get('text').includes(article[1]),article[1]);
  }
 }
 const home=read('index.html');
 const contacts=[...home.matchAll(/data-machine-whatsapp href="([^"]+)"/g)];
 assert.ok(contacts.length>0);
 for(const [,href] of contacts){
  const url=new URL(decode(href));
  assert.equal(url.pathname,'/5562999427276');
  assert.match(url.searchParams.get('text'),/\b(?:GOUL|H|RADAR|ROB)-[A-Z0-9-]+\b/);
 }
});
