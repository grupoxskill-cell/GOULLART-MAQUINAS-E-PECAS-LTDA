import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../espelho/catalog-data.js';
import '../espelho/listing-policy.js';

const context={window:{}};
vm.createContext(context);
vm.runInContext(readFileSync('espelho/catalog-types.js','utf8'),context);
const types=context.window.GoullartMachineTypes;
const truck=(title,extra={})=>({title,category:'maquinas',...extra});

test('todos os caminhões reúne os tipos específicos e os modelos sem subtipo, uma vez por anúncio',()=>{
 const cases=[
  ['CAMINHÃO ROLL-ON/ROLL-OFF VW 31.330 2019','caminhoes'],
  ['CONJUNTO DE CAMINHÕES VW 26260 + FORD CARGO 2005','caminhoes'],
  ['CAMINHÃO MERCEDES-BENZ 1620 ELETRÔNICO 2011','caminhoes'],
  ['Caminhão pipa VW 31.330 2022','pipa'],
  ['Caminhão basculante VW 31.280 2022','basculante'],
  ['Caminhão comboio','comboio'],
  ['Caminhão munck','munck'],
  ['Cavalo mecânico Mercedes-Benz 2035S 2009','cavalo-mecanico'],
 ];
 const items=cases.map(([title])=>truck(title));
 for(const [title,type] of cases){
  assert.equal(types.classify(truck(title)),type,title);
  assert.equal(types.matches(truck(title),'caminhoes'),true,title);
  assert.equal(types.matches(truck(title),type),true,title);
 }
 const counts=types.counts([...items,truck('Escavadeira Volvo EC220'),truck('Peça para caminhão pipa',{category:'pecas'}),truck('Locação de caminhão',{category:'locacao'})]);
 assert.equal(counts.caminhoes,cases.length);
 for(const type of ['pipa','basculante','comboio','munck','cavalo-mecanico'])assert.equal(counts[type],1,type);
 assert.equal(types.matches(truck('Caminhão basculante'),'pipa'),false);
 assert.equal(types.matches(truck('Escavadeira'),'caminhoes'),false);
 assert.equal(types.matches(truck('Caminhão pipa',{category:'pecas',machineType:'pipa'}),'caminhoes'),false);
});

test('a rota pública agrega todos os caminhões publicados sem repetir cards e conserva os acessos existentes',()=>{
 const read=name=>readFileSync('_site/'+name,'utf8');
 const items=globalThis.GoullartCatalogData.vitrine(JSON.parse(read('api/catalog.json'))).items
  .filter(item=>item.category==='maquinas'&&globalThis.GoullartListingPolicy.eligibleListing(item));
 const expected=items.filter(item=>/\bcaminh(?:ão|ões)\b|\bcavalo mecânico\b/i.test(item.title)).map(item=>item.publicCode).sort();
 assert.ok(expected.length>0,'Deve haver caminhões publicados para verificar a rota.');
 for(const file of ['maquinas/caminhoes.html','maquinas/caminhoes/index.html']){
  const html=read(file);
  const codes=[...html.matchAll(/<article id="anuncio-([^"]+)"/g)].map(match=>match[1]).sort();
  assert.deepEqual(codes,expected,file);
  assert.equal(codes.length,new Set(codes).size,'Cada caminhão aparece uma vez.');
  assert.match(html,/<h1>Todos os caminhões<\/h1>/);
  assert.match(html,/data-catalog-type="caminhoes"/);
  assert.match(html,/<p id="catalog-page-count">\d+ anúncios encontrados<\/p>/);
 }
 const home=read('index.html');
 assert.equal((home.match(/id="tipo-caminhoes"/g)||[]).length,1);
 for(const type of ['caminhoes','cavalo-mecanico','pipa','basculante']){
  assert.match(home,new RegExp('<a(?![^>]* hidden)[^>]*id="tipo-'+type+'"[^>]*href="/maquinas/'+type+'"'));
 }
 for(const file of ['index.html','maquinas.html','maquinas/pipa/index.html','maquinas/basculante/index.html','maquinas/caminhoes/index.html']){
  const menu=read(file).match(/<dialog id="goullart-sidebar"[\s\S]*?<\/dialog>/)?.[0]||'';
  assert.equal((menu.match(/href="\/maquinas\/caminhoes"/g)||[]).length,1,file);
  assert.match(menu,/<summary>Caminhões[\s\S]*?<div><a href="\/maquinas\/caminhoes">Todos os caminhões<\/a>/,file);
 }
});
