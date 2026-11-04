import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL('../espelho/'+name,import.meta.url),'utf8');
const rental=(id,date,extra={})=>({id,publicCode:'TEST-'+id,category:'locacao',title:'Locação de teste',image:'/original.jpg',receivedAt:date,publishedAt:date,...extra});
const now=Date.parse('2026-11-01T15:00:00Z');

test('all rentals expire after 30 calendar days in Brazil without changing their records',()=>{
 const ctx=vm.createContext({});vm.runInContext(source('listing-policy.js'),ctx);
 const {eligibleListing}=ctx.GoullartListingPolicy;
 for(const extra of [{opportunitySummary:true},{retentionPolicy:'owner_confirmation'},{}]){
  for(const [date,expected] of [['2026-11-01',true],['2026-10-02',true],['2026-10-01',false],['2026-11-02',false],['',false],['2026-02-30',false]]){
   const item=rental('UNIQUE',date,{...extra,updatedAt:'2026-11-01'}),before=JSON.stringify(item);
   assert.equal(eligibleListing(item,now),expected,JSON.stringify({date,extra}));
   assert.equal(JSON.stringify(item),before);
  }
 }
 assert.equal(eligibleListing(rental('PHOTOLESS','2026-11-01',{image:''}),now),false);
 assert.equal(eligibleListing(rental('SUMMARY','2026-11-01',{image:'',opportunitySummary:true}),now),true);
 assert.equal(eligibleListing(rental('MACHINE','2025-01-01',{category:'maquinas',retentionPolicy:'owner_confirmation'}),now),true);
 // Midnight UTC is still the previous date in São Paulo.
 assert.equal(eligibleListing(rental('ZONE','2026-10-02T01:00:00Z'),now),false);
});

test('an open rental page expires unchanged cards at local midnight, even if refresh fails',async()=>{
 let clock=Date.parse('2026-11-01T02:59:59Z'),offline=false,interval;
 class Clock extends Date {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const node=()=>({dataset:{contact:''},value:'',innerHTML:'',hidden:false,textContent:'',addEventListener(){},setAttribute(){},getAttribute(){return null;},removeAttribute(){}});
 const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);};
 const original=[rental('OLDER','2026-10-01',{updatedAt:'2026-10-30'}),rental('NEWEST','2026-10-15',{updatedAt:'2026-10-31'}),rental('WAITING','2026-10-20')];
 // Only the already approved public feed is supplied to the storefront.
 const approved=original.slice(0,2),before=JSON.stringify(original);
 const ctx={Date:Clock,URL,URLSearchParams,Intl,location:new URL('https://example.com/?area=locacao'),history:{replaceState(){}},CustomEvent:class{},setInterval(fn){interval=fn;},addEventListener(){},document:{hidden:false,querySelector:get,querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){}},fetch:async()=>{if(offline)throw Error('offline');return {ok:true,json:async()=>({items:approved})};}};
 ctx.window=ctx;ctx.GoullartRuntime={timeout(){}};ctx.GoullartPartsFamilies=[];ctx.GoullartPartsOrder={title:s=>s};
 ctx.GoullartMachineTypes={counts:()=>({}),label:()=>'',matches:()=>true};ctx.GoullartCatalogData={feed:d=>d};
 ctx.GoullartRoutes={matchesItem:()=>true,link:i=>'https://example.com/?item='+i.id+'&area=locacao'};
 vm.createContext(ctx);for(const f of ['listing-policy.js','app.js'])vm.runInContext(source(f),ctx);
 await new Promise(setImmediate);
 let cards=get('#products').innerHTML;
 assert.ok(cards.indexOf('item-NEWEST')<cards.indexOf('item-OLDER'));
 assert.match(cards,/src="\/original.jpg"/);assert.doesNotMatch(cards,/WAITING/);
 assert.equal(get('#count').textContent,'2 anúncios encontrados');
 clock=Date.parse('2026-11-01T03:00:00Z');offline=true;interval();await new Promise(setImmediate);
 cards=get('#products').innerHTML;
 assert.match(cards,/item-NEWEST/);assert.doesNotMatch(cards,/item-OLDER|WAITING/);
 assert.equal(get('#count').textContent,'1 anúncios encontrados');
 assert.equal(JSON.stringify(original),before);
});
