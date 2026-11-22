import test from "node:test";
import assert from "node:assert/strict";
import { consultaPublica } from "../lib/consulta-maquinas.js";
import { catalogoPdf } from "../lib/catalogo-pdf.js";
import { paginaMaquina } from "../lib/paginas.js";
import { seisMeses, registroCompra } from "../lib/historico-comercial.js";

test("uma unidade tem a mesma situação nas duas referências; a comparação não expõe campos internos", () => {
  const ficha = { referencia:"GOUL-306", titulo:"Unidade", fotos:[], ano:"2022", slug:"unidade", vendedor:"interno" };
  const item = { id:"pub-x", publicCode:"GOUL-330", hours:"18" };
  const lista = consultaPublica([{ id:"pub-x",referencia:"GOUL-330",titulo:"Unidade" },ficha],{items:[item]},[ficha],{
    "GOUL-306":{situacao:"Reservada", conferidaEm:"2026-11-20T12:00:00Z", nota:"interno"}
  });
  assert.equal(lista.length,1);
  assert.equal(lista[0].situacao,"Reservada");
  assert.equal(lista[0].horas,"18 h");
  assert.equal(lista[0].ano,"2022");
  assert.doesNotMatch(JSON.stringify(lista),/interno/);
  assert.match(lista[0].url,/maquina\/unidade.html$/);
});

test("ficha sem conferência não sinaliza estoque e a ficha vendida permite procurar outra", async () => {
  const m = {titulo:"Máquina", referencia:"REF", slug:"maquina", categoria:"Tratores", fotos:[], preco:"R$ 100.000"};
  assert.doesNotMatch(await paginaMaquina(m,[]),/schema.org\/InStock/);
  const vendida = await paginaMaquina({...m,situacao:"Vendida"},[]);
  assert.match(vendida,/schema.org\/SoldOut/);
  assert.match(vendida,/Quero uma igual a essa/);
});

test("PDF preserva caracteres, paginação, links e o fim do catálogo", () => {
  const lista = Array.from({length:70},(_,i)=>({codigoVitrine:"REF-"+i,titulo:"Máquina (teste)",preco:"Sob consulta",situacao:"A confirmar",url:"https://example.org/ficha/"+i}));
  const pdf = catalogoPdf(lista,"22/11/2026").toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.match(pdf,/REF-69/);
  assert.match(pdf,/\/Subtype \/Link/);
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.ok(pdf.slice(xref).startsWith("xref"));
  assert.match(catalogoPdf([],"22/11/2026").toString("latin1"),/Sem máquinas/);
});

test("seis meses civis respeitam o fim do mês e o histórico exige compra documentada", () => {
  assert.equal(seisMeses("2025-08-31"),"2026-02-28");
  assert.equal(seisMeses("2023-08-31"),"2024-02-29");
  const v = {maquina:"Trator",dia:"2026-05-22",responsavel:"Equipe",estado:"Confirmada",comprovante:"Registro interno"};
  const negocio = {id:"n1",contactId:"c1"};
  assert.equal(registroCompra(v,negocio,"2026-11-22").revisarEm,"2026-11-22");
  for (const patch of [{dia:"2026-02-30"},{dia:"2027-01-01"},{comprovante:""}]) {
    assert.throws(()=>registroCompra({...v,...patch},negocio,"2026-11-22"));
  }
});
