import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { anuncioAprovado, avaliar, entradaPublica, localValido, marcaDe, modeloDe, precoEmReais, precoSite } from '../lib/radar.js';

const catalogo = JSON.parse(await readFile('public/maquinas.json', 'utf8'));

test('lê preços como escritos no catálogo e nos anúncios', () => {
  assert.equal(precoEmReais('R$ 180.000 ou R$ 195.000'), 180000);
  assert.equal(precoEmReais('R$ 275.000 cada'), 275000);
  assert.equal(precoEmReais('230 mil'), 230000);
  assert.equal(precoEmReais('R$ 259.000,00'), 259000);
  assert.equal(precoEmReais('a combinar'), null);
  // "milhão" não é "mil": uma máquina de R$ 1,2 milhão não pode virar R$ 1.000 no site.
  assert.equal(precoEmReais('R$ 1,2 milhão'), 1200000);
  assert.equal(precoEmReais('R$ 2 milhões'), 2000000);
  assert.equal(precoEmReais('1.2 milhões'), 1200000);
  assert.equal(precoEmReais('1,5 mil'), 1500);
  assert.equal(precoEmReais('R$ 850'), null);
  assert.equal(precoEmReais('R$ 1.250.000,00'), 1250000);
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
  const e = entradaPublica({ codigo: 'RADAR-261031-01', titulo: 'Escavadeira Komatsu PC200', categoria: 'Escavadeiras', ano: 2018, horas: '9.000 h', local: 'Itaúna, MG', precoSite: precoSite(200000), fonte: 'grupo X' });
  assert.deepEqual(Object.keys(e).sort(), ['ano', 'categoria', 'ficha', 'fotos', 'horas', 'local', 'preco', 'referencia', 'titulo']);
  assert.equal(e.preco, 'R$ 220.000');
  assert.equal(e.ficha, 'radar-2026-10-31');
  assert.equal(e.local, 'Itaúna - MG');
  assert.throws(() => entradaPublica({ codigo: 'RADAR-261031-02', titulo: 'a', categoria: 'Outros', local: 'MG', precoSite: 1 }));
  assert.throws(() => entradaPublica({ codigo: 'X', titulo: 'a', precoSite: 1 }));
});
test('só passa anúncio real, recente e com cidade e estado', () => {
  const hoje = new Date('2026-10-31T21:00:00-03:00');
  const bom = { dataAnuncio: '2026-10-28', local: 'Itaúna - MG', temFotoOriginal: true, preco: 'R$ 250.000', ativo: true };
  assert.deepEqual(anuncioAprovado(bom, hoje), { ok: true, motivos: [] });
  assert.deepEqual(anuncioAprovado({ ...bom, dataAnuncio: '2026-10-21' }, hoje).motivos, ['anúncio com mais de 7 dias']);
  assert.deepEqual(anuncioAprovado({ ...bom, local: 'MG' }, hoje).motivos, ['sem cidade e estado']);
  assert.deepEqual(anuncioAprovado({ ...bom, ativo: false, temFotoOriginal: false }, hoje).motivos, ['sem foto real da máquina', 'anúncio fora do ar']);
  assert.equal(localValido('Capital SP'), null);
  assert.equal(localValido('São Paulo/sp'), 'São Paulo - SP');
});

test('valorEmReais do ADM também entende milhão, mil e k', async () => {
  const { valorEmReais } = await import('../lib/encontros.js');
  assert.equal(valorEmReais('R$ 1,2 milhão'), 1200000);
  assert.equal(valorEmReais('2 MILHÕES'), 2000000);
  assert.equal(valorEmReais('259 mil'), 259000);
  assert.equal(valorEmReais('300k'), 300000);
  assert.equal(valorEmReais('R$ 259.000,00'), 259000);
  assert.equal(valorEmReais('R$ 850'), null);
});
