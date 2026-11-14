// CSS/JS com ?v=<resumo do conteúdo>: arquivo mudou, endereço muda; arquivo igual, endereço igual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { versionarArquivos } from '../scripts/versionar-arquivos.mjs';

async function site(css) {
  const d = await mkdtemp(join(tmpdir(), 'goullart-versao-'));
  await mkdir(join(d, 'sub'));
  await writeFile(join(d, 'estilo.css'), css);
  await writeFile(join(d, 'modelo.js'), 'export const x = 1;');
  await writeFile(join(d, 'app.js'), "import { x } from './modelo.js?v=antigo';");
  await writeFile(join(d, 'sub', 'index.html'), '<head><base href="/"><link href="/estilo.css?v=fixo"><script src="app.js"></script><script src="https://fora.com/a.js?v=1"></script></head>');
  await versionarArquivos(d);
  return { html: await readFile(join(d, 'sub', 'index.html'), 'utf8'), js: await readFile(join(d, 'app.js'), 'utf8') };
}

test('endereço do CSS/JS acompanha o conteúdo do arquivo', async () => {
  const a = await site('body{color:red}'), b = await site('body{color:red}'), c = await site('body{color:blue}');
  const versao = (h) => /estilo\.css\?v=([0-9a-f]{10})"/.exec(h)[1];
  assert.equal(versao(a.html), versao(b.html));
  assert.notEqual(versao(a.html), versao(c.html));
  assert.match(a.html, /src="app\.js\?v=[0-9a-f]{10}"/);
  assert.match(a.html, /https:\/\/fora\.com\/a\.js\?v=1/); // endereço externo fica como está
  assert.match(a.js, /from '\.\/modelo\.js\?v=[0-9a-f]{10}'/);
});

test('site gerado: todo CSS/JS local tem ?v= de conteúdo', { skip: !existsSync('_site') && 'rode node scripts/build.mjs antes' }, () => {
  const sem = [];
  for (const rel of readdirSync('_site', { recursive: true }).filter((n) => n.endsWith('.html'))) {
    for (const m of readFileSync(`_site/${rel}`, 'utf8').matchAll(/(?:href|src)="((?!https?:|\/\/|data:)[^"]+\.(?:css|js))(\?v=[^"]*)?"/g)) {
      if (!/^\?v=[0-9a-f]{10}$/.test(m[2] || '')) sem.push(`${rel}: ${m[0]}`);
    }
  }
  assert.deepEqual(sem.slice(0, 5), []);
});
