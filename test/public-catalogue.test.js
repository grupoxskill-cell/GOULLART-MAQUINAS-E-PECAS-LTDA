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
 const images=new Set(feed.items.filter(i=>i.category==='maquinas').flatMap(i=>[i.image,...i.images]));assert.equal(images.size,11);
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
