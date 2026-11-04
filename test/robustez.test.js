// Falhas encontradas na revisão de 04/11/2026: queda do servidor, limite de login e sessões antigas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashSenha, ipCliente } from '../lib/auth.js';

const dataDir = await mkdtemp(join(tmpdir(), 'goullart-robustez-'));
await writeFile(join(dataDir, 'config.json'), JSON.stringify({ margem: 20000, segredo: 'b'.repeat(64), ...hashSenha('senha-de-teste') }));
const PORT = 4327;
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
await once(child.stdout, 'data');
test.after(() => child.kill());
const base = `http://127.0.0.1:${PORT}`;
const vivo = async () => (await fetch(base + '/health')).status === 200;

test('corpo cortado no meio não derruba o servidor', async () => {
  await new Promise((ok) => {
    const s = net.connect(PORT, '127.0.0.1', () => {
      s.write('POST /api/interesse HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{"ref":');
      setTimeout(() => { s.resetAndDestroy(); ok(); }, 100);
    });
    s.on('error', () => {});
  });
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(await vivo());
});

test('arquivo de dados corrompido dá erro 500, não derruba o servidor', async () => {
  await writeFile(join(dataDir, 'patio.json'), '{');
  const r = await fetch(base + '/maquinas.json');
  assert.equal(r.status, 500);
  assert.ok(await vivo());
  await writeFile(join(dataDir, 'patio.json'), '[]');
});

test('X-Forwarded-For forjado não escapa do limite de senhas erradas', async () => {
  const codigos = [];
  for (let i = 0; i < 7; i++) {
    const r = await fetch(base + '/adm/api/entrar', { method: 'POST', headers: { 'X-Forwarded-For': `1.2.3.${i}, 127.0.0.9` } /* o nginx acrescenta o IP real no fim */, body: JSON.stringify({ senha: 'errada' }) });
    codigos.push(r.status);
  }
  assert.equal(codigos.at(-1), 429);
});

test('IP do visitante é o último do X-Forwarded-For (o que o nginx acrescenta)', () => {
  assert.equal(ipCliente({ headers: { 'x-forwarded-for': '6.6.6.6, 200.1.2.3' }, socket: {} }), '200.1.2.3');
  assert.equal(ipCliente({ headers: {}, socket: { remoteAddress: '10.0.0.5' } }), '10.0.0.5');
});

test('trocar a senha invalida as sessões antigas', async () => {
  // Outro servidor, sem o bloqueio de tentativas do teste anterior.
  const dir = await mkdtemp(join(tmpdir(), 'goullart-sessao-'));
  await writeFile(join(dir, 'config.json'), JSON.stringify({ margem: 20000, segredo: 'c'.repeat(64), ...hashSenha('senha-antiga') }));
  const p = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '4328', DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
  await once(p.stdout, 'data');
  try {
    const b = 'http://127.0.0.1:4328';
    const login = await fetch(b + '/adm/api/entrar', { method: 'POST', body: JSON.stringify({ senha: 'senha-antiga' }) });
    const velho = login.headers.get('set-cookie').split(';')[0];
    const troca = await fetch(b + '/adm/api/senha', { method: 'POST', headers: { Cookie: velho }, body: JSON.stringify({ atual: 'senha-antiga', nova: 'senha-nova-123' }) });
    assert.equal(troca.status, 200);
    const novo = troca.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(b + '/adm/api/resumo', { headers: { Cookie: velho } })).status, 401);
    assert.equal((await fetch(b + '/adm/api/resumo', { headers: { Cookie: novo } })).status, 200);
    const cfg = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'));
    assert.notEqual(cfg.segredo, 'c'.repeat(64));
  } finally { p.kill(); }
});

test('gravações simultâneas do mesmo arquivo não falham nem corrompem', async () => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'goullart-fila-'));
  const { gravar, atualizar, ler } = await import(`../lib/dados.js?fila=${Date.now()}`);
  await Promise.all(Array.from({ length: 20 }, (_, i) => gravar('x', { i })));
  await Promise.all(Array.from({ length: 20 }, () => atualizar('contador', { n: 0 }, (c) => { c.n++; })));
  assert.equal((await ler('contador', null)).n, 20);
  assert.ok(Number.isInteger((await ler('x', null)).i));
});
