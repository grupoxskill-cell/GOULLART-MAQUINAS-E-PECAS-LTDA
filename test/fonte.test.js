// Toda página pública usa a fonte da GOULLART (Montserrat), inclusive as que não vêm do espelho.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

test('todas as páginas do site carregam a fonte Montserrat da GOULLART', { skip: !existsSync('_site') && 'rode node scripts/build.mjs antes' }, () => {
  const sem = readdirSync('_site', { recursive: true }).filter((n) => n.endsWith('.html'))
    .filter((n) => { const h = readFileSync(`_site/${n}`, 'utf8'); return /<\/head>/i.test(h) && !/href="\/(?:site-typography|fonte-goullart)\.css/.test(h); });
  assert.deepEqual(sem, []);
  assert.match(readFileSync('_site/fonte-goullart.css', 'utf8'), /montserrat-latin-variable\.woff2/);
  assert.match(readFileSync('adm/app.css', 'utf8'), /font-family: "Montserrat GOULLART"/);
});
