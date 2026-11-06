import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'goullart-edits-'));
process.env.DATA_DIR = dir;
const { gravar, ler } = await import('../lib/dados.js');
const { alterarPublicacao, alterarRadar } = await import('../lib/publicacoes.js');
const { rotaAdm } = await import('../lib/adm.js');
const { criarCookie } = await import('../lib/auth.js');
const segredo = 'synthetic-test-secret';
await gravar('config', { segredo, margem: 20000, tokenEntrada: 'synthetic-token' });
test.after(() => rm(dir, { recursive: true, force: true }));
const ids = ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb'];
const seed = () => ids.map(id => ({ id, titulo: id, fotos: ['fotos/aaaaaaaaaaaaaaaaaaaaaaaa.jpg'], precoOrigem: 100000, status: 'novo', publicado: false }));
async function request(path, method, body = {}, beforeBody = async () => {}) {
  const req = { method, url: path, headers: { host: 'localhost', cookie: criarCookie(segredo, false).split(';')[0], authorization: 'Bearer synthetic-token' },
    async *[Symbol.asyncIterator]() { await beforeBody(); yield Buffer.from(JSON.stringify(body)); } };
  const result = {};
  const res = { writeHead(status) { result.status = status; return this; }, end(body) { result.body = JSON.parse(body || 'null'); } };
  await rotaAdm(req, res, path);
  return result;
}

test('publicações e perfis Radar preservam edições concorrentes em registros distintos (10 rodadas)', async () => {
  for (let n = 0; n < 10; n++) {
    await gravar('publicacoes', { itens: ids.map(id => ({ id, titulo: id, noSite: false, notasPrivadas: 'privado' })) });
    await gravar('radares', ids.map(id => ({ id, nome: id })));
    const results = await Promise.all(ids.flatMap((id, i) => [alterarPublicacao(id, { titulo: `edit-${i}` }), alterarRadar(id, { nome: `edit-${i}` })]));
    assert.equal(results[0].titulo, 'edit-0');
    assert.deepEqual((await ler('publicacoes')).itens.map(i => i.titulo), ['edit-0', 'edit-1']);
    assert.deepEqual((await ler('radares')).map(i => i.nome), ['edit-0', 'edit-1']);
    assert.ok((await ler('publicacoes')).itens.every(i => !i.noSite && i.notasPrivadas === 'privado'));
  }
});

for (const tipo of ['radar', 'patio']) {
  test(`${tipo}: edições e criações concorrentes preservam todos os registros`, async () => {
    await gravar(tipo, seed());
    const responses = await Promise.all([
      ...ids.map((id, i) => request(`/adm/api/${tipo}/${id}`, 'PUT', { titulo: `edit-${i}` })),
      ...Array.from({ length: 8 }, (_, i) => request(`/adm/api/${tipo}`, 'POST', { titulo: `new-${i}`, preco: 100, precoOrigem: 100 }))
    ]);
    assert.deepEqual(responses.map(r => r.status), [200, 200, ...Array(8).fill(201)]);
    const saved = await ler(tipo);
    assert.equal(saved.length, 10);
    assert.deepEqual(saved.slice(0, 2).map(i => i.titulo), ['edit-0', 'edit-1']);
    assert.equal(new Set(saved.map(i => i.id)).size, 10);
    assert.ok(saved.every(i => tipo === 'radar' ? i.status === 'novo' : !i.publicado));
  });
  test(`${tipo}: publicação e edição concorrentes mantêm estado e preço`, async () => {
    await gravar(tipo, seed());
    const responses = await Promise.all([
      request(`/adm/api/${tipo}/${ids[0]}/publicar`, 'POST'),
      request(`/adm/api/${tipo}/${ids[1]}`, 'PUT', { titulo: 'editado' })
    ]);
    assert.ok(responses.every(r => r.status === 200));
    const saved = await ler(tipo);
    assert.equal(saved[1].titulo, 'editado');
    if (tipo === 'radar') { assert.equal(saved[0].status, 'publicado'); assert.equal(saved[0].precoSite, 120000); }
    else assert.equal(saved[0].publicado, true);
  });
  test(`${tipo}: exclusão concorrente não ressuscita registro`, async () => {
    await gravar(tipo, seed());
    const responses = await Promise.all([
      request(`/adm/api/${tipo}/${ids[0]}`, 'DELETE'),
      request(`/adm/api/${tipo}/${ids[1]}`, 'PUT', { titulo: 'restante' })
    ]);
    assert.ok(responses.every(r => r.status === 200));
    assert.deepEqual((await ler(tipo)).map(i => [i.id, i.titulo]), [[ids[1], 'restante']]);
  });
}

