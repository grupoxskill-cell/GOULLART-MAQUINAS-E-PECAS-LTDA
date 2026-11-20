import test from 'node:test';
import assert from 'node:assert/strict';
import { maquinasDoCatalogo } from '../lib/adm.js';
import { encontrar } from '../lib/encontros.js';

const agora = Date.parse('2026-11-19T15:00:00Z');
const anuncio = (codigo, extra = {}) => ({
  id: codigo, publicCode: codigo, category: 'maquinas', title: 'Escavadeira Komatsu PC200',
  price: 300000, image: '/assets/listings/teste.jpg', publishedAt: '2026-11-19', ...extra,
});
const ficha = (codigo, extra = {}) => ({
  referencia: codigo, titulo: 'Escavadeira Komatsu PC200', categoria: 'Escavadeiras',
  preco: 'R$ 350.000', ...extra,
});
const candidatos = (items, { base = items, publicacoes = null, site = [] } = {}) =>
  maquinasDoCatalogo({ items }, { items: base }, publicacoes, site, agora);

test('oferta presente somente no catálogo público participa do cruzamento', () => {
  const maquinas = candidatos([anuncio('TESTE-CATALOGO')]);
  const pedidos = [{ id: 'p1', title: 'Compra escavadeira Komatsu PC200', kind: 'Compra', stage: 'Aberto', budget: 320000 }];
  const resultado = encontrar(pedidos, [], maquinas);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].achados[0].maquina.referencia, 'TESTE-CATALOGO');
  assert.equal(resultado[0].achados[0].maquina.preco, 'R$ 300.000');
  assert.ok(resultado[0].achados[0].motivos.includes('cabe no orçamento'));
});

test('título com caminhões no plural continua compatível com pedido de caminhão', () => {
  const maquinas = candidatos([anuncio('TESTE-CONJUNTO', {
    title: 'CONJUNTO DE CAMINHÕES • VW 26260 + FORD CARGO • 2005', price: 550000,
  })]);
  const pedidos = [{ id: 'p-caminhao', title: 'Compra caminhão Ford Cargo', kind: 'Compra', stage: 'Aberto', budget: 600000 }];
  const resultado = encontrar(pedidos, [], maquinas);
  assert.equal(maquinas[0].categoria, 'Caminhões');
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].achados[0].maquina.referencia, 'TESTE-CONJUNTO');
});

test('referência repetida usa o preço atual do catálogo uma única vez', () => {
  const maquinas = candidatos([anuncio('TESTE-REPETIDO'), anuncio('TESTE-REPETIDO', { id: 'nova-versao', price: 310000 })], {
    site: [ficha('TESTE-REPETIDO')],
  });
  assert.equal(maquinas.length, 1);
  assert.equal(maquinas[0].preco, 'R$ 310.000');
});

test('aliases confirmados não duplicam unidade, mas máquinas semelhantes continuam separadas', () => {
  const maquinas = candidatos([anuncio('GOUL-334'), anuncio('TESTE-OUTRA-UNIDADE')], {
    site: [ficha('GOUL-316'), ficha('TESTE-OUTRA-UNIDADE')],
  });
  assert.deepEqual(maquinas.map((m) => m.referencia), ['GOUL-334', 'TESTE-OUTRA-UNIDADE']);
  const parecidas = candidatos([anuncio('UNIDADE-1'), anuncio('UNIDADE-2')]);
  assert.equal(parecidas.length, 2);
});

test('vendida e publicação ocultada pelo ADM não ressurgem pela ficha antiga', () => {
  const publicacoes = { importadoEm: '2026-11-01', itens: [
    { id: 'id-oculto', codigo: 'TESTE-OCULTO', noSite: false, editadoNoAdm: true },
    { id: 'id-alias', codigo: 'GOUL-334', noSite: false, editadoNoAdm: true },
  ] };
  const items = [anuncio('GOUL-291'), anuncio('TESTE-OCULTO', { id: 'id-oculto' }), anuncio('GOUL-334', { id: 'id-alias' })];
  const maquinas = candidatos(items, { publicacoes, site: [ficha('GOUL-291'), ficha('TESTE-OCULTO'), ficha('GOUL-316')] });
  assert.deepEqual(maquinas, []);
});

test('ficha antiga não contorna retirada, falta de foto, validade ou mudança de categoria do catálogo', () => {
  const base = [anuncio('RETIRADA'), anuncio('SEM-FOTO', { image: '' }),
    anuncio('VENCIDA', { publishedAt: '2026-01-01' }), anuncio('PECA', { category: 'pecas' })];
  const maquinas = candidatos(base.slice(1), { base, site: base.map((i) => ficha(i.publicCode)) });
  assert.deepEqual(maquinas, []);
});

test('ficha aprovada sem registro no catálogo continua no cruzamento', () => {
  const maquinas = candidatos([], { site: [ficha('LEGADA-APROVADA')] });
  assert.equal(maquinas.length, 1);
  assert.equal(maquinas[0].referencia, 'LEGADA-APROVADA');
  assert.equal(maquinas[0].publicado, true);
});
