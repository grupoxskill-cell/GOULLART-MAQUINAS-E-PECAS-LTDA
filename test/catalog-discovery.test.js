import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL('../espelho/'+name,import.meta.url),'utf8');
const machine=(id,title,extra={})=>({id,publicCode:id,title,category:'maquinas',image:'/foto.jpg',
 images:['/foto.jpg'],publishedAt:'2026-11-23',retentionPolicy:'owner_confirmation',price:null,...extra});
const inventory=[
 machine('GOUL-HY-2020-12000','Escavadeira Hyundai R220',{location:'São Luís de Montes Belos/GO'}),
 machine('CAVALO-1','Cavalo mecânico Mercedes-Benz 2035'),
 machine('CONJUNTO-1','Conjunto de caminhões VW 26260 + Ford Cargo'),
];
class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-11-23T18:00:00Z']));}static now(){return Date.parse('2026-11-23T18:00:00Z');}}
function element(){
 const listeners={};
 return {value:'',dataset:{contact:'Consultar anúncio'},hidden:false,innerHTML:'',textContent:'',attrs:{},
  addEventListener(name,fn){(listeners[name]||=[]).push(fn);},
  fire(name,extra={}){const event={preventDefault(){this.defaultPrevented=true;},...extra};this['on'+name]?.(event);for(const fn of listeners[name]||[])fn(event);return event;},
  setAttribute(name,value){this.attrs[name]=value;},getAttribute(name){return this.attrs[name]??null;},removeAttribute(name){delete this.attrs[name];},
  scrollIntoView(){this.scrolled=true;},focus(){this.focused=true;},blur(){this.blurred=true;},
 };
}
async function storefront(href,items=inventory){
 let current=new URL(href);
 const assigned=[],events=[],windowEvents={};
 const nodes=new Map(['search','catalog-discovery','catalog-reset','catalog-results','products','empty','sort',
  'count','more','catalog-title','catalog-select-label','quote','quote-handoff','search-button'].map(id=>['#'+id,element()]));
 nodes.set('#empty h3',element());nodes.set('#empty [data-contact]',element());nodes.get('#sort').value='recent';
 const location={get href(){return current.href;},get origin(){return current.origin;},get hash(){return current.hash;},get search(){return current.search;},
  assign(value){assigned.push(new URL(value,current).href);},replace(value){current=new URL(value,current);},reload(){}};
 const context={Date:Clock,Intl,URL,URLSearchParams,location,setInterval(){},
  history:{replaceState(_,__,value){current=new URL(value,current);},pushState(_,__,value){current=new URL(value,current);}},
  CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},
  addEventListener(name,fn){windowEvents[name]=fn;},
  document:{readyState:'complete',hidden:false,querySelector:selector=>nodes.get(selector)||null,querySelectorAll:()=>[],getElementById:id=>nodes.get('#'+id)||null,
   addEventListener(){},dispatchEvent(event){events.push(event);}},
  fetch:async()=>({ok:true,json:async()=>({items})}),
 };
 context.window=context;context.GoullartRuntime={timeout(){}};context.GoullartPartsFamilies=[];context.GoullartPartsOrder={title:t=>t};
 vm.createContext(context);
 for(const file of ['listing-policy.js','catalog-types.js','catalog-data.js','catalog-routes.js','app.js'])vm.runInContext(source(file),context);
 await context.GoullartFeed;await new Promise(setImmediate);
 return {context,nodes,assigned,events,windowEvents,url:()=>current};
}

test('home tem um único formulário acessível de busca separado do painel oculto',()=>{
 const html=source('index.html'),form=html.match(/<form\b[^>]*id="catalog-discovery"[^>]*>[\s\S]*?<\/form>/)?.[0];
 assert.ok(form);assert.equal((html.match(/\bid="search"/g)||[]).length,1);
 assert.equal((html.match(/\bid="catalog-reset"/g)||[]).length,1);
 assert.match(form,/role="search"/);assert.match(form,/<label for="search">/);
 assert.match(form,/name="q" type="search"/);assert.match(form,/action="\/" method="get"/);
 assert.doesNotMatch(form,/\bsearch-area\b|<h1\b/);
 assert.ok(html.indexOf(form)<html.indexOf('id="maquinas"'));
});

