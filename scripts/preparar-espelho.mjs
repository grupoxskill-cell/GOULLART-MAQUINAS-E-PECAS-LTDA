// Ajusta a cópia do site do ChatGPT (espelho/) para rodar como site estático no domínio próprio.
// Uso: node scripts/preparar-espelho.mjs   (gera site-novo/)
import { cp, readdir, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ORIGEM = "https://catalogo-goullart-pesados-brasil.fitbun9.chatgpt.site";
const DOMINIO = "https://www.goullartmaquinaspesadas.com.br";
const SAIDA = "site-novo";
await rm(SAIDA, { recursive: true, force: true });
await cp("espelho", SAIDA, { recursive: true });
await rm(join(SAIDA, "cdn-cgi"), { recursive: true, force: true });
await rm(join(SAIDA, "admin"), { recursive: true, force: true });
await rm(join(SAIDA, "_relatorio.txt"), { force: true });

async function* arquivos(pasta) {
  for (const n of await readdir(pasta)) {
    const p = join(pasta, n);
    if ((await stat(p)).isDirectory()) yield* arquivos(p); else yield p;
  }
}

for await (const f of arquivos(SAIDA)) {
  if (!/\.(html|css|js|mjs|json)$/.test(f)) continue;
  let t = await readFile(f, "utf-8");
  const antes = t;
  t = t.split(ORIGEM).join(DOMINIO);
  // A revisão multimídia do curso é uma página dinâmica pública; conservar os cinco módulos na origem.
  if (f.endsWith(".html")) t = t.replace(/href="\/curso\/midia(?=[?"])/g, 'href="' + ORIGEM + '/curso/midia');
  // Script de verificação da Cloudflare do servidor do ChatGPT: não existe no domínio próprio.
  t = t.replace(/<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument[\s\S]*?<\/script>/g, "");
  // Catálogo vira arquivo estático.
  // Catálogo: primeiro o do ADM (publicações editadas lá); se o ADM não responder, a cópia estática.
  t = t.replace(/fetch\((['"])\/api\/catalog\1\s*,/g,
    "((o)=>fetch('/adm/catalogo.json',o).then((r)=>r.ok?r:Promise.reject(r)).catch(()=>fetch('/api/catalog.json',o)))(");
  // Área administrativa e de cliente do ChatGPT não existem aqui: "Administração" vai para o ADM do servidor.
  // Links de login do ChatGPT saem do site público. O ADM fica em /adm, sem link visível para visitantes.
  t = t.replace(/<a href="\/(?:admin\/login|cliente)">[^<]*<\/a>/g, "");
  t = t.replace(/href="\/admin\/login"/g, 'href="/adm"');
  if (f.endsWith("catalog.json")) {
    const d = JSON.parse(t);
    for (const i of d.items || []) delete i.sourceKey;
    t = JSON.stringify(d);
  }
  if (t !== antes) await writeFile(f, t);
}

// Páginas públicas sem extensão recebem index.html, inclusive ofertas e os 15 tipos.
const paginas = [];
for await (const f of arquivos(SAIDA)) if (f.endsWith(".html") && !f.endsWith("/index.html")) paginas.push(f);
for (const html of paginas) {
  const pasta = html.slice(0,-5);
  let texto = await readFile(html,"utf8");
  if (!/<base\b/i.test(texto)) texto = texto.replace(/<head>/i,'<head><base href="/">');
  await mkdir(pasta,{recursive:true});
  await writeFile(join(pasta,"index.html"),texto);
}
console.log("Site novo preparado em " + SAIDA + "/");
