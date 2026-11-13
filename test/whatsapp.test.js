// WhatsApp do Radar: webhook da Meta (Cloud API) com um servidor falso no lugar da Graph API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashSenha } from '../lib/auth.js';
import { lerAnuncio, dataDoAnuncio } from '../lib/whatsapp.js';

const APROVADOR = '5562900000001';
const CLIENTE = '5562911112222';
const PHONE_ID = '123456789012';
const APP_SECRET = 'ab'.repeat(16);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 7), Buffer.from([0xff, 0xd9])]);

// Graph API falsa: registra o que o servidor manda.
const enviados = [];
const graph = createServer(async (req, res) => {
  const partes = []; for await (const p of req) partes.push(p);
  const corpo = Buffer.concat(partes);
  const u = new URL(req.url, 'http://x');
  if (req.headers.authorization !== `Bearer ${'t'.repeat(40)}`) { res.writeHead(401).end('{}'); return; }
  if (req.method === 'GET' && /^\/v23\.0\/\d+$/.test(u.pathname)) { res.end(JSON.stringify({ url: `http://127.0.0.1:4329/midia/${u.pathname.split('/').pop()}`, mime_type: 'image/jpeg' })); return; }
  if (req.method === 'GET' && u.pathname === '/midia/99999') { res.writeHead(200, { 'Content-Type': 'image/png' }).end(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(300, 1)])); return; }
  if (req.method === 'GET' && u.pathname.startsWith('/midia/')) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(JPEG); return; }
  if (req.method === 'POST' && u.pathname === `/v23.0/${PHONE_ID}/media`) { enviados.push({ tipo: 'media', tamanho: corpo.length }); res.end(JSON.stringify({ id: '777' })); return; }
  if (req.method === 'POST' && u.pathname === `/v23.0/${PHONE_ID}/messages`) { enviados.push({ tipo: 'msg', ...JSON.parse(corpo) }); res.end(JSON.stringify({ messages: [{ id: 'wamid.x' }] })); return; }
  res.writeHead(404).end('{}');
});
graph.listen(4329);
await once(graph, 'listening');

const dataDir = await mkdtemp(join(tmpdir(), 'goullart-wa-'));
await writeFile(join(dataDir, 'config.json'), JSON.stringify({
  margem: 20000, segredo: 'b'.repeat(64), ...hashSenha('senha-de-teste'),
  whatsapp: { phoneNumberId: PHONE_ID, token: 't'.repeat(40), appSecret: APP_SECRET, verifyToken: 'verifica-123', aprovador: APROVADOR },
}));
// Anúncio que estava esperando quando o servidor reiniciou: tem de ser retomado.
await writeFile(join(dataDir, 'whatsapp-pendente.json'), JSON.stringify({ [APROVADOR]: { textos: ['CAMINHÃO VOLKSWAGEN 15-180\nAno 2008\nR$ 150.000\nAnápolis - GO'], midias: [] } }));
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: '4331', DATA_DIR: dataDir, WHATSAPP_API_BASE: 'http://127.0.0.1:4329', WHATSAPP_JUNTAR_MS: '300' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
await once(child.stdout, 'data');
test.after(() => { child.kill(); graph.close(); });
const base = 'http://127.0.0.1:4331';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

function payload(mensagens) {
  return { object: 'whatsapp_business_account', entry: [{ id: '1', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { display_phone_number: '556299990000', phone_number_id: PHONE_ID }, messages: mensagens } }] }] };
}
const texto = (from, body) => ({ from, id: `wamid.${++seq}`, timestamp: '1', type: 'text', text: { body } });
const foto = (from, id, caption) => ({ from, id: `wamid.${++seq}`, timestamp: '1', type: 'image', image: { id, mime_type: 'image/jpeg', ...(caption ? { caption } : {}) } });
async function postar(obj, assinar = true) {
  const corpo = JSON.stringify(obj);
  const headers = { 'Content-Type': 'application/json' };
  if (assinar) headers['X-Hub-Signature-256'] = 'sha256=' + createHmac('sha256', APP_SECRET).update(corpo).digest('hex');
  return fetch(base + '/adm/entrada/whatsapp', { method: 'POST', headers, body: corpo });
}
const radar = async () => JSON.parse(await readFile(join(dataDir, 'radar.json'), 'utf8').catch(() => '[]'));
const deere2018 = async () => (await radar()).filter((r) => r.titulo === 'ESCAVADEIRA JOHN DEERE 210G' && r.ano === '2018');
async function ate(cond, ms = 5000) { const fim = Date.now() + ms; while (Date.now() < fim) { if (await cond()) return true; await espera(100); } return false; }

