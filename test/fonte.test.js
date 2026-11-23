// Toda página pública usa a fonte da GOULLART (Montserrat), inclusive as que não vêm do espelho.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

test('todas as páginas do site carregam a fonte Montserrat da GOULLART', { skip: !existsSync('_site') && 'rode node scripts/build.mjs antes' }, () => {
  for (const pagina of readdirSync('_site', { recursive: true }).filter(n => n.endsWith('.html'))) {
    const html = readFileSync(`_site/${pagina}`, 'utf8');
    if (!/<\/head>/i.test(html)) continue;
    const endereco = new URL(pagina, 'https://exemplo.test/');
    const base = html.match(/<base\b[^>]*\bhref=["']([^"']+)["']/i)?.[1];
    const fontes = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)]
      .map(([, href]) => new URL(href, base ? new URL(base, endereco) : endereco))
      .filter(url => /\/(?:site-typography|fonte-goullart)\.css$/.test(url.pathname));
    assert.equal(fontes.length, 1, `${pagina}: carregar uma única folha de fonte`);
    assert.equal(fontes[0].origin, endereco.origin, pagina);
    assert.ok(existsSync('_site' + fontes[0].pathname), `${pagina}: ${fontes[0].pathname}`);
  }
  assert.match(readFileSync('_site/fonte-goullart.css', 'utf8'), /montserrat-latin-variable\.woff2/);
  assert.match(readFileSync('adm/app.css', 'utf8'), /font-family: "Montserrat GOULLART"/);
});
