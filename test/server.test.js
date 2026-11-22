import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
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
    for (const f of m.fotos) {
      if (/^https:\/\//i.test(f)) {
        const url = new URL(f);
        assert.equal(url.protocol, 'https:');
        assert.equal(url.hostname, 'storage.maquinalista.com');
        assert.match(url.pathname, /^\/machinery-images\/[a-zA-Z0-9-]+\.jpe?g$/);
      } else {
        assert.equal((await fetch(base + '/' + f, { method: 'HEAD' })).headers.get('content-type'), 'image/jpeg');
      }
    }
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
  const item = await (await enviar(cookie, '/adm/api/radar', 'POST', { titulo: 'Escavadeira Komatsu PC200 teste', ano: '2018', precoOrigem: 'R$ 259.000', fonte: 'contato privado', fotos: ['fotos/aaaaaaaaaaaaaaaaaaaaaaaa.jpg'] })).json();
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
  const item = await (await enviar(cookie, '/adm/api/patio', 'POST', { titulo: 'Pá-carregadeira teste pátio', preco: '300000', local: 'Goiânia/GO', fotos: ['fotos/aaaaaaaaaaaaaaaaaaaaaaaa.jpg'] })).json();
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

test('Encontros incluem publicação aprovada no ADM e deixam de sugeri-la após retirada', async () => {
  const cookie = await entrar();
  const arquivos = ['crm', 'publicacoes'];
  const anteriores = await Promise.all(arquivos.map((nome) => readFile(join(dataDir, `${nome}.json`), 'utf8').catch(() => null)));
  try {
    const id = 'catalogo-encontros-teste';
    await enviar(cookie, '/adm/api/publicacoes', 'POST', { items: [{
      id, title: 'Escavadeira ZZ900 teste catálogo', price: 123000,
      image: '/assets/listings/teste.jpg', publishedAt: '2026-11-19',
    }] });
    assert.equal((await enviar(cookie, `/adm/api/publicacoes/${id}`, 'PUT', { noSite: true })).status, 200);
    await enviar(cookie, '/adm/api/crm', 'POST', { contacts: [], deals: [{
      id: 'pedido-catalogo', title: 'Escavadeira ZZ900 até R$130mil', category: 'Escavadeiras', kind: 'Compra', stage: 'Aberto',
    }] });
    const achados = async () => (await (await enviar(cookie, '/adm/api/encontros', 'GET')).json())
      .flatMap((e) => e.achados);
    assert.ok((await achados()).some((a) => a.maquina.id === id && a.maquina.preco === 'R$ 123.000'));
    assert.equal((await enviar(cookie, `/adm/api/publicacoes/${id}`, 'PUT', { noSite: false })).status, 200);
    assert.ok(!(await achados()).some((a) => a.maquina.id === id));
  } finally {
    await Promise.all(arquivos.map((nome, i) => anteriores[i] == null
      ? rm(join(dataDir, `${nome}.json`), { force: true })
      : writeFile(join(dataDir, `${nome}.json`), anteriores[i])));
  }
});

