// Cards do catálogo novo linkam a ficha completa (/maquina/<slug>.html) quando ela existe. Precisa de _site gerado (node scripts/build.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { comSlugs } from '../lib/paginas.js';

// _site desatualizado (gerado antes de mudar catálogo ou layout) dava falha falsa: regera quando preciso.
const ARQUIVO_MAPA = '_site/paginas-maquinas.js';
const desatualizado = () => !existsSync(ARQUIVO_MAPA) || ['public/maquinas.json', 'espelho/api/catalog.json', 'scripts/build.mjs', 'scripts/build-catalog-pages.mjs', 'lib/paginas.js']
  .some((f) => existsSync(f) && statSync(f).mtimeMs > statSync(ARQUIVO_MAPA).mtimeMs);
if (desatualizado()) execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'pipe' });

test('mapa de fichas e links nos cards do catálogo gerado', () => {
  const js = readFileSync(ARQUIVO_MAPA, 'utf8');
  const mapa = JSON.parse(js.replace(/^window\.GoullartMachinePages=/, '').replace(/;\s*$/, ''));
  const maquinas = comSlugs(JSON.parse(readFileSync('public/maquinas.json', 'utf8')));
  const esperado = Object.fromEntries(maquinas.filter(m => m.referencia && m.slug)
    .map(m => [m.referencia, `/maquina/${m.slug}.html`]));
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
