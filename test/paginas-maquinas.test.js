// Cards do catálogo novo linkam a ficha completa (/maquina/<slug>.html) quando ela existe. Precisa de _site gerado (node scripts/build.mjs).
import test from 'node:test';
import '../espelho/listing-policy.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { comSlugs, semVendidas, paginaCatalogo, tiposDeMaquina, SITE } from '../lib/paginas.js';

// `npm test` roda o build antes (pretest), então _site está sempre atual aqui.
const ARQUIVO_MAPA = '_site/paginas-maquinas.js';

test('mapa de fichas e links nos cards do catálogo gerado', { skip: !existsSync(ARQUIVO_MAPA) && 'rode npm test (o pretest gera o _site)' }, () => {
  const js = readFileSync(ARQUIVO_MAPA, 'utf8');
  const mapa = JSON.parse(js.replace(/^window\.GoullartMachinePages=/, '').replace(/;\s*$/, ''));
  const maquinas = comSlugs(semVendidas(JSON.parse(readFileSync('public/maquinas.json', 'utf8'))));
  const esperado = Object.fromEntries(maquinas.filter(m => m.referencia && m.slug && globalThis.GoullartCatalogData.publicavel(m))
    .map(m => [m.referencia, `/maquina/${m.slug}.html`]));
  for (const [codigo, ficha] of Object.entries({
    'GOUL-330': 'GOUL-306', 'GOUL-331': 'GOUL-307', 'GOUL-333': 'GOUL-315',
    'GOUL-316': 'GOUL-334', 'GOUL-281': 'GOUL-405',
  })) {
    if(esperado[ficha]) esperado[codigo] = esperado[ficha];
  }
  assert.deepEqual(mapa, esperado, 'cada código deve apontar para a ficha da mesma máquina');
  assert.ok(Object.keys(mapa).length > 0);
  for (const [codigo, pagina] of Object.entries(mapa)) {
    assert.match(codigo, /^(?:(?:GOUL|RADAR)-[A-Za-z0-9-]+|ROB-\d{4})$/);
    assert.ok(existsSync('_site' + pagina), `${codigo}: ${pagina} não existe`);
  }
  const categoria = readFileSync('_site/maquinas/escavadeira/index.html', 'utf8');
  assert.match(categoria, /href="\/maquina\/escavadeira-hyundai-r220lc-9-2021\.html"/);
  assert.match(categoria, /paginas-maquinas\.js/);
  assert.match(readFileSync('_site/index.html', 'utf8'), /paginas-maquinas\.js/);
});

test('catálogo e categorias compartilham a navegação e a URL definitiva do site', async () => {
  const ler = nome => readFileSync('_site/'+nome, 'utf8');
  const inicio = ler('index.html');
  const rodape = inicio.match(/<footer id="atendimento"[\s\S]*?<\/footer>/)[0];
  const paginas = [['maquinas.html', 'maquinas.html']];
  for (const rota of ['ofertas', ...(await tiposDeMaquina()).map(tipo => 'maquinas/'+tipo)]) {
    paginas.push([rota+'.html', rota+'/'], [rota+'/index.html', rota+'/']);
  }
  for (const [arquivo, canonica] of paginas) {
    const html = ler(arquivo);
    assert.ok(html.includes(rodape), arquivo);
    assert.ok(html.includes('<link rel="canonical" href="'+SITE+'/'+canonica+'">'), arquivo);
    assert.equal(html.match(/id="goullart-sidebar"/g)?.length, 1, arquivo);
    assert.equal(html.match(/class="mobile-menu-toggle"/g)?.length, 1, arquivo);
    assert.ok(html.includes('class="brand-marquee"') && html.includes('href="/?area=pecas"'), arquivo);
  }
  const catalogo = ler('maquinas.html');
  const indice = catalogo.match(/<ul class="indice-maquinas">([\s\S]*?)<\/ul>/)[1];
  const links = [...indice.matchAll(/<a href="([^"]+)">/g)].map(m => m[1]);
  const publicados = globalThis.GoullartCatalogData.feed(JSON.parse(ler('api/catalog.json'))).items
    .filter(i => i.category === 'maquinas' && globalThis.GoullartListingPolicy.eligibleListing(i));
  assert.equal(links.length, new Set(publicados.map(i => i.publicCode)).size);
  for (const link of links) {
    if (link.startsWith('/maquina/')) assert.ok(existsSync('_site'+link), link);
    else if (link.includes('/#anuncio-')) {
      const [rota, ancora] = link.split('#');
      assert.ok(ler(rota+'index.html').includes('id="'+decodeURIComponent(ancora)+'"'), link);
    } else assert.ok(publicados.some(i => link === '/?area=maquinas&amp;item='+encodeURIComponent(i.id)), link);
  }
});

