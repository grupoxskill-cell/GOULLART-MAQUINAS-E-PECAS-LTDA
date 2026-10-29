import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

// Chave fictícia: prova que configurar uma variável não reativa o atendimento automático.
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '4317', OPENAI_API_KEY: 'dummy-test-not-a-real-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
await once(child.stdout, 'data');
test.after(() => child.kill());
const base = 'http://127.0.0.1:4317';

test('chat permanece bloqueado em todos os métodos e com query string', async () => {
  for (const path of ['/api/chat', '/api/chat?origin=legacy', '/api/chat/']) {
    for (const method of ['POST', 'GET', 'PUT']) {
      const r = await fetch(base + path, { method });
      assert.equal(r.status, 410);
      const d = await r.json();
      assert.equal(d.automaticReplies, false);
      assert.equal(d.reply, undefined);
      assert.equal(d.whatsapp, 'https://wa.me/5562999427276');
    }
  }
});
test('catálogo funciona na URL compartilhada com publicação estática', async () => {
  const expected = JSON.parse(await readFile('data/catalogo.json', 'utf8'));
  assert.deepEqual(await (await fetch(base + '/catalogo.json')).json(), expected);
  assert.deepEqual(await (await fetch(base + '/api/catalogo')).json(), expected);
});
test('site, logo e HEAD disponíveis; sem UI da Sophia', async () => {
  const html = await (await fetch(base)).text();
  assert.ok(html.includes('assets/logo-oficial.png'));
  assert.ok(!/data-open-chat|chat-toggle|Sophia/.test(html));
  assert.equal((await fetch(base + '/assets/logo-oficial.png')).headers.get('content-type'), 'image/png');
  const h = await fetch(base, { method: 'HEAD' });
  assert.equal(h.status, 200); assert.equal(await h.text(), '');
});
test('catálogo de máquinas e fotos disponíveis, sem dados internos', async () => {
  const maquinas = await (await fetch(base + '/maquinas.json')).json();
  assert.ok(maquinas.length > 0);
  for (const m of maquinas) {
    assert.ok(!m.referencia.includes('CRM'));
    for (const f of m.fotos) assert.equal((await fetch(base + '/' + f, { method: 'HEAD' })).headers.get('content-type'), 'image/jpeg');
  }
});
test('dados privados e caminhos malformados não são servidos', async () => {
  for (const path of ['/.env', '/data/empresa.json', '/%2e%2e%2f.env', '/.git/config']) {
    const r = await fetch(base + path); assert.ok([403,404].includes(r.status));
  }
  assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(base + '/health')).status, 200);
});
