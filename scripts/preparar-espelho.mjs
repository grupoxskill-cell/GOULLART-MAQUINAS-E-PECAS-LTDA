// Ajusta a cópia do site do ChatGPT (espelho/) para rodar como site estático no domínio próprio.
// Uso: node scripts/preparar-espelho.mjs   (gera site-novo/)
import { cp, readdir, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ORIGEM = "https://catalogo-goullart-pesados-brasil.fitbun9.chatgpt.site";
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
  t = t.split(ORIGEM).join("");
  // Script de verificação da Cloudflare do servidor do ChatGPT: não existe no domínio próprio.
  t = t.replace(/<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument[\s\S]*?<\/script>/g, "");
  // Catálogo vira arquivo estático.
  // Catálogo: primeiro o do ADM (publicações editadas lá); se o ADM não responder, a cópia estática.
  t = t.replace(/fetch\((['"])\/api\/catalog\1\s*,/g,
    "((o)=>fetch('/adm/catalogo.json',o).then((r)=>r.ok?r:Promise.reject(r)).catch(()=>fetch('/api/catalog.json',o)))(");
  // Área administrativa e de cliente do ChatGPT não existem aqui: "Administração" vai para o ADM do servidor.
  t = t.replace(/href="\/admin\/login"/g, 'href="/adm"');
  if (f.endsWith("catalog.json")) {
    const d = JSON.parse(t);
    for (const i of d.items || []) delete i.sourceKey;
    t = JSON.stringify(d);
  }
  if (t !== antes) await writeFile(f, t);
}

// Endereços sem extensão (/curso, /cursos, /central, /cliente) viram pastas com index.html,
// que o nginx e o GitHub Pages servem sem configuração extra.
for (const pagina of ["curso", "cursos", "central", "cliente"]) {
  const html = join(SAIDA, `${pagina}.html`);
  try { await stat(html); } catch { continue; }
  await mkdir(join(SAIDA, pagina), { recursive: true });
  await cp(html, join(SAIDA, pagina, "index.html"));
}
console.log(`Site novo preparado em ${SAIDA}/`);
