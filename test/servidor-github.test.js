// Atualização do servidor com o repositório público e privado (token só de leitura), contra um GitHub falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA';
const SHA = 'a'.repeat(40);
const TOKEN = 'github_pat_teste_123';

// Pacote igual ao do GitHub: uma pasta "dono-repo-sha/" com o site dentro.
const base = await mkdtemp(join(tmpdir(), 'goullart-gh-'));
await mkdir(join(base, 'pacote', `repo-${SHA.slice(0, 7)}`), { recursive: true });
await writeFile(join(base, 'pacote', `repo-${SHA.slice(0, 7)}`, 'index.html'), '<h1>site novo</h1>');
const tarball = execFileSync('tar', ['-czf', '-', '-C', join(base, 'pacote'), '.']);

let exigeToken = false;
const pedidos = [];
const servidor = http.createServer((req, res) => {
  pedidos.push({ url: req.url, auth: req.headers.authorization || '' });
  if (exigeToken && req.headers.authorization !== `Bearer ${TOKEN}`) return res.writeHead(404).end();
  if (req.url === `/repos/${REPO}/commits/gh-pages` || req.url === `/repos/${REPO}/commits/master`) return res.end(SHA);
  if (req.url === `/repos/${REPO}/tarball/${SHA}`) return res.end(tarball);
  res.writeHead(404).end();
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
test.after(() => servidor.close());
const GH_API = `http://127.0.0.1:${servidor.address().port}`;

// Assíncrono de propósito: um spawnSync travaria o GitHub falso, que roda neste mesmo processo.
function rodar(script, env) {
  return new Promise((ok) => {
    const p = spawn('bash', [script], { env: { ...process.env, ...env } });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (status) => ok({ status, stdout, stderr }));
  });
}

async function instalar(nome, comToken) {
  const dir = join(base, nome);
  await mkdir(join(dir, 'vhost'), { recursive: true });
  await writeFile(join(dir, 'vhost', 'site.conf'), 'server {\n    server_name goullartmaquinaspesadas.com.br www.goullartmaquinaspesadas.com.br;\n    root /www/antigo;\n}\n');
  if (comToken) await writeFile(join(dir, 'token'), TOKEN + '\n');
  const r = await rodar('scripts/instalar-no-servidor.sh', { GH_API, VHOST_DIR: join(dir, 'vhost'), DESTINO: join(dir, 'site'), NGINX: 'true', SEM_APP: '1', AUTOMATICO: '1', TOKEN_FILE: join(dir, 'token') });
  return { ...r, dir };
}

test('repositório público: atualiza sem token, como antes', async () => {
  exigeToken = false;
  const r = await instalar('publico', false);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(await readFile(join(r.dir, 'site', 'index.html'), 'utf8'), '<h1>site novo</h1>');
  assert.equal((await readFile(join(r.dir, 'site', '.versao'), 'utf8')).trim(), SHA);
});

test('repositório privado sem token: falha sem estragar nada', async () => {
  exigeToken = true;
  const r = await instalar('privado-sem-token', false);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /download de gh-pages falhou\. Nada foi alterado/);
  assert.ok(!existsSync(join(r.dir, 'site')));
});

test('repositório privado com token: atualiza, e o token não aparece na saída nem no endereço', async () => {
  exigeToken = true;
  pedidos.length = 0;
  const r = await instalar('privado-com-token', true);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(await readFile(join(r.dir, 'site', 'index.html'), 'utf8'), '<h1>site novo</h1>');
  assert.ok(pedidos.length >= 2 && pedidos.every((p) => p.auth === `Bearer ${TOKEN}` && !p.url.includes(TOKEN)));
  assert.ok(!(r.stdout + r.stderr).includes(TOKEN));
});

test('instalar-github-token: token recusado não grava nada; token certo fica só para o root', async () => {
  exigeToken = true;
  const arquivo = join(base, 'etc', 'goullart', 'github-token');
  const comToken = (token) => rodar('scripts/instalar-github-token.sh', { GH_API, TOKEN_FILE: arquivo, TOKEN: token });
  const errado = await comToken('github_pat_errado');
  assert.equal(errado.status, 1);
  assert.match(errado.stdout, /token recusado/);
  assert.ok(!existsSync(arquivo));
  const certo = await comToken(` ${TOKEN} \n`);
  assert.equal(certo.status, 0, certo.stdout + certo.stderr);
  assert.ok(!(certo.stdout + certo.stderr).includes(TOKEN));
  assert.equal((await readFile(arquivo, 'utf8')).trim(), TOKEN);
  assert.equal((await stat(arquivo)).mode & 0o777, 0o600);
});

test('o instalador só fala com o GitHub pela API (com token, se houver)', async () => {
  const s = await readFile('scripts/instalar-no-servidor.sh', 'utf8');
  assert.ok(!/raw\.githubusercontent|github\.com\/\$REPO\/archive/.test(s));
  assert.ok(!/curl[^\n]*\$GH_API/.test(s.replace(/gh_curl[^\n]*/g, '')));
  for (const f of ['scripts/instalar-no-servidor.sh', 'scripts/instalar-github-token.sh']) execFileSync('bash', ['-n', f]);
});
