import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('nota, foto e visibilidade preservam o preço revisado até uma edição explícita', async (t) => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'goullart-revisao-'));
  t.after(() => rm(process.env.DATA_DIR, { recursive: true, force: true }));
  const { importarBackup, listarPublicacoes, alterarPublicacao, catalogoPublico } = await import('../lib/publicacoes.js');
  const id = 'GOUL-329';
  const precoPublicado = 355000;
  const consulta = async () => (await catalogoPublico()).items.find(i => i.id === id);
  const antigo = { id, category: 'maquinas', title: 'Título de teste', price: 12345, publicText: 'Texto legado de teste.' };
  await importarBackup({ items: [antigo] });
  const editor = (await listarPublicacoes()).itens.find(i => i.id === id);
  assert.equal((await consulta()).price, precoPublicado);
  assert.equal(editor.preco, precoPublicado);
  assert.equal(editor.textoPublico, (await consulta()).publicText);

  await assert.rejects(alterarPublicacao(id, { titulo: antigo.title, textoPublico: antigo.publicText, preco: String(antigo.price), notasPrivadas: 'Rascunho' }), { status: 409 });
  const nota = await alterarPublicacao(id, { notasPrivadas: 'Somente na administração' });
  const foto = '/fotos/teste.jpg';
  await alterarPublicacao(id, { imagens: [foto] });
  assert.equal(nota.preco, precoPublicado);
  const atualizado = await consulta();
  assert.equal(atualizado.price, precoPublicado);
  assert.equal(atualizado.publicText, editor.textoPublico);
  assert.equal(atualizado.year, editor.ano);
  assert.equal(atualizado.hours, editor.horas);
  assert.deepEqual(atualizado.images, [foto]);
  assert.ok(!JSON.stringify(atualizado).includes('Somente na administração'));

  await alterarPublicacao(id, { noSite: false });
  assert.equal(await consulta(), undefined);
  await alterarPublicacao(id, { noSite: true });
  assert.equal((await consulta()).price, precoPublicado);
  await Promise.all([alterarPublicacao(id, { preco: 54321 }), alterarPublicacao(id, { notasPrivadas: 'Outra nota' })]);
  assert.equal((await consulta()).price, 54321);
  await alterarPublicacao(id, { preco: '' });
  assert.equal((await consulta()).price, null);
});
