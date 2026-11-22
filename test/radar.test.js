import test from 'node:test';
import assert from 'node:assert/strict';
import { anuncioAprovado, avaliar, entradaPublica, localValido, marcaDe, modeloDe, precoEmReais, precoSite } from '../lib/radar.js';



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
const alvo = { referencia: 'ALVO', titulo: 'Escavadeira Hyundai R220LC-9', categoria: 'Escavadeiras',
  ano: '2020', horas: '5.000 h', precoOrigem: 255000 };
const amostra = [
  { ...alvo, referencia: 'A', ano: 2018, horas: '4.000 h', preco: 'R$ 280.000' },
  { ...alvo, referencia: 'B', ano: 2020, horas: 5200, preco: 300000 },
  { ...alvo, referencia: 'C', ano: 2022, horas: '6.000', preco: 'R$ 400 mil' },
];

test('compara pela mediana de três unidades e inclui exatamente 15% de desconto', () => {
  const conta = avaliar(alvo, amostra);
  assert.equal(conta.referencia, 300000);
  assert.equal(conta.barata, true);
  assert.equal(conta.desconto, 0.15);
  assert.equal(conta.metodo, 'mediana dos preços pedidos');
  assert.deepEqual(conta.faixa, [280000, 400000]);
  assert.deepEqual(conta.comparadas, ['A', 'B', 'C']);
  assert.equal(avaliar({ ...alvo, precoOrigem: 255001 }, amostra).barata, false);
});

test('dados insuficientes não geram desconto, mesmo com preço de origem muito baixo', () => {
  for (const extra of [
    { titulo: 'Escavadeira Hyundai R220LC-9S' }, { titulo: 'Escavadeira Hyundai R220LC-7' },
    { titulo: 'Escavadeira SANY R220LC-9' }, { ano: '2017' }, { ano: '' }, { horas: '' },
    { horas: '6.001 h' }, { horas: '5.500 km' }, { horas: '5.200 / 5.600 h' }, { preco: -300000 },
    { preco: 'entrada R$ 130.000' }, { preco: '300 mil ou 320 mil' }, { preco: 'R$ 300.000 cada' },
  ]) {
    const conta = avaliar(alvo, [amostra[0], amostra[1], { ...amostra[2], ...extra }]);
    assert.equal(conta.barata, false, JSON.stringify(extra));
    assert.equal(conta.referencia, undefined);
    assert.equal(conta.desconto, undefined);
    assert.match(conta.motivo, /amostra insuficiente/);
  }
  for (const campo of ['titulo', 'ano', 'horas', 'categoria']) {
    assert.equal(avaliar({ ...alvo, [campo]: '' }, amostra).comparadas.length, 0);
  }
  assert.equal(avaliar({ ...alvo, precoOrigem: '-300.000' }, amostra).referencia, undefined);
});

test('mesma unidade, cópias cruzadas e o próprio anúncio não aumentam a amostra', () => {
  const [a, b] = amostra;
  const registros = [
    { ...alvo, referencia: 'COPIA-DO-ALVO', preco: 800000 },
    { ...a, fotos: ['maquina-a.jpg'], preco: 290000 },
    { ...a, referencia: 'REVENDA-2', horas: '4.002 h', fotos: ['maquina-a.jpg'], link: 'https://example.org/item?id=42&utm_source=loja' },
    { ...a, referencia: 'REVENDA-3', horas: '4.003 h', link: 'https://example.org/item?id=42' },
    b, { ...b, referencia: 'CLONE-B', preco: 800000 },
  ];
  for (const ordem of [registros, [...registros].reverse()]) {
    const conta = avaliar(alvo, ordem);
    assert.equal(conta.comparadas.length, 2);
    assert.equal(conta.referencia, undefined);
  }
});

test('amostra de máquinas de poucas horas também respeita o limite relativo de 20%', () => {
  const novo = { ...alvo, horas: 100 };
  const conta = avaliar(novo, amostra.map((x, i) => ({ ...x, horas: [80, 120, 121][i] })));
  assert.equal(conta.comparadas.length, 2);
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
  assert.deepEqual(anuncioAprovado({ ...bom, dataAnuncio: '2026-10-21' }, hoje), { ok: true, motivos: [] }); // 10 dias: ainda recente
  assert.deepEqual(anuncioAprovado({ ...bom, dataAnuncio: '2026-10-10' }, hoje).motivos, ['anúncio com mais de 15 dias']);
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

test('oferta pública: selo abaixo do mercado sem revelar o preço de origem', async () => {
  const { ofertaPublica } = await import('../lib/radar.js');
  const e = entradaPublica({ codigo: 'RADAR-261104-08', titulo: 'Escavadeira Sany SY215C', categoria: 'Escavadeiras', ano: '2021', horas: '5000', local: 'Belo Horizonte/MG', precoSite: 339000, precoMercado: 490000, fotos: ['maquinas/x-1.jpg'] });
  assert.equal(e.mercado, 'R$ 490.000'); assert.equal(e.desconto, 31);
  assert.ok(!JSON.stringify(e).includes('319000'), 'preço de origem não entra');
  assert.deepEqual(ofertaPublica('R$ 339.000', 'R$ 490.000', '2026-11-04'), { verified: true, price: 339000, referencePrice: 490000, discountPercent: 31, reviewedAt: '2026-11-04' });
  assert.equal(ofertaPublica(339000, 300000, '2026-11-04'), undefined, 'mercado abaixo do site não é oferta');
  assert.equal(entradaPublica({ codigo: 'RADAR-261104-09', titulo: 'X', categoria: 'Escavadeiras', local: 'Goiânia/GO', precoSite: 100000 }).mercado, undefined);
});
