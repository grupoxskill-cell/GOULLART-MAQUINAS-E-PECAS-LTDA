// Falhas encontradas na revisão de 04/11/2026: queda do servidor, limite de login e sessões antigas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashSenha, ipCliente, ehCloudflare } from '../lib/auth.js';

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

test('senhas erradas em paralelo não passam do limite de 5 por IP', async () => {
  const tentativas = Array.from({ length: 20 }, () => fetch(base + '/adm/api/entrar', { method: 'POST', headers: { 'X-Forwarded-For': '9.9.9.9' }, body: JSON.stringify({ senha: 'errada' }) }).then((r) => r.status));
  const codigos = await Promise.all(tentativas);
  assert.equal(codigos.filter((c) => c === 401).length, 5);
  assert.equal(codigos.filter((c) => c === 429).length, 15);
});

test('senha certa não gasta tentativa: o dono entra várias vezes seguidas', async () => {
  for (let i = 0; i < 7; i++) {
    const r = await fetch(base + '/adm/api/entrar', { method: 'POST', headers: { 'X-Forwarded-For': '8.8.4.4' }, body: JSON.stringify({ senha: 'senha-de-teste' }) });
    assert.equal(r.status, 200);
  }
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

test('foto do Radar não baixa de endereço interno, nem por nome que aponta para ele', async () => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'goullart-foto-'));
  const { receberOferta } = await import('../lib/radar-entrada.js');
  for (const url of ['https://localhost/x.jpg', 'https://127.0.0.1/x.jpg', 'https://[::ffff:7f00:1]/x.jpg', 'http://exemplo.com/x.jpg', 'file:///etc/passwd']) {
    const { item } = await receberOferta({ titulo: 'Teste', categoria: 'Escavadeiras', link: `https://exemplo.com/${Math.random()}`, fotos: [{ url }] }, []);
    assert.equal(item.fotos.length, 0, url);
    assert.ok(item.avisos.some((a) => /foto/i.test(a)), url);
  }
});

test('link do anúncio só aceita http/https', async () => {
  const { receberOferta } = await import('../lib/radar-entrada.js');
  const { item } = await receberOferta({ titulo: 'Teste', categoria: 'Escavadeiras', link: 'javascript:alert(1)' }, []);
  assert.equal(item.link, '');
});

test('cópia do ChatGPT recusa copiar o próprio domínio', async () => {
  const p = spawn(process.execPath, ['scripts/espelhar-chatgpt.mjs', 'https://www.goullartmaquinaspesadas.com.br'], { stdio: 'ignore' });
  const [codigo] = await once(p, 'exit');
  assert.equal(codigo, 1);
});

test('máquina do Radar publicada pelo repositório aparece na vitrine da página inicial', async () => {
  const r = await fetch(base + '/adm/catalogo.json');
  assert.equal(r.status, 200);
  const { items } = await r.json();
  const pc200 = items.find((i) => i.publicCode === 'RADAR-PC200-2018');
  assert.ok(pc200, 'RADAR-PC200-2018 deveria estar no feed');
  assert.equal(pc200.category, 'maquinas');
  assert.equal(pc200.price, 259000);
  assert.equal(pc200.image, '/maquinas/radar-komatsu-pc200-2018-1.jpg');
  assert.equal(pc200.publishedAt, '2026-10-22');
});

