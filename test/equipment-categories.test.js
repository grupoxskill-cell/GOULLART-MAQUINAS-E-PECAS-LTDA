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
const machine=(id,title,extra={})=>({id,publicCode:id,title,category:'maquinas',image:'/foto-original.jpg',publishedAt:'2026-11-23',retentionPolicy:'owner_confirmation',...extra});
const codes=items=>items.map(item=>item.publicCode).sort();

test('geradores e outros equipamentos mantêm tipos explícitos e modelos reconhecidos',()=>{
 for(const title of ['GERADOR • 55 KVA MOTOR MWM • 2009','Geradores de energia','Grupo gerador 100 kVA motor CAT']){
  assert.equal(types.classify(machine('GEN',title)),'geradores',title);
 }
 assert.equal(types.classify(machine('JET','JET SKI • RXTX 325 RS • 2026')),'outros-equipamentos');
 assert.equal(types.classify(machine('NOVO','Equipamento de modelo ainda não identificado')),'outros-equipamentos');
 assert.equal(types.classify(machine('PC','Komatsu PC200')),'escavadeira');
 assert.equal(types.classify(machine('CAT','Caterpillar 416')),'retroescavadeira');
 assert.equal(types.classify(machine('VOLVO','Volvo L60F')),'pa-carregadeira');
 assert.equal(types.classify(machine('TIPO','Modelo ainda não identificado',{machineType:'motoniveladora'})),'motoniveladora');
 assert.equal(types.classify(machine('MINI','Miniescavadeira SANY SY75C',{machineType:'escavadeira'})),'escavadeira');
});

test('fallback não transforma peças, locações nem registros sem categoria em outros equipamentos',()=>{
 for(const category of ['pecas','locacao','implementos']){
  for(const title of ['Gerador de energia','Outro equipamento']){
   const item=machine('FORA',title,{category,machineType:'geradores'});
   assert.equal(types.classify(item),'',category);
   assert.equal(types.matches(item,'geradores'),false,category);
   assert.equal(types.matches(item,'outros-equipamentos'),false,category);
  }
 }
 assert.equal(types.classify({title:'Equipamento desconhecido'}),'');
 const items=[
  machine('PUBLICO','Jet ski'),
  machine('PRIVADO','Outro equipamento',{privateOnly:true}),
  machine('RASCUNHO','Gerador',{published:false}),
  machine('VENDIDO','Gerador',{situacao:'Vendida'}),
 ];
 const visible=globalThis.GoullartCatalogData.vitrine({items}).items;
 assert.deepEqual(codes(visible),['PUBLICO']);
 assert.equal(types.counts(visible)['outros-equipamentos'],1);
 assert.equal(types.counts(visible).geradores,0);
});

test('todo equipamento público fica acessível por uma categoria, preservando o grupo de caminhões',()=>{
 const data=JSON.parse(readFileSync('espelho/api/catalog.json','utf8'));
 const items=globalThis.GoullartCatalogData.vitrine(data).items.filter(item=>item.category==='maquinas'&&globalThis.GoullartListingPolicy.eligibleListing(item));
 assert.ok(items.length>0);
 const assigned=new Map(types.entries.map(([id])=>[id,[]]));
 for(const item of items){
  const type=types.classify(item);
  assert.ok(assigned.has(type),'Sem categoria: '+item.publicCode+' '+item.title);
  assigned.get(type).push(item);
 }
 assert.equal([...assigned.values()].flat().length,items.length);
 const generators=items.filter(item=>/\bgerador(?:es)?\b/i.test(item.title));
 assert.ok(generators.length>0);
 assert.deepEqual(codes(assigned.get('geradores')),codes(generators));
 const jets=items.filter(item=>/\bjet\s*ski\b/i.test(item.title));
 assert.ok(jets.length>0);
 for(const jet of jets)assert.ok(assigned.get('outros-equipamentos').some(item=>item.id===jet.id));
 const trucks=items.filter(item=>/\bcaminh(?:ão|ões)\b|\bcavalo mecânico\b/i.test(item.title));
 assert.deepEqual(codes(items.filter(item=>types.matches(item,'caminhoes'))),codes(trucks));
 const counts=types.counts(items);
 for(const [type,pattern] of [['pipa',/\bpipa\b/i],['basculante',/\bbasculante\b/i],['cavalo-mecanico',/\bcavalo mecânico\b/i]]){
  assert.equal(counts[type],trucks.filter(item=>pattern.test(item.title)).length,type);
 }
});

test('páginas geradas exibem as novas categorias com fotos reais e conservam todos os cards anteriores',()=>{
 const read=name=>readFileSync('_site/'+name,'utf8');
 const items=globalThis.GoullartCatalogData.vitrine(JSON.parse(read('api/catalog.json'))).items.filter(item=>item.category==='maquinas'&&globalThis.GoullartListingPolicy.eligibleListing(item));
 const home=read('index.html');
 const originalTypes=['pa-carregadeira','retroescavadeira','escavadeira','motoniveladora','trator-agricola','rolo-compactador','mini-carregadeira','trator-esteira','caminhoes','cavalo-mecanico','pipa','basculante'];
 const homeCards=[...home.matchAll(/<a\b[^>]*class="machine-type-card"[^>]*id="tipo-([^"]+)"[^>]*>/g)];
 assert.deepEqual(homeCards.map(match=>match[1]).sort(),[...originalTypes,'geradores','outros-equipamentos'].sort());
 assert.ok(homeCards.every(match=>!/\s+hidden(?=[\s>])/.test(match[0])));
 for(const type of ['geradores','outros-equipamentos']){
  const expected=items.filter(item=>types.matches(item,type));
  assert.ok(expected.length>0,type);
  const card=home.match(new RegExp('<a\\b[^>]*id="tipo-'+type+'"[^>]*>[\\s\\S]*?</a>'))?.[0]||'';
  assert.ok(expected.some(item=>card.includes('src="'+item.image+'"')),type+' usa foto do próprio anúncio');
  assert.match(card,/object-fit:contain/);
  for(const suffix of ['.html','/index.html']){
   const html=read('maquinas/'+type+suffix);
   const actual=[...html.matchAll(/<article id="anuncio-([^"]+)"/g)].map(match=>match[1]).sort();
   assert.deepEqual(actual,codes(expected),type+suffix);
   assert.equal(new Set(actual).size,actual.length,type+' sem duplicação');
   assert.ok(html.includes('<h1>'+types.label(type)+'</h1>'));
  }
 }
 for(const file of ['index.html','maquinas.html','maquinas/geradores/index.html','maquinas/outros-equipamentos/index.html','maquinas/escavadeira/index.html','maquinas/caminhoes/index.html']){
  const menu=read(file).match(/<dialog id="goullart-sidebar"[\s\S]*?<\/dialog>/)?.[0]||'';
  const machines=menu.match(/<summary>Máquinas Pesadas[\s\S]*?<\/details>/)?.[0]||'';
  for(const type of ['geradores','outros-equipamentos']){
   assert.equal((machines.match(new RegExp('href="/maquinas/'+type+'"','g'))||[]).length,1,file+' '+type);
  }
 }
});