test('a home destaca o laudo antes do carrossel e mantém os anúncios antes das categorias, curso e depoimentos',()=>{
 const html=source('index.html');
 const banner=html.indexOf('<section class="approved-banner"');
 const search=html.indexOf('<form class="catalog-discovery"');
 const catalog=html.indexOf('<section class="catalog" id="catalog-results"');
 const products=html.indexOf('<div id="products"');
 assert.ok(banner>=0&&banner<search&&search<catalog&&catalog<products);
 const report=html.indexOf('<aside class="technical-report-banner"');
 assert.ok(html.indexOf('<main id="inicio">')<report&&report<banner,'O laudo fica no topo do conteúdo, acima do banner.');
 for(const marker of ['data-testimonials="catalogo"',
  '<a class="home-course-highlight"','<section class="machine-categories"']){
  assert.ok(html.indexOf(marker)>products,marker+' deve vir depois dos anúncios reais.');
 }
 assert.ok(html.indexOf('<header>')<banner,'O cabeçalho continua antes do carrossel.');
 for(const id of ['approved-banner','catalog-discovery','catalog-results','products','sort','more','empty']){
  assert.equal((html.match(new RegExp('\\bid="'+id+'"','g'))||[]).length,1,id);
 }
 const catalogMarkup=html.match(/<section class="catalog" id="catalog-results">([\s\S]*?)<\/section>/)[1];
 assert.doesNotMatch(catalogMarkup,/data-testimonials/,'Depoimentos não interrompem os anúncios.');
});

test('o script de áreas insere os blocos depois do catálogo sem mover a grade ou o carrossel',()=>{
 const order=[];
 const item=id=>({id,after(node){order.splice(order.indexOf(this)+1,0,node);}});
 const banner=item('banner'),form=item('search'),catalog=item('catalog'),report=item('report'),reviews=item('reviews');
 order.push(banner,form,catalog,report,reviews);
 const main={prepend(node){order.unshift(node);}};
 const context={URLSearchParams,location:new URL('https://example.com/'),window:{GoullartRoutes:{resolve:()=>({area:''})}},
  document:{querySelector:s=>s==='main'?main:null,querySelectorAll:()=>[],
   getElementById:id=>id==='approved-banner'?banner:id==='catalog-results'?catalog:null,
   createElement:()=>({setAttribute(){},insertAdjacentHTML(){}})}};
 vm.createContext(context);vm.runInContext(source('area-pages.js'),context);
 const hub=order.find(node=>node.className==='business-cards');
 assert.ok(hub);assert.deepEqual(order,[banner,form,catalog,hub,report,reviews]);
 assert.match(hub.innerHTML,/MAGAZINE/);assert.match(hub.innerHTML,/PEÇAS/);assert.match(hub.innerHTML,/VENDAS DE MÁQUINAS/);
});

test('a home exibe todas as máquinas e caminhões elegíveis; páginas filtradas mantêm Ver mais',async()=>{
 const eligible=[...Array.from({length:14},(_,i)=>machine('ESC-'+i,'Escavadeira '+i)),
  machine('CAMINHAO-FINAL','Caminhão basculante'),machine('CAVALO-FINAL','Cavalo mecânico')];
 const items=[...eligible,machine('PRIVATE','Escavadeira privada',{privateOnly:true}),
  machine('SOLD','Escavadeira vendida',{situacao:'Vendida'}),machine('PART','Peça',{category:'pecas'})];
 const home=await storefront('https://example.com/',items);
 const cards=home.nodes.get('#products').innerHTML;
 assert.equal(home.nodes.get('#count').textContent,'16 anúncios encontrados');
 for(const item of eligible)assert.ok(cards.includes('id="item-'+item.id+'"'),item.id);
 assert.doesNotMatch(cards,/id="item-(PRIVATE|SOLD|PART)"/);
 assert.equal(home.nodes.get('#more').hidden,true);
 assert.match(cards,/loading="lazy"/);
 const area=await storefront('https://example.com/?area=maquinas',items);
 assert.equal((area.nodes.get('#products').innerHTML.match(/<article\b/g)||[]).length,12);
 assert.equal(area.nodes.get('#more').hidden,false);
 area.nodes.get('#more').fire('click');
 assert.equal((area.nodes.get('#products').innerHTML.match(/<article\b/g)||[]).length,16);
 assert.equal(area.nodes.get('#more').hidden,true);
});