const ANUNCIO = '*VENDO*\n\nESCAVADEIRA JOHN DEERE 210G\nAno 2018\nHorímetro 7.000 horas\nNF DE ORIGEM\n\n~R$400.000,00~\nR$ 250.000,00\nENTRADA R$100.000,00\n📍 Goiânia - GO\nVendedor Fulano (62) 98888-7777';

test('lê título, ano, horas, preço (sem riscado e sem entrada) e cidade do anúncio', () => {
  const a = lerAnuncio(ANUNCIO);
  assert.equal(a.titulo, 'ESCAVADEIRA JOHN DEERE 210G');
  assert.equal(a.ano, '2018');
  assert.equal(a.horas, '7.000 h');
  assert.equal(a.precoOrigem, 250000);
  assert.equal(a.local, 'Goiânia - GO');
});

test('telefone do vendedor sem formatação não entra no título', () => {
  for (const linha of ['João +55 62 99999 8888', 'Pedro 62999998888', 'Ana (62) 9 9999-8888', 'falar com Zé 62 99999-8888']) {
    const a = lerAnuncio(`ESCAVADEIRA JOHN DEERE 210G\n${linha}\nAno 2018\nR$ 250.000`);
    assert.equal(a.titulo, 'ESCAVADEIRA JOHN DEERE 210G', linha);
  }
  assert.equal(lerAnuncio('CAMINHÃO VW 31.330 6X4 2018/2019\nR$ 420.000').titulo, 'CAMINHÃO VW 31.330 6X4 2018/2019');
});

test('preço de origem nunca entra no título, em nenhum formato', () => {
  for (const linha of ['À vista R$ 250.000', 'Por apenas R$ 250.000', 'Valor: 250 mil no pix', 'Só R$250.000,00']) {
    const a = lerAnuncio(`ESCAVADEIRA JOHN DEERE 210G\n${linha}\nAno 2018`);
    assert.equal(a.titulo, 'ESCAVADEIRA JOHN DEERE 210G', linha);
    assert.doesNotMatch(a.titulo, /250/);
  }
  assert.equal(lerAnuncio('ESCAVADEIRA JOHN DEERE 210G\nÀ vista R$ 250.000').precoOrigem, 250000);
});

test('data de publicação não vira ano da máquina', () => {
  const a = lerAnuncio('ESCAVADEIRA JOHN DEERE 210G\nR$ 250.000\nPublicado em 03/11/2026');
  assert.equal(a.ano, '');
  assert.equal(a.dataAnuncio, '2026-11-03');
  assert.equal(lerAnuncio('CAMINHÃO VW 15-180 2008\nR$ 150.000').ano, '2008');
});

test('preço riscado na mesma linha não apaga o preço novo', () => {
  assert.equal(lerAnuncio('ESCAVADEIRA JOHN DEERE 210G\n~R$ 400.000~ R$ 250.000').precoOrigem, 250000);
  assert.equal(lerAnuncio('ESCAVADEIRA JOHN DEERE 210G\n~R$400.000,00~\nR$ 250.000,00').precoOrigem, 250000);
});

test('link de contato do vendedor não vira link do anúncio', () => {
  assert.equal(lerAnuncio('ESCAVADEIRA X\nR$ 1.000\nhttps://wa.me/5562999998888').link, '');
  assert.equal(lerAnuncio('ESCAVADEIRA X\nhttps://instagram.com/loja\nhttps://www.olx.com.br/anuncio/123').link, 'https://www.olx.com.br/anuncio/123');
});

test('data do anúncio vem do texto quando existe; linha de ano não conta', () => {
  const hoje = new Date('2026-11-13T15:00:00-03:00');
  assert.equal(dataDoAnuncio(['Publicado 21/10 às 12:44'], hoje), '2026-10-21');
  assert.equal(dataDoAnuncio(['Postado em 03/11/2026'], hoje), '2026-11-03');
  assert.equal(dataDoAnuncio(['ANO 08/09', 'R$ 100.000'], hoje), '');
  assert.equal(dataDoAnuncio(['20/12'], hoje), '2025-12-20'); // sem ano e no futuro: ano passado
});

test('anúncio que esperava durante um reinício é retomado', async () => {
  assert.ok(await ate(async () => enviados.some((e) => e.type === 'text' && /15-180.*sem foto real da máquina/.test(e.text.body))), 'anúncio pendente não foi retomado');
});