// Revisão de segurança de 05/11/2026.
async function entrar(b, senha = 'senha-de-teste') {
  const r = await fetch(b + '/adm/api/entrar', { method: 'POST', body: JSON.stringify({ senha }) });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('corpo que não é objeto (null, número) dá 400, não 500', async () => {
  const cookie = await entrar(base);
  for (const corpo of ['null', '5', '"x"']) {
    const r = await fetch(base + '/adm/api/config', { method: 'PUT', headers: { Cookie: cookie, Origin: base }, body: corpo });
    assert.equal(r.status, 400, corpo);
  }
  assert.ok(await vivo());
});

test('token do Radar só vale no cabeçalho, nunca na URL', async () => {
  const cookie = await entrar(base);
  const { token } = await (await fetch(base + '/adm/api/entrada/token', { method: 'POST', headers: { Cookie: cookie, Origin: base } })).json();
  const naUrl = await fetch(`${base}/adm/entrada/radar?token=${token}`, { method: 'POST', body: JSON.stringify({ titulo: 'X', categoria: 'Escavadeiras' }) });
  assert.equal(naUrl.status, 401);
  const noCabecalho = await fetch(`${base}/adm/entrada/radar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ titulo: 'Escavadeira teste', categoria: 'Escavadeiras', link: 'https://exemplo.com/a1' }) });
  assert.equal(noCabecalho.status, 201);
});

test('sair derruba a sessão em todos os navegadores', async () => {
  const a = await entrar(base), b = await entrar(base);
  assert.equal((await fetch(base + '/adm/api/resumo', { headers: { Cookie: b } })).status, 200);
  assert.equal((await fetch(base + '/adm/api/sair', { method: 'POST', headers: { Cookie: a, Origin: base } })).status, 200);
  assert.equal((await fetch(base + '/adm/api/resumo', { headers: { Cookie: a } })).status, 401);
  assert.equal((await fetch(base + '/adm/api/resumo', { headers: { Cookie: b } })).status, 401);
});

test('catálogo público responde 304 quando nada mudou', async () => {
  const r1 = await fetch(base + '/adm/catalogo.json');
  const etag = r1.headers.get('etag');
  assert.ok(etag);
  const r2 = await fetch(base + '/adm/catalogo.json', { headers: { 'If-None-Match': etag } });
  assert.equal(r2.status, 304);
});

test('máquina do Radar sem arte nem foto não publica', async () => {
  const cookie = await entrar(base);
  const criado = await (await fetch(base + '/adm/api/radar', { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: JSON.stringify({ titulo: 'Pá sem foto', categoria: 'Pás-carregadeiras', precoOrigem: 100000 }) })).json();
  const r = await fetch(`${base}/adm/api/radar/${criado.id}/publicar`, { method: 'POST', headers: { Cookie: cookie, Origin: base } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).erro, /foto/i);
});

test('token do Radar fica só como hash no servidor e aparece uma única vez', async () => {
  const cookie = await entrar(base);
  const { token } = await (await fetch(base + '/adm/api/entrada/token', { method: 'POST', headers: { Cookie: cookie, Origin: base } })).json();
  const cfg = JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8'));
  assert.ok(!JSON.stringify(cfg).includes(token), 'o token em texto puro não pode estar em config.json');
  assert.match(cfg.tokenEntradaHash, /^[a-f0-9]{64}$/);
  const info = await (await fetch(base + '/adm/api/entrada', { headers: { Cookie: cookie } })).json();
  assert.equal(info.token, ''); assert.equal(info.ligada, true);
  const r = await fetch(`${base}/adm/entrada/radar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ titulo: 'Escavadeira hash', categoria: 'Escavadeiras', link: 'https://exemplo.com/h1' }) });
  assert.equal(r.status, 201);
});

test('senha antiga (custo padrão) continua entrando e a nova é gravada com custo maior', async () => {
  const { hashSenha, senhaConfere, CUSTO_SENHA } = await import('../lib/auth.js');
  const antiga = { sal: 'ab'.repeat(8), hash: hashSenha('minha-senha', 'ab'.repeat(8), 2 ** 14).hash }; // sem "custo", como as configs antigas
  assert.equal(await senhaConfere('minha-senha', antiga), true);
  assert.equal(await senhaConfere('outra', antiga), false);
  const nova = hashSenha('minha-senha');
  assert.equal(nova.custo, CUSTO_SENHA);
  assert.equal(await senhaConfere('minha-senha', nova), true);
  assert.equal(await senhaConfere('x', { sal: 'a', hash: 'zz' }), false);
});

