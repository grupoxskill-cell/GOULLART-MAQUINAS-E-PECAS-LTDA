// Cards do catálogo novo linkam a ficha completa (/maquina/<slug>.html) quando ela existe. Precisa de _site gerado (node scripts/build.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { comSlugs, semVendidas, paginaCatalogo, tiposDeMaquina, SITE } from '../lib/paginas.js';

// `npm test` roda o build antes (pretest), então _site está sempre atual aqui.
const ARQUIVO_MAPA = '_site/paginas-maquinas.js';

test('mapa de fichas e links nos cards do catálogo gerado', { skip: !existsSync(ARQUIVO_MAPA) && 'rode npm test (o pretest gera o _site)' }, () => {
  const js = readFileSync(ARQUIVO_MAPA, 'utf8');
  const mapa = JSON.parse(js.replace(/^window\.GoullartMachinePages=/, '').replace(/;\s*$/, ''));
  const maquinas = comSlugs(semVendidas(JSON.parse(readFileSync('public/maquinas.json', 'utf8'))));
  const esperado = Object.fromEntries(maquinas.filter(m => m.referencia && m.slug)
    .map(m => [m.referencia, `/maquina/${m.slug}.html`]));
  for (const [codigo, ficha] of Object.entries({
    'GOUL-330': 'GOUL-306', 'GOUL-331': 'GOUL-307', 'GOUL-333': 'GOUL-315',
    'GOUL-334': 'GOUL-316', 'GOUL-405': 'GOUL-281',
  })) {
    esperado[codigo] = esperado[ficha];
  }
  assert.deepEqual(mapa, esperado, 'cada código deve apontar para a ficha da mesma máquina');
  assert.ok(Object.keys(mapa).length >= 30);
  for (const [codigo, pagina] of Object.entries(mapa)) {
    assert.match(codigo, /^(?:(?:GOUL|RADAR)-[A-Za-z0-9-]+|ROB-\d{4})$/);
    assert.ok(existsSync('_site' + pagina), `${codigo}: ${pagina} não existe`);
  }
  const categoria = readFileSync('_site/maquinas/escavadeira/index.html', 'utf8');
  assert.match(categoria, /href="\/maquina\/escavadeira-john-deere-210g-2017\.html"/);
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
  const links = [...catalogo.matchAll(/<li><a href="(\/maquina\/[^"]+)">/g)].map(m => m[1]);
  assert.equal(new Set(links).size, JSON.parse(ler('maquinas.json')).length);
  assert.ok(links.every(link => existsSync('_site'+link)));
});

test('índice público aceita catálogo vazio e escapa dados de fichas do ADM', async () => {
  const vazio = await paginaCatalogo([]);
  assert.doesNotMatch(vazio, /class="indice-maquinas"/);
  const html = await paginaCatalogo([{ slug: 'exemplo', titulo: 'Trator <campo>', local: 'SP & MG' }]);
  assert.match(html, /href="\/maquina\/exemplo.html">Trator &lt;campo&gt; · SP &amp; MG<\/a>/);
});
