// Gera o site estático em _site: arquivos públicos, catálogo de peças, uma página por máquina,
// sitemap.xml e robots.txt. Usado pelo GitHub Actions (branch gh-pages) e pelo servidor via cron.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { comSlugs, paginaMaquina, sitemap, SITE } from "../lib/paginas.js";

await rm("_site", { recursive: true, force: true });
await mkdir("_site/maquina", { recursive: true });
await cp("public", "_site", { recursive: true });
await cp("data/catalogo.json", "_site/catalogo.json");
await writeFile("_site/.nojekyll", "");

const maquinas = comSlugs(JSON.parse(await readFile("public/maquinas.json", "utf-8")));
await writeFile("_site/maquinas.json", JSON.stringify(maquinas, null, 1));
for (const m of maquinas) await writeFile(`_site/maquina/${m.slug}.html`, await paginaMaquina(m, maquinas));
await writeFile("_site/sitemap.xml", sitemap(maquinas));
await writeFile("_site/robots.txt", `User-agent: *\nDisallow: /adm\nDisallow: /previa-visual/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Site estático gerado em _site (${maquinas.length} páginas de máquinas)`);