test('links legados por hash mantêm a paginação antes da normalização da área',async()=>{
 const items=Array.from({length:16},(_,i)=>machine('ESC-'+i,'Escavadeira '+i));
 for(const hash of ['maquinas','tipo-escavadeira']){
  const area=await storefront('https://example.com/#'+hash,items);
  assert.equal((area.nodes.get('#products').innerHTML.match(/<article\b/g)||[]).length,12,hash);
  assert.equal(area.nodes.get('#more').hidden,false,hash);
  area.nodes.get('#more').fire('click');
  assert.equal((area.nodes.get('#products').innerHTML.match(/<article\b/g)||[]).length,16,hash);
  assert.equal(area.nodes.get('#more').hidden,true,hash);
 }
});

test('buscar na home abre a área de máquinas com a consulta compartilhável',async()=>{
 const app=await storefront('https://example.com/'),input=app.nodes.get('#search');
 input.value='Hyundai 220 São Luís';input.fire('input');
 assert.deepEqual(app.assigned,[]);assert.equal(app.nodes.get('#catalog-reset').hidden,false);
 const event=app.nodes.get('#catalog-discovery').fire('submit');
 assert.equal(event.defaultPrevented,true);assert.equal(app.assigned.length,1);
 const destination=new URL(app.assigned[0]);
 assert.equal(destination.pathname,'/');assert.equal(destination.searchParams.get('area'),'maquinas');
 assert.equal(destination.searchParams.get('q'),'Hyundai 220 São Luís');
 const results=await storefront(destination.href);
 assert.equal(results.nodes.get('#count').textContent,'1 anúncio encontrado');
 assert.equal(results.nodes.get('#catalog-results').scrolled,true,'A busca da home deve levar aos resultados.');
});

test('links de busca encontram marca, código e cidade sem acentos preenchida só em location',async()=>{
 for(const query of ['HYUNDAI R220','goul-hy-2020-12000','sao luis de montes belos']){
  const app=await storefront('https://example.com/?area=maquinas&q='+encodeURIComponent(query));
  assert.equal(app.nodes.get('#search').value,query);
  assert.equal(app.nodes.get('#count').textContent,'1 anúncio encontrado',query);
  assert.match(app.nodes.get('#products').innerHTML,/id="item-GOUL-HY-2020-12000"/);
  assert.equal(app.nodes.get('#catalog-reset').hidden,false);
 }
});

test('caminhão e caminhões encontram também cavalos mecânicos e conjuntos',async()=>{
 for(const query of ['caminhão','caminhoes']){
  const app=await storefront('https://example.com/?area=maquinas&q='+encodeURIComponent(query));
  const cards=app.nodes.get('#products').innerHTML;
  assert.equal(app.nodes.get('#count').textContent,'2 anúncios encontrados');
  assert.match(cards,/item-CAVALO-1/);assert.match(cards,/item-CONJUNTO-1/);
  assert.doesNotMatch(cards,/item-GOUL-HY-2020-12000/);
 }
});

test('digitar e limpar removem o anúncio e o tipo anteriores do estado e da URL',async()=>{
 const app=await storefront('https://example.com/?area=maquinas&tipo=escavadeira&item=GOUL-HY-2020-12000');
 assert.equal(app.nodes.get('#count').textContent,'1 anúncio encontrado');
 assert.equal(app.nodes.get('#catalog-reset').hidden,false);
 const input=app.nodes.get('#search');input.value='caminhão';input.fire('input');
 assert.equal(app.nodes.get('#count').textContent,'2 anúncios encontrados');
 assert.equal(app.url().searchParams.get('q'),'caminhão');
 for(const param of ['item','tipo'])assert.equal(app.url().searchParams.has(param),false);
 assert.equal(app.events.at(-1).detail.type,'');
 input.fire('keydown',{key:'Enter'});
 assert.equal(app.nodes.get('#catalog-results').scrolled,true);assert.equal(input.blurred,true);
 app.nodes.get('#catalog-reset').fire('click');
 assert.equal(input.value,'');assert.equal(app.nodes.get('#count').textContent,'3 anúncios encontrados');
 for(const param of ['q','item','tipo'])assert.equal(app.url().searchParams.has(param),false);
 assert.equal(app.nodes.get('#catalog-reset').hidden,true);assert.equal(input.focused,true);
});

test('limpar uma oferta remove a restrição anterior e mostra o catálogo normal',async()=>{
 const app=await storefront('https://example.com/?area=ofertas&q=Hyundai');
 assert.equal(app.nodes.get('#count').textContent,'0 anúncios encontrados');
 app.nodes.get('#catalog-reset').fire('click');
 assert.equal(app.url().searchParams.get('area'),'maquinas');
 assert.equal(app.nodes.get('#count').textContent,'3 anúncios encontrados');
 assert.equal(app.events.at(-1).detail.offers,false);
});

