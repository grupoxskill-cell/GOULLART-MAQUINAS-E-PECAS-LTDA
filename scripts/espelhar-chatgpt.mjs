// Exporta apenas páginas e recursos públicos do catálogo para o domínio próprio.
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const ORIGEM = new URL(process.argv[2]).origin;
const SAIDA = "espelho";
const LIMITE = 3000;
const obrigatorios = ["/", "/texas", "/texas.html", "/curso", "/cursos", "/central", "/ofertas", "/maquinas/escavadeira", "/maquinas/pa-carregadeira", "/api/catalog"];
const fila = [...obrigatorios];
const vistos = new Set(), baixados = new Set(), relatorio = [];
const tipos = new Set(["pa-carregadeira","retroescavadeira","escavadeira","motoniveladora","trator-agricola","rolo-compactador","mini-carregadeira","tesoura","articulada","telescopica","elevador-pessoal","pipa","basculante","comboio","munck"]);
for (const t of tipos) fila.push("/maquinas/" + t);

function publico(caminho) {
  const u = new URL(caminho, ORIGEM);
  if (u.origin !== ORIGEM) return false;
  let p;
  try { p = decodeURIComponent(u.pathname); } catch { return false; }
  if (p.split("/").some(s => s === ".." || s.startsWith("."))) return false;
  if (/^\/(?:admin|adm|cliente|api\/(?:admin|customer|checkout|payment|curso)|cdn-cgi)(?:\/|$)/i.test(p)) return false;
  if (p.startsWith("/api/")) return p === "/api/catalog";
  if (obrigatorios.includes(p)) return true;
  if (p.startsWith("/maquinas/")) return tipos.has(p.slice(10));
  return /\.(?:m?js|css|json|png|jpe?g|webp|gif|ico|svg|mp4|webm|vtt|otf|ttf|woff2?)$/i.test(p);
}
function caminhosEm(texto, base) {
  const achados = new Set();
  const rel = /["'\x60](\.{0,2}\/?[A-Za-z0-9_\-./]+\.(?:m?js|css|json|png|jpe?g|webp|gif|ico|svg|mp4|webm|vtt|otf|ttf|woff2?)(?:\?[^"'\x60\s]*)?)["'\x60]/g;
  for (const m of texto.matchAll(rel)) {
    try { const u = new URL(m[1], ORIGEM + base); if (publico(u.href)) achados.add(u.pathname + u.search); } catch {}
  }
  const re = /(?:["'\x60(]|url\()\s*((?:https?:\/\/[^"'\x60)\s]+)|(?:\/[A-Za-z0-9_\-./%~@]+(?:\?[^"'\x60)\s]*)?))/g;
  for (const m of texto.matchAll(re)) {
    try { const u = new URL(m[1], ORIGEM + base); if (publico(u.href)) achados.add(u.pathname + u.search); } catch {}
  }
  return achados;
}
function arquivoLocal(pathname, tipo) {
  let p = decodeURIComponent(pathname);
  if (p.endsWith("/")) p += "index.html";
  else if (!/\.[a-z0-9]{1,5}$/i.test(p)) p += tipo.includes("json") ? ".json" : tipo.includes("html") ? ".html" : "";
  return join(SAIDA, p.replace(/^\/+/, ""));
}
function limparCatalogo(d) {
  const privados = new Set(["sourceKey","privateNotes","notasPrivadas","precoOrigem","cost","custo","supplier","fornecedor"]);
  if (Array.isArray(d)) return d.map(limparCatalogo);
  if (d && typeof d === "object") return Object.fromEntries(Object.entries(d).filter(([k]) => !privados.has(k)).map(([k,v]) => [k, limparCatalogo(v)]));
  return d;
}
await rm(SAIDA, {recursive:true, force:true});
await mkdir(SAIDA, {recursive:true});
while (fila.length && vistos.size < LIMITE) {
  const chave = fila.shift().split("#")[0];
  if (vistos.has(chave) || !publico(chave)) continue;
  vistos.add(chave);
  try {
    const r = await fetch(ORIGEM + chave, {redirect:"follow", signal:AbortSignal.timeout(120000)});
    const tipo = r.headers.get("content-type") || "";
    relatorio.push(r.status + " " + tipo.split(";")[0] + " " + chave);
    if (!r.ok || new URL(r.url).origin !== ORIGEM) continue;
    const pathname = new URL(ORIGEM + chave).pathname;
    let buf = Buffer.from(await r.arrayBuffer());
    if (pathname === "/api/catalog") {
      if (!tipo.includes("json")) throw Error("O catálogo público não retornou JSON");
      const d = limparCatalogo(JSON.parse(buf.toString("utf8")));
      if (!Array.isArray(d.items)) throw Error("Catálogo sem lista pública de itens");
      buf = Buffer.from(JSON.stringify(d));
    }
    const destino = arquivoLocal(pathname,tipo);
    await mkdir(dirname(destino),{recursive:true});
    await writeFile(destino,buf);
    baixados.add(pathname);
    if (/html|css|javascript|json|text/.test(tipo))
      for (const novo of caminhosEm(buf.toString("utf8"),pathname)) if (!vistos.has(novo)) fila.push(novo);
  } catch(e) { relatorio.push("ERRO " + chave + " " + e.message); }
}
await writeFile(join(SAIDA,"_relatorio.txt"),relatorio.join("\n")+"\n");
const ausentes = [...obrigatorios,...[...tipos].map(t=>"/maquinas/"+t)].filter(p=>!baixados.has(p));
if (ausentes.length) throw Error("Exportação incompleta: " + ausentes.join(", "));
if (fila.length) throw Error("Exportação excedeu o limite de caminhos");
console.log("Exportação pública concluída: " + baixados.size + " caminhos");