test('cabeçalhos de proteção: CSP no painel, DENY de frame em tudo e HSTS atrás de HTTPS', async () => {
  const painel = await fetch(base + '/adm/');
  assert.match(painel.headers.get('content-security-policy') || '', /default-src 'self'/);
  assert.match(painel.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.equal(painel.headers.get('x-frame-options'), 'DENY');
  assert.equal(painel.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(base + '/maquinas.json')).headers.get('strict-transport-security'), null, 'sem HTTPS não manda HSTS');
  const https_ = await fetch(base + '/maquinas.json', { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.match(https_.headers.get('strict-transport-security') || '', /max-age=31536000/);
  const html = await (await fetch(base + '/adm/')).text();
  assert.ok(!/<script(?![^>]*\bsrc=)/.test(html) && !/<style/.test(html) && !/ style="/.test(html), 'painel não pode ter script/estilo embutido (CSP estrita)');
});

test('resumo do ADM lista as máquinas há mais de 30 dias no site', async () => {
  const cookie = await entrar(base);
  const r = await (await fetch(base + '/adm/api/resumo', { headers: { Cookie: cookie } })).json();
  assert.ok(Array.isArray(r.envelhecidas));
  const d51 = r.envelhecidas.find((m) => m.codigo === 'GOUL-293');
  assert.ok(d51, 'a D51 publicada em 17/09 deveria constar como envelhecida');
  assert.ok(d51.dias > 30);
  assert.ok(r.envelhecidas.every((m) => m.dias > 30 && m.codigo && m.titulo));
  assert.ok(!r.envelhecidas.some((m) => m.codigo === 'GOUL-291'), 'vendida não entra');
});

test('máquina do Radar publicada no ADM com preço de mercado vira oferta verificada no catálogo público', async () => {
  const cookie = await entrar(base);
  const foto = 'fotos/' + 'b'.repeat(24) + '.jpg';
  const criado = await (await fetch(base + '/adm/api/radar', { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: JSON.stringify({ titulo: 'Escavadeira Sany SY215C oferta', categoria: 'Escavadeiras', precoOrigem: 319000, fotos: [foto] }) })).json();
  await fetch(`${base}/adm/api/radar/${criado.id}`, { method: 'PUT', headers: { Cookie: cookie, Origin: base }, body: JSON.stringify({ precoMercado: 490000 }) });
  assert.equal((await fetch(`${base}/adm/api/radar/${criado.id}/publicar`, { method: 'POST', headers: { Cookie: cookie, Origin: base } })).status, 200);
  const { items } = await (await fetch(base + '/adm/catalogo.json')).json();
  const oferta = items.find((i) => i.title.startsWith('Escavadeira Sany SY215C oferta'));
  assert.ok(oferta, 'publicada deveria estar no catálogo');
  assert.equal(oferta.price, 339000);
  assert.deepEqual({ ...oferta.offer, reviewedAt: undefined }, { verified: true, price: 339000, referencePrice: 490000, discountPercent: 31, reviewedAt: undefined });
  assert.ok(!JSON.stringify(oferta).includes('319000'), 'preço de origem não sai no catálogo público');
});

test('auditoria: login, senha errada e ações ficam registrados só com IP, hora e alvo', async () => {
  await fetch(base + '/adm/api/entrar', { method: 'POST', body: JSON.stringify({ senha: 'errada-de-proposito' }) });
  const cookie = await entrar(base);
  const r = await (await fetch(base + '/adm/api/resumo', { headers: { Cookie: cookie } })).json();
  assert.ok(Array.isArray(r.acessos) && r.acessos.length >= 2);
  assert.equal(r.acessos[0].tipo, 'login');
  assert.ok(r.acessos.some((a) => a.tipo === 'login_falhou'));
  assert.ok(r.acessos.every((a) => a.ip && a.em && !('senha' in a) && !('cookie' in a)));
  const bruto = await readFile(join(dataDir, 'auditoria.json'), 'utf8');
  assert.ok(!bruto.includes('senha-de-teste') && !bruto.includes('errada-de-proposito'), 'senha nunca vai para a auditoria');
  const { mode } = await (await import('node:fs/promises')).stat(join(dataDir, 'auditoria.json'));
  assert.equal(mode & 0o777, 0o600);
});

test('sessão: cookie no formato antigo não vale e cookie parado há mais de 2 horas expira', async () => {
  const { lerSessao, criarCookie } = await import('../lib/auth.js');
  const segredo = 'e'.repeat(64);
  assert.equal(lerSessao({ headers: { cookie: `adm=${Date.now() + 3600000}.${'a'.repeat(64)}` } }, segredo), null, 'formato antigo (2 partes)');
  const novo = criarCookie(segredo, true).split(';')[0];
  const s = lerSessao({ headers: { cookie: novo } }, segredo);
  assert.ok(s && s.expiraAbsoluto > Date.now() && Date.now() - s.ultimaAtividade < 5000);
  assert.match(criarCookie(segredo, true), /Max-Age=7(1|2)\d\d;/, 'Max-Age de ~2 h (inatividade), não 12 h');
  const [exp, ult, ass] = novo.replace('adm=', '').split('.');
  assert.equal(lerSessao({ headers: { cookie: `adm=${exp}.${Number(ult) - 3 * 3600000}.${ass}` } }, segredo), null, 'alterar a hora quebra a assinatura');
  assert.equal((await fetch(base + '/adm/api/resumo', { headers: { Cookie: `adm=${Date.now() + 3600000}.${'a'.repeat(64)}` } })).status, 401);
});

test('IP real do visitante atrás do Cloudflare, sem aceitar cabeçalho forjado', () => {
  const viaNginx = (headers) => ipCliente({ headers, socket: { remoteAddress: '127.0.0.1' } });
  assert.equal(ehCloudflare('172.70.1.2'), true);
  assert.equal(ehCloudflare('2606:4700:10::1'), true);
  assert.equal(ehCloudflare('200.1.2.3'), false);
  // Veio do Cloudflare: vale o CF-Connecting-IP.
  assert.equal(viaNginx({ 'x-forwarded-for': '189.5.5.5, 172.70.1.2', 'cf-connecting-ip': '189.5.5.5' }), '189.5.5.5');
  // Veio direto (sem Cloudflare): o CF-Connecting-IP é forjado e é ignorado.
  assert.equal(viaNginx({ 'x-forwarded-for': '200.1.2.3', 'cf-connecting-ip': '9.9.9.9' }), '200.1.2.3');
  // Conexão que não passou pelo nginx local: cabeçalhos não valem.
  assert.equal(ipCliente({ headers: { 'x-forwarded-for': '9.9.9.9' }, socket: { remoteAddress: '203.0.113.7' } }), '203.0.113.7');
});
