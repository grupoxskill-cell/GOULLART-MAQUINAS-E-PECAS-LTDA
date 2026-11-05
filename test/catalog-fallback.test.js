import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../espelho/runtime-compat.js',import.meta.url),'utf8');
const items=[{id:'TEST',title:'Máquina de teste'}];

for(const failure of ['timeout','http','html','invalid']) {
  test(`catálogo de reserva funciona após ${failure} na origem`,async()=>{
    const controller=new AbortController(),calls=[];
    const context={AbortSignal,fetch:async(url,options)=>{
      calls.push({url,options});
      if(calls.length===1) {
        if(failure==='timeout'){controller.abort();throw Error('timeout');}
        if(failure==='http')return new Response('',{status:503});
        if(failure==='html')return new Response('<html>erro</html>');
        return Response.json({error:'indisponível'});
      }
      assert.equal(options.signal.aborted,false);
      return Response.json({items});
    }};
    context.window=context;vm.createContext(context);vm.runInContext(source,context);
    const response=await context.GoullartRuntime.fetchCatalog({cache:'no-store',signal:controller.signal});
    assert.deepEqual(await response.json(),{items});
    assert.deepEqual(calls.map(c=>c.url),['/adm/catalogo.json','/api/catalog.json']);
    assert.notEqual(calls[0].options.signal,calls[1].options.signal);
    assert.equal(calls[1].options.cache,'no-store');
  });
}

test('catálogo válido usa somente a origem e mantém o corpo disponível',async()=>{
  let calls=0;
  const context={fetch:async()=>{calls++;return Response.json({items});}};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);
  assert.deepEqual(await (await context.GoullartRuntime.fetchCatalog()).json(),{items});
  assert.equal(calls,1);
});

test('falha nas duas fontes é propagada para preservar a vitrine já renderizada',async()=>{
  const context={AbortSignal,fetch:async()=>new Response('',{status:503})};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);
  await assert.rejects(context.GoullartRuntime.fetchCatalog(),/Catálogo indisponível/);
});