test('Radares privados mantêm pedidos abertos, inclusive enquanto aguardam oferta', async () => {
  const cookie = await entrar();
  const criar = (nome) => enviar(cookie, '/adm/api/radares', 'POST', { nome });
  const perfil = await (await criar('Perfil de teste')).json();
  assert.equal((await (await criar('Perfil de teste')).json()).id, perfil.id);
  const rota = `/adm/api/radares/${perfil.id}/pedidos`;
  const pedidos = ['p-a', 'p-b', 'p-c'].map((id) => ({ id, kind: 'Compra', stage: 'Aberto', title: 'Máquina de teste' }));
  pedidos[2].stage = 'Cancelado';
  const baseCrm = { contacts: [], deals: pedidos };
  await enviar(cookie, '/adm/api/crm', 'POST', baseCrm);
  assert.equal((await fetch(base + rota, { method: 'PUT' })).status, 401);
  const ligar = (pedidoId) => enviar(cookie, rota, 'PUT', { pedidoId });
  const respostas = await Promise.all([ligar('p-a'), ligar('p-b'), ligar('p-a')]);
  assert.ok(respostas.every((r) => r.ok));
  assert.equal((await ligar('p-c')).status, 409);
  assert.equal((await ligar('ausente')).status, 409);
  const perfis = async () => (await enviar(cookie, '/adm/api/radares', 'GET')).json();
  assert.deepEqual(new Set((await perfis()).find((r) => r.id === perfil.id).pedidoIds), new Set(['p-a', 'p-b']));
  const importar = () => enviar(cookie, '/adm/api/publicacoes', 'POST', { items: [], radars: [{ id: 'perfil-importado', name: 'Importado' }] });
  await importar();
  await enviar(cookie, '/adm/api/radares/perfil-importado/pedidos', 'PUT', { pedidoId: 'p-b' });
  await importar();
  assert.deepEqual((await perfis()).find((r) => r.id === 'perfil-importado').pedidoIds, ['p-b']);
  assert.ok((await perfis()).some((r) => r.id === perfil.id));
  assert.deepEqual((await (await enviar(cookie, rota, 'DELETE', { pedidoId: 'p-a' })).json()).pedidoIds, ['p-b']);
  const catalogo = await (await fetch(base + '/adm/catalogo.json')).text();
  assert.ok(!catalogo.includes('perfil-importado') && !catalogo.includes('pedidoIds'));
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
  const mapa = await (await fetch(base + '/sitemap.xml')).text();
  assert.match(mapa, /maquina\/escavadeira-komatsu-pc200-2018\.html/);
  assert.match(mapa, /<loc>https:\/\/www\.goullartmaquinaspesadas\.com\.br\/ofertas\/<\/loc>/);
  assert.match(mapa, /\/maquinas\/escavadeira\/<\/loc>/);
});

