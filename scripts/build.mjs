// Gera o site estático em _site: arquivos públicos, catálogo de peças, uma página por máquina,
// sitemap.xml e robots.txt. Usado pelo GitHub Actions (branch gh-pages) e pelo servidor via cron.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { comSlugs, paginaMaquina, sitemap, tiposDeMaquina, SITE } from "../lib/paginas.js";

await rm("_site", { recursive: true, force: true });
await mkdir("_site/maquina", { recursive: true });
await cp("public", "_site", { recursive: true });
// Mapa código público -> página individual da máquina (/maquina/<slug>.html), usado pelos cards do catálogo novo.
const maquinas = comSlugs(JSON.parse(await readFile("public/maquinas.json", "utf-8")));
globalThis.GoullartMachinePagesMap = Object.fromEntries(maquinas.filter((m) => m.referencia && m.slug).map((m) => [m.referencia, `/maquina/${m.slug}.html`]));
// Layout aprovado (cópia do site do ChatGPT em espelho/) por cima dos arquivos públicos antigos.
await import("./preparar-espelho.mjs");
await cp("site-novo", "_site", { recursive: true });
await cp("data/catalogo.json", "_site/catalogo.json");
await writeFile("_site/.nojekyll", "");

await writeFile("_site/maquinas.json", JSON.stringify(maquinas, null, 1));
await writeFile("_site/paginas-maquinas.js", `window.GoullartMachinePages=${JSON.stringify(globalThis.GoullartMachinePagesMap)};\n`);
for (const m of maquinas) await writeFile(`_site/maquina/${m.slug}.html`, await paginaMaquina(m, maquinas));
// Renovar o script em todas as páginas, incluindo as copiadas de public/.
for (const path of await readdir('_site', {recursive: true})) {
  if (!path.endsWith('.html')) continue;
  const file = '_site/' + path;
  const html = await readFile(file, 'utf8');
  const updated = html.replace(/(customer-contact\.js)(?:\?v=[^"'<>\s]+)?/g, '$1?v=contato-manual-20261113');
  if (updated !== html) await writeFile(file, updated);
}
await writeFile("_site/sitemap.xml", sitemap(maquinas, await tiposDeMaquina()));
// Mesma fonte em todas as páginas: as que não vêm do espelho recebem fonte-goullart.css.
for (const rel of (await readdir("_site", { recursive: true })).filter((n) => n.endsWith(".html"))) {
  const f = `_site/${rel}`, html = await readFile(f, "utf-8");
  if (/href="\/(?:site-typography|fonte-goullart)\.css/.test(html) || !/<\/head>/i.test(html)) continue;
  await writeFile(f, html.replace(/<\/head>/i, '<link rel="stylesheet" href="/fonte-goullart.css?v=20261113"></head>'));
}
await writeFile("_site/robots.txt", `User-agent: *\nDisallow: /adm\nDisallow: /previa-visual/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Site estático gerado em _site (${maquinas.length} páginas de máquinas)`);
