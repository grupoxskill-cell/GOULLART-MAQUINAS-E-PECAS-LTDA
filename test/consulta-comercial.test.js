import test from "node:test";
import assert from "node:assert/strict";
import { consultaPublica, registroDaFicha, camposComerciais } from "../lib/consulta-maquinas.js";
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

test("o alias GOUL-348 preserva a disponibilidade salva antes do vínculo com GOUL-294", () => {
  const ficha = {referencia:"GOUL-294", titulo:"Caminhão VW 31.280", categoria:"Caminhões", slug:"caminhao-vw-31-280", situacao:"A confirmar"};
  const item = {id:"PUB-221", publicCode:"GOUL-348", title:ficha.titulo};
  for (const situacao of ["Vendida", "Reservada", "Disponível"]) {
    const salvo = {situacao, confirmado_em:"2026-11-24T15:00:00Z", conferidaEm:"2026-11-24T16:00:00Z", video:"https://example.org/video-goul348", nota:"nota interna"};
    const registros = {"GOUL-348":salvo};
    const antes = JSON.stringify(registros);
    for (const codigo of ["GOUL-348", "GOUL-294"]) {
      const registro = registroDaFicha(registros, codigo);
      assert.equal(registro, salvo, codigo);
      const comercial = camposComerciais(ficha, registro);
      assert.equal(comercial.situacao, situacao);
      assert.equal(comercial.status, situacao.toLowerCase());
      assert.equal(comercial.confirmado_em, salvo.confirmado_em);
      assert.equal(comercial.video, salvo.video);
    }
    const consulta = consultaPublica([{...ficha, id:item.id}, ficha], {items:[item]}, [ficha], registros);
    assert.equal(consulta.length, 1);
    assert.equal(consulta[0].referencia, "GOUL-294");
    assert.equal(consulta[0].codigoVitrine, "GOUL-348");
    for (const campo of ["situacao", "confirmado_em", "conferidaEm", "video"]) assert.equal(consulta[0][campo], salvo[campo], campo);
    assert.equal(consulta[0].status, situacao.toLowerCase());
    assert.doesNotMatch(JSON.stringify(consulta), /nota interna/);
    assert.equal(JSON.stringify(registros), antes, "A leitura não migra nem modifica os registros salvos.");
  }
});

test("o registro canônico GOUL-294 prevalece sobre o histórico GOUL-348 sem mesclar estados", () => {
  const canonico = {situacao:"Reservada", confirmado_em:null, conferidaEm:"2026-11-25T10:00:00Z", video:null};
  const registros = {"GOUL-294":canonico, "GOUL-348":{situacao:"Vendida", confirmado_em:"2026-11-24T15:00:00Z", conferidaEm:"2026-11-24T16:00:00Z", video:"https://example.org/video-antigo"}};
  const antes = JSON.stringify(registros);
  for (const codigo of ["GOUL-348", "GOUL-294"]) assert.equal(registroDaFicha(registros, codigo), canonico);
  const ficha = {referencia:"GOUL-294", titulo:"Caminhão VW 31.280", slug:"caminhao-vw-31-280", situacao:"A confirmar"};
  const consulta = consultaPublica([{...ficha, id:"PUB-221"}], {items:[{id:"PUB-221", publicCode:"GOUL-348"}]}, [ficha], registros);
  assert.equal(consulta[0].status, "reservada");
  for (const campo of ["situacao", "confirmado_em", "conferidaEm", "video"]) assert.equal(consulta[0][campo], canonico[campo], campo);
  assert.equal(JSON.stringify(registros), antes);
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