test('contador conta visitas e cliques, ignora repetição e referência desconhecida', async () => {
  const cookie = await entrar();
  const m = (await (await fetch(base + '/maquinas.json')).json()).find((x) => /Volvo EC220DL/.test(x.titulo));
  const contar = (ref, tipo, headers = { 'Content-Type': 'application/json' }) => fetch(base + '/api/interesse', { method: 'POST', body: JSON.stringify({ ref, tipo }), headers });
  // Outra página (formulário ou fetch sem pré-voo) não infla o contador.
  assert.equal((await contar(m.referencia, 'visita', { 'Content-Type': 'text/plain' })).status, 403);
  assert.equal((await contar(m.referencia, 'visita', { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
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

test('entrada do Radar: token, ficha interna, repetição e foto com marca d\'água fora do site', async () => {
  const cookie = await entrar();
  const oferta = (corpo, token) => fetch(base + '/adm/entrada/radar', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(corpo) });
  assert.equal((await oferta({ titulo: 'x' }, 'qualquer')).status, 503);
  const { token } = await (await enviar(cookie, '/adm/api/entrada/token', 'POST')).json();
  assert.equal((await oferta({ titulo: 'x' }, 'errado')).status, 401);

  // JPEG mínimo válido (1x1) em base64 para não depender de internet.
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const corpo = { titulo: 'Escavadeira Volvo EC220D teste radar', ano: '2019', horas: '6.000 h', precoOrigem: 300000, precoMercado: 400000,
    fonte: 'Marketplace X', link: 'https://exemplo.com/anuncio/123', contato: '62 90000-0000',
    fotos: [{ dados: jpeg }, { dados: jpeg, marcaDagua: true }] };
  const r = await oferta(corpo, token);
  assert.equal(r.status, 201);
  const criada = await r.json();
  assert.equal(criada.descontoPct, 25);
  assert.equal(criada.classificacao, 'Quente');
  const repetida = await (await oferta(corpo, token)).json();
  assert.equal(repetida.repetida, true);

  const radar = await (await enviar(cookie, '/adm/api/radar', 'GET')).json();
  const item = radar.find((x) => x.id === criada.id);
  assert.equal(item.status, 'novo');
  assert.equal(item.fotos.length, 2);
  assert.equal(item.fotosMarca.length, 1);
  // Foto de oferta ainda não publicada: só quem está logado no ADM vê; visitante recebe 404.
  assert.equal((await fetch(`${base}/${item.fotosMarca[0]}`)).status, 404);
  assert.equal((await fetch(`${base}/${item.fotosMarca[0]}`, { headers: { Cookie: cookie } })).status, 200);

  assert.equal((await enviar(cookie, `/adm/api/radar/${item.id}/publicar`, 'POST')).status, 200);
  const publica = (await (await fetch(base + '/maquinas.json')).json()).find((m) => m.titulo === corpo.titulo);
  assert.equal(publica.preco, 'R$ 320.000');
  assert.deepEqual(publica.fotos, item.fotos.filter((f) => !item.fotosMarca.includes(f)));
  for (const campo of ['fonte', 'link', 'contato', 'precoMercado', 'descontoPct', 'precoOrigem']) assert.equal(publica[campo], undefined);
  assert.equal((await fetch(base + '/adm/fontes/InterDisplay-Black.otf')).status, 200);
});

test('rental public feed preserves update dates, original photos and the publication approval gate',async()=>{
 const file=join(dataDir,'publicacoes.json');
 const published={id:'RENTAL-APPROVED',codigo:'TEST-RENTAL',titulo:'Locação teste',categoria:'locacao',noSite:true,imagens:['/assets/original-test.jpg'],publicadoEm:'2026-10-10',recebidoEm:'2026-10-10',atualizadoEm:'2026-11-01T12:00:00Z',notasPrivadas:'não divulgar',fonte:'privada'};
 const saved=JSON.stringify({itens:[published,{...published,id:'RENTAL-PENDING',noSite:false}]});
 await writeFile(file,saved);
 try{
  const feed=await (await fetch(base+'/adm/catalogo.json')).json();
  const item=feed.items.find(i=>i.id===published.id);
  assert.equal(item.updatedAt,published.atualizadoEm);assert.equal(item.publishedAt,published.publicadoEm);
  assert.equal(item.publicCode,published.codigo);assert.deepEqual(item.images,published.imagens);
  assert.ok(!feed.items.some(i=>i.id==='RENTAL-PENDING'));
  assert.equal(item.notasPrivadas,undefined);assert.equal(item.fonte,undefined);
  assert.equal(await readFile(file,'utf8'),saved);
 }finally{await rm(file,{force:true});}
});

test('Colar do ChatGPT: importa várias ofertas com as regras do Radar', async () => {
  const cookie = await entrar();
  const ofertas = [
    { titulo: 'Retroescavadeira Case 580N colada', ano: '2020', precoOrigem: 250000, precoMercado: 340000, link: 'https://exemplo.com/colar/1' },
    { titulo: 'Pá-carregadeira Caterpillar 924K colada', ano: '2019', precoOrigem: 400000, precoMercado: 420000, link: 'https://exemplo.com/colar/2' },
    { ano: '2018' },
  ];
  const r = await (await enviar(cookie, '/adm/api/radar/importar', 'POST', { ofertas })).json();
  assert.equal(r.resultados.length, 3);
  assert.equal(r.resultados[0].novo, true);
  assert.equal(r.resultados[0].classificacao, 'Quente');
  assert.equal(r.resultados[1].classificacao, 'Fraca');
  assert.ok(r.resultados[2].erro);
  const de_novo = await (await enviar(cookie, '/adm/api/radar/importar', 'POST', ofertas[0])).json();
  assert.equal(de_novo.resultados[0].novo, false);
  assert.equal((await fetch(base + '/adm/api/radar/importar', { method: 'POST', body: '{}' })).status, 401);
  const publico = await (await fetch(base + '/maquinas.json')).json();
  assert.ok(!publico.some((m) => /colada/.test(m.titulo)));
});

test('trocar senha: senha atual errada repetida é travada como no login', async () => {
  const cookie = await entrar();
  const tentativa = () => enviar(cookie, '/adm/api/senha', 'POST', { atual: 'chute', nova: 'outra-senha-bem-longa' }, { 'X-Forwarded-For': '198.51.100.9' });
  for (let i = 0; i < 5; i++) assert.equal((await tentativa()).status, 401);
  assert.equal((await tentativa()).status, 429);
  // A senha verdadeira continua valendo a partir de outro endereço.
  assert.ok(await entrar());
});

test('contador de interesse recusa corpo forjado sem erro 500', async () => {
  for (const corpo of ['{"ref":{"toString":1}}', '{"ref":"x","tipo":{"toString":1}}', '{"ref":[1,2]}']) {
    const r = await fetch(base + '/api/interesse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo });
    assert.equal(r.status, 400, corpo);
  }
});
test('página de máquina gerada pelo servidor sai com CSP e sem moldura externa', async () => {
  const m = (await (await fetch(base + '/maquinas.json')).json())[0];
  const r = await fetch(`${base}/maquina/${m.slug}.html`);
  assert.equal(r.status, 200);
  const csp = r.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'self' https:\/\/wa\.me https:\/\/api\.whatsapp\.com/); // formulário de contato abre o WhatsApp
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
});

test('lista de máquinas, sitemap e página da máquina respondem 304 quando nada mudou', async () => {
  for (const caminho of ['/maquinas.json', '/sitemap.xml']) {
    const r = await fetch(base + caminho);
    const etag = r.headers.get('etag');
    assert.ok(etag, caminho);
    await r.arrayBuffer();
    assert.equal((await fetch(base + caminho, { headers: { 'If-None-Match': etag } })).status, 304, caminho);
  }
  const m = (await (await fetch(base + '/maquinas.json')).json())[0];
  const p = await fetch(`${base}/maquina/${m.slug}`);
  assert.equal(p.status, 200);
  assert.ok(p.headers.get('content-security-policy'));
  const r304 = await fetch(`${base}/maquina/${m.slug}`, { headers: { 'If-None-Match': p.headers.get('etag') } });
  assert.equal(r304.status, 304);
});

test('cópia de segurança do ADM: só com login, sem senha nem segredo', async () => {
  assert.equal((await fetch(base + '/adm/api/backup')).status, 401);
  const cookie = await entrar();
  const r = await enviar(cookie, '/adm/api/backup', 'GET');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="goullart-adm-\d{4}-\d{2}-\d{2}\.json"/);
  const texto = await r.text();
  const dados = JSON.parse(texto);
  assert.ok(Array.isArray(dados.radar));
  assert.ok(!/segredo|"hash"|tokenEntrada|senha-de-teste/.test(texto));
});

test('foto enviada pelo ADM perde EXIF/GPS no servidor', async () => {
  const cookie = await entrar();
  const app1Dados = Buffer.concat([Buffer.from('Exif\0\0MM', 'latin1'), Buffer.from('GPS-SECRETO-PATIO'.repeat(4))]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (app1Dados.length + 2) >> 8, (app1Dados.length + 2) & 255]), app1Dados]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0]), Buffer.alloc(80, 7), Buffer.from([0xff, 0xd9])]);
  const r = await enviar(cookie, '/adm/api/fotos', 'POST', { dados: `data:image/jpeg;base64,${jpeg.toString('base64')}` });
  assert.equal(r.status, 201);
  const { foto } = await r.json();
  const salva = Buffer.from(await (await fetch(`${base}/adm/${foto}`, { headers: { Cookie: cookie } })).arrayBuffer());
  assert.equal(salva[0], 0xff);
  assert.ok(!salva.toString('latin1').includes('GPS-SECRETO'));
});

