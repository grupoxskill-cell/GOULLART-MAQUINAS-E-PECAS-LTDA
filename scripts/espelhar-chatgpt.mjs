// Baixa uma cópia estática do site publicado no ChatGPT (mesma origem) para a pasta "espelho/".
// Uso: node scripts/espelhar-chatgpt.mjs https://catalogo-goullart-pesados-brasil.fitbun9.chatgpt.site
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ORIGEM = new URL(process.argv[2]).origin;
const SAIDA = "espelho";
const LIMITE = 3000;
const fila = ["/", "/texas.html", "/curso", "/cursos", "/central", "/cliente"];
const vistos = new Set();
const relatorio = [];

function caminhosEm(texto, base) {
  const achados = new Set();
  // Caminhos relativos ("./x.mjs", "../y.js", "z.js?v=1") em import(), src= e href=.
  const rel = /["'`](\.{0,2}\/?[A-Za-z0-9_\-./]+\.(?:m?js|css|json|png|jpe?g|webp|svg|mp4|vtt|otf|woff2?)(?:\?[^"'`\s]*)?)["'`]/g;
  for (const m of texto.matchAll(rel)) {
    try { const u = new URL(m[1], ORIGEM + base); if (u.origin === ORIGEM) achados.add(u.pathname + u.search); } catch {}
  }
  const re = /(?:["'`(]|url\()\s*((?:https?:\/\/[^"'`)\s]+)|(?:\/[A-Za-z0-9_\-./%~@]+(?:\?[^"'`)\s]*)?))/g;
  for (const m of texto.matchAll(re)) {
    let p = m[1];
    if (p.startsWith("http")) { try { const u = new URL(p); if (u.origin !== ORIGEM) continue; p = u.pathname + u.search; } catch { continue; } }
    if (p.startsWith("//")) continue;
    achados.add(p);
  }
  return achados;
}

function arquivoLocal(pathname, tipo) {
  let p = decodeURIComponent(pathname.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  else if (!/\.[a-z0-9]{1,5}$/i.test(p)) p += tipo.includes("json") ? ".json" : tipo.includes("html") ? ".html" : "";
  return join(SAIDA, p.replace(/^\/+/, ""));
}

while (fila.length && vistos.size < LIMITE) {
  const p = fila.shift();
  const chave = p.split("#")[0];
  if (vistos.has(chave)) continue;
  vistos.add(chave);
  let r;
  try { r = await fetch(ORIGEM + chave, { redirect: "follow" }); } catch (e) { relatorio.push(`ERRO ${chave} ${e.message}`); continue; }
  const tipo = r.headers.get("content-type") || "";
  relatorio.push(`${r.status} ${tipo.split(";")[0]} ${chave}`);
  if (!r.ok) continue;
  const buf = Buffer.from(await r.arrayBuffer());
  const destino = arquivoLocal(chave, tipo);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, buf);
  if (/html|css|javascript|json|text/.test(tipo)) {
    for (const novo of caminhosEm(buf.toString("utf-8"), chave)) if (!vistos.has(novo.split("#")[0])) fila.push(novo);
  }
}
await writeFile(join(SAIDA, "_relatorio.txt"), relatorio.join("\n") + "\n");
console.log(`Baixados ${vistos.size} caminhos`);
