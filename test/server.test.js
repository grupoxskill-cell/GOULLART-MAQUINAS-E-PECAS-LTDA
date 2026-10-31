import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashSenha } from '../lib/auth.js';

// Dados privados do teste em pasta temporária, com senha conhecida.
const dataDir = await mkdtemp(join(tmpdir(), 'goullart-teste-'));
await writeFile(join(dataDir, 'config.json'), JSON.stringify({ margem: 20000, segredo: 'a'.repeat(64), ...hashSenha('senha-de-teste') }));

// Chave fictícia: prova que configurar uma variável não reativa o atendimento automático.
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '4317', DATA_DIR: dataDir, OPENAI_API_KEY: 'dummy-test-not-a-real-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  assert.ok(html.includes('Goullart Agro Brasil'));
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

async function entrar() {
  const r = await fetch(base + '/adm/api/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: 'senha-de-teste' }) });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
const enviar = (cookie, path, method, body, extra = {}) => fetch(base + path, { method,
  headers: { 'Content-Type': 'application/json', Cookie: cookie, ...extra }, body: body && JSON.stringify(body) });

test('ADM exige login e recusa senha errada', async () => {
  assert.equal((await fetch(base + '/adm/api/resumo')).status, 401);
  assert.equal((await fetch(base + '/adm/api/crm')).status, 401);
  const r = await fetch(base + '/adm/api/entrar', { method: 'POST', body: JSON.stringify({ senha: 'errada' }) });
  assert.equal(r.status, 401);
  assert.equal((await fetch(base + '/adm/')).status, 200);
});

test('Radar soma a margem e só aparece no site depois de publicar', async () => {
  const cookie = await entrar();
  const item = await (await enviar(cookie, '/adm/api/radar', 'POST', { titulo: 'Escavadeira Komatsu PC200 teste', ano: '2018', precoOrigem: 'R$ 259.000', fonte: 'contato privado' })).json();
  assert.equal(item.status, 'novo');
  const antes = await (await fetch(base + '/maquinas.json')).json();
  assert.ok(!antes.some((m) => m.titulo === item.titulo));
  assert.equal((await enviar(cookie, `/adm/api/radar/${item.id}/publicar`, 'POST')).status, 200);
  const depois = await (await fetch(base + '/maquinas.json')).json();
  const publicado = depois.find((m) => m.titulo === item.titulo);
  assert.equal(publicado.preco, 'R$ 279.000');
  assert.equal(publicado.fonte, undefined);
  assert.equal(publicado.obs, undefined);
});

test('Pátio publicado aparece com local e marcado como pátio', async () => {
  const cookie = await entrar();
  const item = await (await enviar(cookie, '/adm/api/patio', 'POST', { titulo: 'Pá-carregadeira teste pátio', preco: '300000', local: 'Goiânia/GO' })).json();
  await enviar(cookie, `/adm/api/patio/${item.id}/publicar`, 'POST');
  const m = (await (await fetch(base + '/maquinas.json')).json()).find((x) => x.titulo === item.titulo);
  assert.equal(m.patio, true); assert.equal(m.local, 'Goiânia/GO'); assert.equal(m.preco, 'R$ 300.000');
});

test('ADM recusa outra origem e fotos fora do padrão', async () => {
  const cookie = await entrar();
  assert.equal((await enviar(cookie, '/adm/api/radar', 'POST', { titulo: 'x' }, { Origin: 'https://site-malicioso.example' })).status, 403);
  assert.equal((await enviar(cookie, '/adm/api/fotos', 'POST', { dados: 'data:image/png;base64,AAAA' })).status, 400);
  for (const path of ['/fotos/../config.json', '/fotos/config.json', '/fotos/%2e%2e%2fconfig.json']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
});

test('Encontros cruzam pedido do CRM com máquina do Radar', async () => {
  const cookie = await entrar();
  const backup = { contacts: [{ id: 'c1', name: 'Cliente Teste', phone: '62999990000' }],
    deals: [{ id: 'd1', contactId: 'c1', title: 'Escavadeira PC cerca R$300mil', category: 'Escavadeiras', kind: 'Compra', stage: 'Qualificação' }] };
  assert.equal((await enviar(cookie, '/adm/api/crm', 'POST', backup)).status, 200);
  const enc = await (await enviar(cookie, '/adm/api/encontros', 'GET')).json();
  const e = enc.find((x) => x.pedidoId === 'd1');
  assert.ok(e.achados.some((a) => /PC200/.test(a.maquina.titulo)));
});

test('cada máquina tem página própria com prévia para WhatsApp e Google', async () => {
  const maquinas = await (await fetch(base + '/maquinas.json')).json();
  const m = maquinas.find((x) => /PC200/.test(x.titulo) && !x.referencia.startsWith('R-'));
  assert.equal(m.slug, 'escavadeira-komatsu-pc200-2018');
  const r = await fetch(`${base}/maquina/${m.slug}.html`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<meta property="og:title" content="Escavadeira Komatsu PC200 — R\$ 259\.000">/);
  assert.match(html, /og:image" content="https:\/\/www\.goullartmaquinaspesadas\.com\.br\/maquinas\//);
  assert.match(html, /"@type":"Product"/);
  assert.equal((await fetch(base + '/maquina/nao-existe.html')).status, 404);
  assert.match(await (await fetch(base + '/sitemap.xml')).text(), /maquina\/escavadeira-komatsu-pc200-2018\.html/);
});

test('contador conta visitas e cliques, ignora repetição e referência desconhecida', async () => {
  const cookie = await entrar();
  const m = (await (await fetch(base + '/maquinas.json')).json()).find((x) => /Volvo EC220DL/.test(x.titulo));
  const contar = (ref, tipo) => fetch(base + '/api/interesse', { method: 'POST', body: JSON.stringify({ ref, tipo }) });
  assert.equal((await contar(m.referencia, 'visita')).status, 204);
  assert.equal((await contar(m.referencia, 'interesse')).status, 204);
  assert.equal((await contar(m.referencia, 'interesse')).status, 204);
  assert.equal((await contar('GOUL-INEXISTENTE', 'interesse')).status, 400);
  await new Promise((r) => setTimeout(r, 100));
  const lista = await (await enviar(cookie, '/adm/api/interesse', 'GET')).json();
  const linha = lista.find((x) => x.ref === m.referencia);
  assert.equal(linha.visitas, 1);
  assert.equal(linha.interesses, 1);
  assert.equal((await fetch(base + '/adm/api/interesse')).status, 401);
});

test('catálogo público do ADM sem dados privados', async () => {
  const r = await fetch(base + '/adm/catalogo.json');
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.ok(Array.isArray(c.items) && c.items.length > 0);
  assert.ok(!/privateNotes|notasPrivadas|sourceKey/.test(JSON.stringify(c)));
});
