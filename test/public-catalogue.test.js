import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import '../espelho/catalog-data.js';
const tools=globalThis.GoullartCatalogData;
const feed=JSON.parse(readFileSync(new URL('../espelho/api/catalog.json',import.meta.url),'utf8'));
test('approved listing corrections include the D51 price, proper units and the requested titles',()=>{
 const d51=feed.items.find(i=>i.publicCode==='GOUL-293');assert.equal(d51.price,600000);assert.equal(d51.title,'TRATOR DE ESTEIRA • KOMATSU D51 • 2019');assert.match(d51.publicText,/7\.900 horas/);
 const trucks=feed.items.find(i=>i.publicCode==='GOUL-348');assert.match(trucks.publicText,/14 m³/);assert.doesNotMatch(trucks.publicText,/metros quadrados/);
 for(const item of feed.items.filter(i=>i.category==='maquinas')){assert.match(item.title,/^[^•]+ • [^•]+ • \d{4}$/);assert.doesNotMatch(item.publicText,/\*|Horimetro|manutenções em dias/i);assert.match(tools.facts(item),/Ano \d{4} · .+ · .+/);}
});
test('every machine photograph is an existing asset served from the same domain',()=>{
 const machines=feed.items.filter(i=>i.category==='maquinas');
 assert.ok(machines.length>0,'O catálogo deve conter máquinas.');
 const images=new Set();
 for(const item of machines){
  assert.ok(typeof item.image==='string'&&item.image.trim(),`${item.id}: foto principal obrigatória`);
  assert.ok(Array.isArray(item.images)&&item.images.length>0,`${item.id}: galeria obrigatória`);
  for(const image of [item.image,...item.images])images.add(image);
 }
 for(const image of images){assert.match(image,/^\/assets\/(?:listings|publicacoes)\//);assert.ok(existsSync(new URL('../espelho'+image,import.meta.url)),image);}
 assert.equal(tools.asset('https://old.example.com/assets/listings/unit.jpg'),'/assets/listings/unit.jpg');
});
test('normalization also corrects a stale public ADM record without altering the source record',()=>{
 const original={publicCode:'GOUL-293',title:'old',price:null,publicText:'Horimetro 7:900',image:'https://old.example.com/assets/publicacoes/photo.webp'};
 const fixed=tools.normalize(original);assert.equal(fixed.price,600000);assert.equal(fixed.image,'/assets/publicacoes/photo.webp');assert.equal(original.price,null);assert.equal(original.title,'old');
});
test('private administration remains excluded from indexing',()=>{
 const html=readFileSync(new URL('../adm/index.html',import.meta.url),'utf8');assert.match(html,/<meta name="robots" content="noindex(?:, nofollow)?">/);
});
test('parts without a photograph stay out of the public feed',()=>{
 const out=tools.feed({items:[{category:'pecas',title:'Rolete',image:'',images:[]},{category:'pecas',title:'Sapata',image:'/assets/listings/sapata.jpg',images:['/assets/listings/sapata.jpg']},{category:'maquinas',title:'ESCAVADEIRA • X • 2020',image:'',images:[]}]});
 assert.deepEqual(out.items.map(i=>i.title),['Sapata','ESCAVADEIRA • X • 2020']);
});
test('a escavadeira vendida sai das fontes estáticas e das importações do ADM',()=>{
 const pagina=readFileSync(new URL('../espelho/maquinas/escavadeira.html',import.meta.url),'utf8');
 assert.doesNotMatch(pagina,/PUB-158\b|GOUL-291\b/);
 const aliasVendidos=[
  {publicCode:'GOUL-291'},
  {id:'PUB-158',publicCode:'GOUL-999'},
  {publicCode:'PUB-158'},
  {publicationId:158}
 ];
 for(const item of [...feed.items,...feed.opportunities]) {
  assert.notEqual(item.publicCode,'GOUL-291');
  assert.notEqual(item.id,'PUB-158');
  assert.notEqual(String(item.publicationId),'158');
 }
 const outraUnidade={id:'PUB-159',publicCode:'GOUL-OUTRA',publicationId:159,title:'HYUNDAI R220 LC-9 2022'};
 const itens=[...aliasVendidos,outraUnidade];
 const publico=tools.feed({items:itens,opportunities:itens});
 for(const lista of [publico.items,publico.opportunities]){
  assert.deepEqual(lista.map(i=>i.id),['PUB-159']);
 }
});
test('site público não traz telefones particulares, só o comercial (62) 99942-7276', async () => {
 const {readdirSync,statSync}=await import('node:fs');const {join}=await import('node:path');
 const proibidos=/99853-?1936|998531936|99252-?1936|992521936/;
 const achados=[];
 const varrer=pasta=>{for(const n of readdirSync(pasta)){const p=join(pasta,n);if(statSync(p).isDirectory()){if(!/^(assets|node_modules)$/.test(n))varrer(p);}else if(/\.(html|js|json|xml|txt)$/.test(n)&&proibidos.test(readFileSync(p,'utf8')))achados.push(p);}};
 for(const pasta of ['espelho','public','lib','data'])varrer(new URL('../'+pasta,import.meta.url).pathname);
 assert.deepEqual(achados,[],'telefone particular em arquivo público');
});