test('a busca preserva o escape dos anúncios e não insere a consulta como HTML',async()=>{
 const app=await storefront('https://example.com/?area=maquinas',[machine('UNSAFE','Escavadeira <img src=x onerror=alert(1)>')]);
 assert.match(app.nodes.get('#products').innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(app.nodes.get('#products').innerHTML,/<img src=x onerror=/);
 const input=app.nodes.get('#search');input.value='"><svg onload=alert(2)>';input.fire('input');
 assert.equal(app.url().searchParams.get('q'),input.value);
 assert.equal(app.nodes.get('#count').textContent,'0 anúncios encontrados');
 assert.doesNotMatch(app.nodes.get('#products').innerHTML,/<svg|alert\(2\)/);
});

test('a área move o mesmo formulário para antes das categorias e resultados sem duplicar o campo',()=>{
 const events={};
 function node(tag){
  const result={...element(),tag,children:[],className:'',parent:null};
  const adopt=child=>{if(child.parent)child.parent.children=child.parent.children.filter(x=>x!==child);child.parent=result;};
  result.append=child=>{adopt(child);result.children.push(child);};
  result.prepend=child=>{adopt(child);result.children.unshift(child);};
  result.insertBefore=(child,before)=>{adopt(child);const index=result.children.indexOf(before);assert.ok(index>=0);result.children.splice(index,0,child);};
  result.after=child=>{assert.ok(result.parent);const parent=result.parent;if(child.parent)child.parent.children=child.parent.children.filter(x=>x!==child);child.parent=parent;parent.children.splice(parent.children.indexOf(result)+1,0,child);};
  result.insertAdjacentHTML=()=>{};
  Object.defineProperty(result,'innerHTML',{set(html){this.markup=html;if(html.includes('id="area-page-title"')){this.append(node('a'));const heading=node('h1');heading.id='area-page-title';this.append(heading);}}});
  result.querySelector=selector=>selector==='#area-page-title'?result.children.find(n=>n.id==='area-page-title'):null;
  return result;
 }
 const main=node('main'),form=node('form'),cats=node('section'),catalog=node('section'),reviews=node('section'),label=node('label'),areaInput=node('input');
 for(const child of [form,cats,catalog,reviews])main.append(child);
 const bySelector=new Map([['main',main],['#catalog-discovery',form],['.machine-categories',cats],['#catalog-results',catalog],
  ['[data-testimonials="catalogo"]',reviews],['#catalog-discovery label',label],['#catalog-discovery input[name=area]',areaInput]]);
 const classes=new Set(),context={URL,URLSearchParams,location:new URL('https://example.com/?area=maquinas&q=hyundai'),
  history:{replaceState(){}},document:{title:'',body:{classList:{add:name=>classes.add(name)}},createElement:node,
   querySelector:selector=>bySelector.get(selector)||null,querySelectorAll:()=>[],getElementById:id=>bySelector.get('#'+id)||null,
   addEventListener:(name,fn)=>{events[name]=fn;}}};
 context.window=context;vm.createContext(context);
 for(const name of ['catalog-types.js','catalog-routes.js','area-pages.js'])vm.runInContext(source(name),context);
 const page=main.children.find(n=>n.className==='area-page-content');
 assert.ok(classes.has('area-page'));assert.ok(page);
 assert.equal(page.children.filter(n=>n===form).length,1);assert.ok(!main.children.includes(form));
 assert.ok(page.children.indexOf(form)<page.children.indexOf(cats));
 assert.ok(page.children.indexOf(cats)<page.children.indexOf(catalog));
 assert.equal(page.children.filter(n=>n===reviews).length,1);assert.ok(page.children.indexOf(catalog)<page.children.indexOf(reviews));
 assert.equal(page.children.filter(n=>n.tag==='h1').length,1);
 events['goullart:filterchange']({detail:{category:'maquinas',type:'caminhoes',offers:false}});
 assert.equal(page.querySelector('#area-page-title').textContent,'Todos os caminhões');
 events['goullart:filterchange']({detail:{category:'maquinas',type:'',offers:false}});
 assert.equal(page.querySelector('#area-page-title').textContent,'VENDAS DE MÁQUINAS');
});