test('nova oferta automática recebida durante edição lenta permanece no Radar', async () => {
  await gravar('radar', seed());
  let release, started;
  const bodyReady = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const edit = request(`/adm/api/radar/${ids[0]}`, 'PUT', { titulo: 'editado' }, async () => { started(); await gate; });
  await bodyReady;
  try {
    const incoming = await request('/adm/entrada/radar', 'POST', { titulo: 'Oferta sintética', categoria: 'Escavadeiras', link: 'https://example.com/synthetic', precoOrigem: 100000 });
    assert.equal(incoming.status, 201);
    release();
    assert.equal((await edit).status, 200);
    const saved = await ler('radar');
    assert.equal(saved.length, 3);
    assert.equal(saved[0].titulo, 'editado');
    assert.ok(saved.some(i => i.id === incoming.body.id && i.status === 'novo'));
  } finally { release(); await edit; }
});

test('validação rejeitada não grava mutações parciais e a fila continua operando', async () => {
  await gravar('publicacoes', { itens: [{ id: 'A', titulo: 'original', preco: 1 }] });
  await assert.rejects(alterarPublicacao('A', { titulo: 'não salvar', preco: -1 }), { status: 400 });
  assert.equal((await ler('publicacoes')).itens[0].titulo, 'original');
  await assert.rejects(alterarRadar('inexistente', {}), { status: 404 });
  await gravar('radar', [{ id: ids[0], titulo: 'sem preço' }]);
  assert.equal((await request(`/adm/api/radar/${ids[0]}/publicar`, 'POST')).status, 400);
  assert.equal((await request(`/adm/api/radar/${ids[0]}`, 'PATCH')).status, 405);
  assert.equal((await request(`/adm/api/radar/${ids[1]}`, 'PUT')).status, 404);
  assert.equal((await request(`/adm/api/radar/${ids[0]}`, 'PUT', { titulo: '' })).status, 400);
  assert.equal((await request(`/adm/api/radar/${ids[0]}`, 'PUT', { titulo: 'válido' })).status, 200);
  assert.equal((await ler('radar'))[0].status, undefined);
});

test('editar configuração durante a renovação do token preserva só o token novo', async () => {
  const edit = await request('/adm/api/config', 'PUT', { margem: 18000 }, async () => {
    const token = await request('/adm/api/entrada/token', 'POST');
    assert.equal(token.status, 200);
  });
  assert.equal(edit.status, 200);
  const cfg = await ler('config');
  assert.equal(cfg.margem, 18000);
  assert.ok(cfg.tokenEntradaHash);
  assert.equal(cfg.tokenEntrada, undefined);
  assert.equal((await request('/adm/entrada/radar', 'POST', { titulo: 'teste' })).status, 401);
});

test('sair invalida a edição em andamento e o cookie antigo', async () => {
  const edit = await request('/adm/api/config', 'PUT', { margem: 1 }, async () => {
    assert.equal((await request('/adm/api/sair', 'POST')).status, 200);
  });
  assert.equal(edit.status, 401);
  assert.notEqual((await ler('config')).segredo, segredo);
  assert.notEqual((await ler('config')).margem, 1);
  assert.equal((await request('/adm/api/radar', 'GET')).status, 401);
});
