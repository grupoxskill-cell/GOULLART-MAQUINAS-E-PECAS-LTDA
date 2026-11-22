import test from "node:test";
import assert from "node:assert/strict";
import { painelOperacao, validarRegistro, jaVista, historiasPublicas } from "../lib/operacao.js";
import { duracaoVideo } from "../lib/evidencia-publica.js";
import { alertaPagamento } from "../lib/radar-entrada.js";
import { encontrar } from "../lib/encontros.js";
import "../public/busca-maquinas.js";

const agora=new Date("2026-11-22T13:00:00Z");
const crom={contacts:[{id:"c",name:"Cliente teste"}],deals:[{id:"p",contactId:"c",title:"Escavadeira",kind:"Compra",stage:"Proposta"},{id:"v",contactId:"c",saleConfirmed:true,title:"Venda confirmada"}]};
const op=eventos=>({eventos,ultimaConsulta:"2026-11-20T12:59:59Z"});
test("um cliente com duas negociações vê cada unidade uma vez, inclusive quando há código alternativo",()=>{
  const e=validarRegistro({tipo:"vista",pedido:"p",ref:"goul-334"},crom,[],[]);
  assert.equal(jaVista([e],"c","GOUL-316"),true);
  assert.throws(()=>validarRegistro({tipo:"vista",pedido:"v",ref:"GOUL-316"},crom,[],[e]));
  assert.deepEqual(encontrar(crom.deals,crom.contacts,[{referencia:"GOUL-316",categoria:"Escavadeiras",titulo:"Escavadeira"}],1,(d,m)=>!jaVista([e],d.contactId,m.referencia)),[]);
});
test("aniversário exige venda confirmada, considera ano civil e preserva retorno em aberto",()=>{
  assert.throws(()=>validarRegistro({tipo:"venda",pedido:"p",data:"2025-11-22",ref:"X"},crom,[],[],agora));
  const e=validarRegistro({tipo:"venda",pedido:"v",data:"2025-11-22",ref:"X"},crom,[],[],agora);
  assert.equal(painelOperacao(op([e]),crom,[],agora).aniversarios.length,1);
  const feito=validarRegistro({tipo:"aniversario",pedido:"v"},crom,[],[e],agora);
  assert.equal(painelOperacao(op([e,feito]),crom,[],agora).aniversarios.length,0);
});
test("caixa usa apenas entradas informadas em até cinco negociações abertas, exclui fechadas",()=>{
  const deals=Array.from({length:7},(_,i)=>({id:String(i),kind:"Compra",title:"Trator",saleConfirmed:i===0})), eventos=deals.map(d=>({tipo:"projecao",pedido:d.id,data:"2026-12-0"+(1+Number(d.id)),valor:500}));
  const painel=painelOperacao(op(eventos),{deals,contacts:[]},[],agora);
  assert.equal(painel.totalPrevisto,2500);assert.deepEqual(painel.previsao.map(e=>e.pedido),["1","2","3","4","5"]);assert.equal(painel.ferias,true);
});
test("Radar exige três comparáveis distintos para nota, separa idade do anúncio e confirma a UF",()=>{
  const radar=[{id:"r",titulo:"Trator",ano:"2020",horas:"900 h",local:"Cidade/GO",precoOrigem:70000,status:"novo"}];
  const a={tipo:"avaliacao",radar:"r",data:"2026-10-21",estado:"Plaqueta a conferir",comparaveis:[1,2,3].map(i=>({valor:100000,link:"https://example.org/"+i}))};
  const e={...validarRegistro(a,crom,radar,[],agora),em:agora.toISOString()};
  const p=painelOperacao(op([e]),crom,radar,agora);
  assert.equal(p.ofertas[0].dias,32);assert.equal(p.melhores.GO.nota,10);assert.equal(p.ofertas[0].alerta,true);
  assert.equal(painelOperacao(op([]),crom,radar,agora).melhores.GO,undefined);
  assert.throws(()=>validarRegistro({...a,comparaveis:[a.comparaveis[0],a.comparaveis[0]]},crom,radar,[],agora));
});
test("aprovador tem de liberar a peça comercial; histórico público contém só modelo, destino e dias",()=>{
  const venda={tipo:"venda",pedido:"v",data:"2026-11-22"};
  const e={id:"h",...validarRegistro({tipo:"historia",pedido:"v",autorizada:true,titulo:"Modelo de teste",destino:"Cidade/PA",inicio:"2026-11-01"},crom,[],[venda])};
  assert.deepEqual(historiasPublicas(op([e])),[]);
  const aprovado=validarRegistro({tipo:"aprovar",alvo:"h"},crom,[],[e]);
  assert.deepEqual(historiasPublicas(op([e,aprovado])),[{titulo:"Modelo de teste",destino:"Cidade - PA",dias:21}]);
});
test("busca entende município com acento e horas escritas como o cliente fala",()=>{
  const ficha={title:"Escavadeira de teste",hours:"2.950",location:"Goiânia/GO"};
  const busca=globalThis.GoullartBusca.corresponde;
  assert.ok(busca(ficha,"escavadeira em goiania até 3 mil horas"));assert.ok(busca(ficha,"Goiânia 2.950h"));
  assert.equal(busca({...ficha,hours:null},"até 3000 horas"),false);assert.equal(busca(ficha,"até 1000 horas"),false);
});
test("arquivo inválido nunca ganha status de vídeo de horímetro",()=>{
  assert.equal(duracaoVideo(Buffer.from("vídeo fictício")),null);
});

test("Radar separa indicação de cobrança antecipada de uma oferta sem entrada",()=>{
  assert.equal(alertaPagamento("Sinal para reservar a unidade"),true);
  assert.equal(alertaPagamento("Boleto em nome de terceiro"),true);
  assert.equal(alertaPagamento("Sem sinal para reservar."),false);
});
