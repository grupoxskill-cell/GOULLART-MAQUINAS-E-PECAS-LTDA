import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={window:{},URL,URLSearchParams};vm.createContext(context);
vm.runInContext(readFileSync(new URL('../espelho/catalog-routes.js',import.meta.url),'utf8'),context);
const routes=context.window.GoullartRoutes;
test('legacy shared links open the correct area rather than the hidden homepage inventory',()=>{
 for(const area of ['maquinas','pecas','locacao','implementos'])assert.equal(routes.resolve('https://example.com/?item=CAT-6#'+area).area,area);
 assert.equal(routes.resolve('https://example.com/?item=GOUL-404').area,'maquinas');
 assert.equal(routes.resolve('https://example.com/#maquinas').area,'maquinas');
 assert.equal(routes.resolve('https://example.com/').area,'');
});
test('an explicit area wins over stale hashes and legacy machine types are preserved',()=>{
 assert.equal(routes.resolve('https://example.com/?area=pecas#maquinas').area,'pecas');
 const route=routes.resolve('https://example.com/#tipo-escavadeira');
 assert.equal(route.area,'maquinas');assert.equal(route.type,'escavadeira');
});
test('shared item links include the area and safely encode the item identifier',()=>{
 const link=routes.link({id:'CAT-6 & 7',category:'pecas'},'https://example.com');
 const url=new URL(link);assert.equal(url.searchParams.get('area'),'pecas');assert.equal(url.searchParams.get('item'),'CAT-6 & 7');
});
test('a shared item link never selects another item with a similar identifier',()=>{
 assert.equal(routes.matchesItem({id:'CAT-6',publicCode:'GOUL-014'},'CAT-6'),true);
 assert.equal(routes.matchesItem({id:'CAT-60',publicCode:'GOUL-060'},'CAT-6'),false);
 assert.equal(routes.matchesItem({id:'CAT-6',publicCode:'GOUL-014'},'GOUL-014'),true);
 assert.equal(routes.matchesItem({id:'CAT-6'},'unknown'),false);
});
