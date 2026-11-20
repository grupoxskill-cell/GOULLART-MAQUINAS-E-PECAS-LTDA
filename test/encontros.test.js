import test from 'node:test';
import assert from 'node:assert/strict';
import { encontrar, pontuar } from '../lib/encontros.js';

const pedido = (orcamento, budget = '') => ({
  id: 'pedido-teste', title: `Compra escavadeira até ${orcamento}`,
  category: 'Escavadeiras', kind: 'Compra', stage: 'Qualificação', budget,
});
const maquina = (preco) => ({
  referencia: 'TESTE', titulo: 'Escavadeira', categoria: 'Escavadeiras', preco,
});

for (const [orcamento, preco] of [
  ['R$ 2 milhões', 'R$ 1.500.000'],
  ['R$ 1,2 milhão', 'R$ 1.100.000'],
  ['R$ 2 mi', 'R$ 1.500.000'],
  ['R$2milhões', 'R$ 1.500.000'],
  ['R$ 350 mil', 'R$ 300.000'],
  ['R$ 350k', 'R$ 300.000'],
  ['R$ 350.000,00', 'R$ 300.000'],
]) {
  test(`pedido com ${orcamento} no título encontra máquina dentro do orçamento`, () => {
    const resultado = encontrar([pedido(orcamento)], [], [maquina(preco)]);
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].achados.length, 1);
    assert.equal(resultado[0].achados[0].pontos, 3);
    assert.ok(resultado[0].achados[0].motivos.includes('cabe no orçamento'));
    assert.ok(!resultado[0].achados[0].motivos.includes('acima do orçamento'));
  });
}

test('orçamento em milhões no título continua rejeitando máquina muito acima do limite', () => {
  const p = pedido('R$ 1,2 milhão');
  const m = maquina('R$ 1.800.000');
  assert.deepEqual(encontrar([p], [], [m]), []);
  assert.ok(pontuar(p, m).motivos.includes('acima do orçamento'));
});

test('campo de orçamento prevalece sobre o valor escrito no título', () => {
  const p = pedido('R$ 2 milhões', 500000);
  const m = maquina('R$ 1.500.000');
  assert.deepEqual(encontrar([p], [], [m]), []);
  assert.ok(pontuar(p, m).motivos.includes('acima do orçamento'));
});