test('índice usa somente a vitrine pública, preserva rotas e escapa os textos', async () => {
  const ficha = { referencia: 'GOUL-315', slug: 'exemplo' };
  const anuncio = { publicCode: 'GOUL-333', id: 'abc', category: 'maquinas', title: 'Trator teste',
    image: '/foto.jpg', publishedAt: new Date().toISOString(), location: 'Anápolis/GO' };
  const outro = { ...anuncio, publicCode: 'TESTE-2', id: 'outro', title: 'Trator <campo>' };
  const vitrine = { items: [anuncio, anuncio, outro, { ...outro, publicCode: 'NAO-PUBLICADO', privateOnly: true }] };
  const html = await paginaCatalogo([ficha, {referencia: 'SEM-VITRINE', slug:'nao-indexar'}], vitrine);
  assert.match(html, /href="\/maquina\/exemplo.html">/);
  assert.match(html, /href="\/\?area=maquinas&amp;item=outro">Trator &lt;campo&gt;/);
  assert.match(html, /Trator &lt;campo&gt; · TESTE-2/);
  assert.equal(html.match(/href="\/maquina\/exemplo.html"/g).length, 1);
  assert.doesNotMatch(html, /nao-indexar|NAO-PUBLICADO/);
  assert.doesNotMatch(await paginaCatalogo([ficha], {items: []}), /class="indice-maquinas"/);
});

test('fichas com preço sob consulta preservam a ressalva no compartilhamento e nos dados de oferta', () => {
  const fichas = JSON.parse(readFileSync('_site/fichas-maquinas.json', 'utf8'));
  const sobConsulta = fichas.filter(ficha => /^Preço (por unidade )?sob consulta$/i.test(ficha.preco));
  for (const ficha of sobConsulta) {
    const { referencia } = ficha;
    const pagina = readFileSync('_site/maquina/' + ficha.slug + '.html', 'utf8');
    const produto = JSON.parse(pagina.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    const link = pagina.match(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/)[1];
    const texto = new URL(link).searchParams.get('text');
    assert.ok(texto.includes(ficha.preco), referencia);
    assert.ok(!texto.includes('R$'), referencia);
    assert.ok(!produto.offers, referencia);
  }
});

test('comparador e simulação partem da ficha no domínio e no espelho em subdiretório', async () => {
  const base = 'https://exemplo.github.io/catalogo/';
  const ficha = readdirSync('_site/maquina').find(nome => nome.includes('hyundai-r220lc-9-2020'));
  assert.ok(ficha);
  const html = readFileSync('_site/maquina/' + ficha, 'utf8');
  const cta = html.match(/href="([^"]+)">Comparar máquinas ou simular troca/)[1];
  const consulta = new URL(cta, base + 'maquina/' + ficha);
  assert.equal(consulta.pathname, '/catalogo/consulta-maquinas.html');
  assert.equal(new URL(cta, SITE + '/maquina/' + ficha).pathname, '/consulta-maquinas.html');
  assert.equal(consulta.searchParams.get('ref'), 'GOUL-HY-2020-12000');
  const pagina = readFileSync('_site/consulta-maquinas.html', 'utf8');
  for (const [, ref] of pagina.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (ref.startsWith('/fonte-goullart.css')) continue; // Fonte global adicionada pelo build.
    assert.ok(new URL(ref, consulta).href.startsWith(base), ref);
  }
  const estado = { primeira: { options: [], replaceChildren(...v) { this.options = v; } },
    segunda: { options: [], replaceChildren(...v) { this.options = v; } }, aviso: {}, pdf: {},
    troca: {}, resultado: {}, comparacao: { tBodies: [{ replaceChildren() {}, insertRow: () => ({ append() {}, insertCell: () => ({}) }) }] } };
  for (const id of ['primeira', 'segunda', 'troca']) estado[id].addEventListener = () => {};
  const pedidos = [];
  const carregou = runInNewContext(readFileSync('_site/consulta-maquinas.js', 'utf8').replace('\ncarregar();', '\nconst testeCarregamento = carregar();') + '; testeCarregamento;', {
    document: { getElementById: id => estado[id], createElement: () => ({}) },
    location: consulta, URLSearchParams, Option: function(text, value) { this.value = value; },
    fetch: async ref => {
      const destino = new URL(ref, consulta);
      pedidos.push(destino.pathname);
      const ok = destino.pathname === '/catalogo/consulta-maquinas.json';
      return { ok, json: () => [{ referencia: 'GOUL-HY-2020-12000' }] };
    },
  });
  await carregou;
  assert.ok(pedidos.includes('/catalogo/consulta-maquinas.json'));
  assert.equal(estado.primeira.value, 'GOUL-HY-2020-12000');
  assert.equal(new URL(estado.pdf.href, consulta).pathname, '/catalogo/catalogo-maquinas.pdf');
});
