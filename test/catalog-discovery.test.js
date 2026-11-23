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
 assert.equal(results.nodes.get('#catalog-results').scrolled,true,'A busca da home deve levar aos resultados, depois dos blocos.');
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
  result.insertAdjacentHTML=()=>{};
  Object.defineProperty(result,'innerHTML',{set(html){this.markup=html;if(html.includes('id="area-page-title"')){this.append(node('a'));const heading=node('h1');heading.id='area-page-title';this.append(heading);}}});
  result.querySelector=selector=>selector==='#area-page-title'?result.children.find(n=>n.id==='area-page-title'):null;
  return result;
 }
 const main=node('main'),form=node('form'),cats=node('section'),catalog=node('section'),label=node('label'),areaInput=node('input');
 for(const child of [form,cats,catalog])main.append(child);
 const bySelector=new Map([['main',main],['#catalog-discovery',form],['.machine-categories',cats],['#catalog-results',catalog],
  ['#catalog-discovery label',label],['#catalog-discovery input[name=area]',areaInput]]);
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
 assert.equal(page.children.filter(n=>n.tag==='h1').length,1);
 events['goullart:filterchange']({detail:{category:'maquinas',type:'caminhoes',offers:false}});
 assert.equal(page.querySelector('#area-page-title').textContent,'Todos os caminhões');
 events['goullart:filterchange']({detail:{category:'maquinas',type:'',offers:false}});
 assert.equal(page.querySelector('#area-page-title').textContent,'VENDAS DE MÁQUINAS');
});