test('verificação da Meta só responde com o token certo', async () => {
  const ok = await fetch(base + '/adm/entrada/whatsapp?hub.mode=subscribe&hub.verify_token=verifica-123&hub.challenge=abc123');
  assert.equal(ok.status, 200); assert.equal(await ok.text(), 'abc123');
  assert.equal((await fetch(base + '/adm/entrada/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=abc')).status, 403);
});

test('mensagem sem assinatura ou com assinatura errada é recusada', async () => {
  assert.equal((await postar(payload([texto(APROVADOR, 'oi')]), false)).status, 401);
  const r = await fetch(base + '/adm/entrada/whatsapp', { method: 'POST', headers: { 'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64) }, body: '{}' });
  assert.equal(r.status, 401);
});

test('mensagem de cliente é ignorada: nada guardado, nada enviado', async () => {
  const antes = enviados.length;
  assert.equal((await postar(payload([texto(CLIENTE, ANUNCIO)]))).status, 200);
  await espera(900);
  assert.equal(enviados.length, antes);
  assert.equal((await deere2018()).length, 0);
});

let codigo;
test('anúncio encaminhado pelo aprovador vira oferta e a foto vai com o código', async () => {
  await postar(payload([foto(APROVADOR, '11111')]));
  await postar(payload([texto(APROVADOR, ANUNCIO)]));
  assert.ok(await ate(async () => enviados.some((e) => e.type === 'image')), 'foto com código não enviada');
  const msg = enviados.find((e) => e.type === 'image');
  assert.equal(msg.to, APROVADOR);
  codigo = /SIM (RADAR-\d{6}-\d{2})/.exec(msg.image.caption)[1];
  assert.match(msg.image.caption, /Origem R\$ 250\.000 · Site R\$ 270\.000/);
  const [item] = await deere2018();
  assert.equal(item.codigo, codigo);
  assert.ok(item.precoMercado > 300000, 'referência de mercado não foi guardada');
  assert.match(item.classificacao, /Quente|Boa/);
  assert.equal(item.status, 'novo');
  assert.equal(item.origemEntrada, 'whatsapp');
  assert.equal(item.fotos.length, 1);
  // Ainda não está no site.
  const cat = await (await fetch(base + '/adm/catalogo.json')).json();
  assert.ok(!cat.items.some((i) => i.price === 270000 && i.title.includes('JOHN DEERE 210G')), 'apareceu no site antes do SIM');
});

test('a mesma mensagem entregue duas vezes não repete a oferta', async () => {
  const m = texto(APROVADOR, ANUNCIO);
  await postar(payload([m])); await postar(payload([m]));
  await espera(900);
  assert.equal((await deere2018()).length, 1);
});

test('SIM com o código publica no site e confirma para o aprovador', async () => {
  await postar(payload([texto(APROVADOR, `SIM ${codigo}`)]));
  assert.ok(await ate(async () => (await deere2018())[0].status === 'publicado'));
  assert.ok(await ate(async () => enviados.some((e) => e.type === 'text' && e.text.body.includes(`${codigo} publicado`))));
  const item = (await deere2018())[0];
  assert.equal(item.precoSite, 270000);
  const cat = await (await fetch(base + '/adm/catalogo.json')).json();
  const noSite = cat.items.find((i) => i.title.includes('JOHN DEERE 210G') && i.price === 270000);
  assert.ok(noSite, 'máquina aprovada não apareceu no catálogo do site');
  // Nada privado no site: vendedor, telefone, preço de origem, link.
  assert.doesNotMatch(JSON.stringify(noSite), /98888|Fulano|250000|250\.000|Goiânia|wamid/);
});

test('SIM vindo de outro número não publica nada', async () => {
  const antes = enviados.length;
  await postar(payload([texto(CLIENTE, `SIM RADAR-000000-01`)]));
  await espera(600);
  assert.equal(enviados.length, antes);
});

test('anúncio sem cidade fica no ADM e o aprovador recebe o motivo; NÃO descarta', async () => {
  await postar(payload([foto(APROVADOR, '22222', 'ESCAVADEIRA DOOSAN DX220 LC\nAno 2023\nR$ 300.000')]));
  assert.ok(await ate(async () => enviados.some((e) => e.type === 'text' && /Não virou oferta: .*sem cidade e estado/.test(e.text.body))));
  const doosan = (await radar()).find((r) => /DOOSAN/.test(r.titulo));
  assert.equal(doosan.status, 'novo');
  assert.equal(doosan.codigo, undefined);
});

test('NÃO com o código descarta a oferta', async () => {
  // Nova oferta válida para poder recusar.
  await postar(payload([foto(APROVADOR, '33333', 'ESCAVADEIRA JOHN DEERE 210G\nAno 2017\nHorímetro 9.000 h\nR$ 240.000\nRio Verde - GO')]));
  assert.ok(await ate(async () => (await radar()).some((r) => r.codigo && r.codigo !== codigo)));
  const outro = (await radar()).find((r) => r.codigo && r.codigo !== codigo);
  await postar(payload([texto(APROVADOR, `NÃO ${outro.codigo}`)]));
  assert.ok(await ate(async () => (await radar()).find((r) => r.id === outro.id).status === 'descartado'));
});

test('código nunca se repete, mesmo depois de apagar a oferta no ADM', async () => {
  // Apaga direto do arquivo a oferta com o maior código do dia (como o botão Excluir faz).
  const lista = await radar();
  const comCodigo = lista.filter((r) => r.codigo).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const apagado = comCodigo.at(-1).codigo;
  await writeFile(join(dataDir, 'radar.json'), JSON.stringify(lista.filter((r) => r.codigo !== apagado)));
  await postar(payload([foto(APROVADOR, '44444', 'ESCAVADEIRA JOHN DEERE 200G LC\nAno 2022\nR$ 330.000\nCatalão - GO')]));
  assert.ok(await ate(async () => (await radar()).some((r) => /200G/.test(r.titulo) && r.codigo)));
  const novo = (await radar()).find((r) => /200G/.test(r.titulo));
  assert.notEqual(novo.codigo, apagado);
  assert.ok(novo.codigo > apagado);
});

test('dois anúncios encaminhados em seguida viram duas ofertas separadas', async () => {
  await postar(payload([foto(APROVADOR, '55555')]));
  await postar(payload([texto(APROVADOR, 'ESCAVADEIRA JOHN DEERE 180G\nAno 2019\nR$ 280.000\nItumbiara - GO')]));
  await postar(payload([foto(APROVADOR, '66666')]));
  await postar(payload([texto(APROVADOR, 'ESCAVADEIRA DOOSAN DX220 LC\nAno 2023\nR$ 360.000\nJataí - GO')]));
  assert.ok(await ate(async () => { const l = await radar(); return l.some((r) => /180G/.test(r.titulo)) && l.some((r) => /DOOSAN/.test(r.titulo) && /2023/.test(r.ano) && r.local === 'Jataí - GO'); }), 'anúncios não foram separados');
  const l = await radar();
  const deere = l.find((r) => /180G/.test(r.titulo));
  const doosan = l.find((r) => r.local === 'Jataí - GO');
  assert.equal(deere.titulo, 'ESCAVADEIRA JOHN DEERE 180G');
  assert.equal(deere.precoOrigem, 280000);
  assert.equal(deere.fotos.length, 1);
  assert.equal(doosan.titulo, 'ESCAVADEIRA DOOSAN DX220 LC');
  assert.equal(doosan.precoOrigem, 360000);
  assert.equal(doosan.fotos.length, 1);
});

test('fotos sem texto: o aprovador é avisado para mandar o texto', async () => {
  await postar(payload([foto(APROVADOR, '77777')]));
  assert.ok(await ate(async () => enviados.some((e) => e.type === 'text' && /foto\(s\) sem o texto do anúncio/.test(e.text.body))));
});

test('anúncio com data antiga no texto não ganha código (regra dos 15 dias)', async () => {
  await postar(payload([foto(APROVADOR, '88888', 'ESCAVADEIRA JOHN DEERE 210G\nAno 2019\nR$ 300.000\nMorrinhos - GO\nPublicado 02/01/2026')]));
  assert.ok(await ate(async () => enviados.some((e) => e.type === 'text' && /Não virou oferta: .*mais de 15 dias/.test(e.text.body))), 'anúncio antigo passou');
  const r = (await radar()).find((x) => x.local === 'Morrinhos - GO');
  assert.equal(r.codigo, undefined);
});

test('foto PNG: o motivo diz para mandar como foto, não "sem foto"', async () => {
  await postar(payload([foto(APROVADOR, '99999', 'ESCAVADEIRA JOHN DEERE 210G\nAno 2019\nR$ 300.000\nCaldas Novas - GO')]));
  assert.ok(await ate(async () => enviados.some((e) => e.type === 'text' && /foto não é JPEG/.test(e.text.body))));
});