test('catálogo e lista de máquinas vão comprimidos (gzip) para quem aceita', async () => {
  const { gunzipSync } = await import('node:zlib');
  const { request } = await import('node:http');
  const pedir = (caminho, headers) => new Promise((ok, falha) => request(base + caminho, { headers }, (r) => {
    const partes = []; r.on('data', (p) => partes.push(p)); r.on('end', () => ok({ r, corpo: Buffer.concat(partes) }));
  }).on('error', falha).end());
  for (const caminho of ['/adm/catalogo.json', '/maquinas.json']) {
    const { r, corpo } = await pedir(caminho, { 'Accept-Encoding': 'gzip' });
    assert.equal(r.headers['content-encoding'], 'gzip', caminho);
    assert.match(r.headers.vary, /Accept-Encoding/);
    assert.ok(JSON.parse(gunzipSync(corpo).toString()), caminho);
    const semGzip = await pedir(caminho, {});
    assert.equal(semGzip.r.headers['content-encoding'], undefined);
    assert.ok(JSON.parse(semGzip.corpo.toString()));
  }
});

test('ADM mostra desde quando o servidor está ligado (versão em produção)', async () => {
  const cookie = await entrar();
  const r = await (await enviar(cookie, '/adm/api/resumo', 'GET')).json();
  assert.ok(r.servidor && !Number.isNaN(Date.parse(r.servidor.ligadoEm)));
  assert.ok(r.servidor.versao === null || /^[0-9a-f]{7}$/.test(r.servidor.versao));
});
