// Cards do catálogo novo linkam a ficha completa (/maquina/<slug>.html) quando ela existe. Precisa de _site gerado (node scripts/build.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('mapa de fichas e links nos cards do catálogo gerado', { skip: !existsSync('_site/paginas-maquinas.js') && 'rode node scripts/build.mjs antes' }, () => {
  const js = readFileSync('_site/paginas-maquinas.js', 'utf8');
  const mapa = JSON.parse(js.replace(/^window\.GoullartMachinePages=/, '').replace(/;\s*$/, ''));
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
