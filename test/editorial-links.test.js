import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const official = 'https://www.goullartmaquinaspesadas.com.br/';
const pages = 'https://grupoxskill-cell.github.io/GOULLART-MAQUINAS-E-PECAS-LTDA/';
const editorial = /^(noticias|noticia-.+|guia-.+|giro-.+)\.html$/;
const anchors = (html) => Array.from(html.matchAll(/<a\b[^>]*\shref\s*=\s*(["'])(.*?)\1/gi), (match) => match[2]);

test('navigation between editorial siblings stays under the Pages prefix', () => {
  for (const directory of ['public', '_site']) {
    const files = readdirSync(directory).filter((name) => editorial.test(name));
    assert.ok(files.includes('noticias.html') && files.includes('giro-2026-11-23.html'));
    const known = new Set([...readdirSync('public').filter((name) => extname(name) === '.html'), 'sitemap.xml']);
    for (const file of files) {
      const html = readFileSync(join(directory, file), 'utf8');
      assert.ok(html.includes(`href="${official}${file}"`), `${file}: preserve the official canonical URL`);
      for (const href of anchors(html)) {
        if (href.startsWith('//') || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) continue;
        const target = new URL(href, new URL(file, official));
        const name = basename(target.pathname);
        if (target.pathname !== '/' && (dirname(target.pathname) !== '/' || !known.has(name))) continue;
        const mirror = new URL(href, new URL(file, pages));
        assert.equal(mirror.href, new URL('.' + target.pathname + target.search + target.hash, pages).href, `${file}: ${href}`);
        if (directory === '_site' && name) assert.ok(existsSync(join(directory, name)), `${file}: ${href}`);
      }
    }
    const links = (file) => anchors(readFileSync(join(directory, file), 'utf8'));
    assert.ok(links('noticias.html').includes('./giro-2026-11-23.html'));
    assert.ok(links('noticias.html').includes('./noticia-cotacao-rodante-hyundai.html'));
    assert.ok(links('giro-2026-11-23.html').some((href) => new URL(href, pages).href === new URL('noticias.html', pages).href));
    assert.ok(links('noticia-cotacao-rodante-hyundai.html').includes('./guia-pecas-locacao.html'));
  }
});
