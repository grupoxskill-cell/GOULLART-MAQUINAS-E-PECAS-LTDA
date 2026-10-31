import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { avaliar, entradaPublica, marcaDe, modeloDe, precoEmReais, precoSite } from '../lib/radar.js';

const catalogo = JSON.parse(await readFile('public/maquinas.json', 'utf8'));

test('lê preços como escritos no catálogo e nos anúncios', () => {
  assert.equal(precoEmReais('R$ 180.000 ou R$ 195.000'), 180000);
  assert.equal(precoEmReais('R$ 275.000 cada'), 275000);
  assert.equal(precoEmReais('230 mil'), 230000);
  assert.equal(precoEmReais('R$ 259.000,00'), 259000);
  assert.equal(precoEmReais('a combinar'), null);
});
test('reconhece marca e modelo', () => {
  assert.equal(marcaDe('Escavadeira Komatsu PC200'), 'komatsu');
  assert.equal(marcaDe('Pá-carregadeira CAT 924'), 'caterpillar');
  assert.equal(modeloDe('Escavadeira Komatsu PC200'), 'pc200');
});
test('barata = pelo menos 15% abaixo das parecidas do catálogo', () => {
  const pc200 = { titulo: 'Escavadeira Komatsu PC200', categoria: 'Escavadeiras', ano: '2018' };
  const ref = avaliar({ ...pc200, precoOrigem: 'R$ 999.999' }, catalogo).referencia;
  assert.ok(ref > 0);
  assert.equal(avaliar({ ...pc200, precoOrigem: String(Math.floor(ref * 0.8)) }, catalogo).barata, true);
  assert.equal(avaliar({ ...pc200, precoOrigem: String(Math.floor(ref * 0.95)) }, catalogo).barata, false);
  assert.equal(avaliar({ titulo: 'Guindaste Marca Desconhecida X1', categoria: 'Outros', precoOrigem: '100.000' }, catalogo).motivo, 'sem parecidas no catálogo');
});
test('entrada do site só tem dados públicos, com preço já com a margem', () => {
  const e = entradaPublica({ codigo: 'RADAR-261031-01', titulo: 'Escavadeira Komatsu PC200', categoria: 'Escavadeiras', ano: 2018, horas: '9.000 h', precoSite: precoSite(200000), fonte: 'grupo X' });
  assert.deepEqual(Object.keys(e).sort(), ['ano', 'categoria', 'ficha', 'fotos', 'horas', 'preco', 'referencia', 'titulo']);
  assert.equal(e.preco, 'R$ 220.000');
  assert.equal(e.ficha, 'radar-2026-10-31');
  assert.throws(() => entradaPublica({ codigo: 'X', titulo: 'a', precoSite: 1 }));
});
