// Site GOULLART: catálogo e contato humano. A IA permanece desativada.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { rotaAdm, servirFoto, maquinasPublicas } from "./lib/adm.js";
import { paginaMaquina, sitemap } from "./lib/paginas.js";
import { registrar } from "./lib/interesse.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || undefined;
const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));
const loadJson = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf-8"));
const EMPRESA = await loadJson("./data/empresa.json");
const CATALOGO = await loadJson("./data/catalogo.json");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon" };

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function serveStatic(req, res, pathname) {
  const filePath = resolve(PUBLIC_DIR, `.${pathname === "/" ? "/index.html" : pathname}`);
  const within = relative(PUBLIC_DIR, filePath);
  if (within.startsWith("..") || isAbsolute(within) || within.split(/[\\/]/).some((part) => part.startsWith("."))) {
    res.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Página não encontrada");
  }
}

async function servirPaginaMaquina(req, res, slug) {
  const todas = await maquinasPublicas();
  const m = todas.find((x) => x.slug === slug);
  if (!m) return res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Máquina não encontrada");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
  res.end(req.method === "HEAD" ? undefined : await paginaMaquina(m, todas));
}

async function contarInteresse(req, res) {
  let corpo = "";
  for await (const parte of req) { corpo += parte; if (corpo.length > 1024) return res.writeHead(413).end(); }
  let dados;
  try { dados = JSON.parse(corpo); } catch { return res.writeHead(400).end(); }
  const refs = new Map((await maquinasPublicas()).map((m) => [m.referencia, m.titulo]));
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const ok = registrar(String(dados?.ref || ""), String(dados?.tipo || ""), ip, refs);
  res.writeHead(ok ? 204 : 400).end();
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { return sendJson(res, 400, { error: "Endereço inválido." }); }

  // Bloqueio permanente nesta versão, inclusive se existir uma chave no ambiente.
  // A retomada da IA exige nova alteração de código e autorização de Júnior.
  if (pathname.replace(/\/+$/, "") === "/api/chat") {
    return sendJson(res, 410, { code: "AUTOMATED_CHAT_DISABLED", automaticReplies: false,
      message: "O atendimento deste site é realizado pela equipe no WhatsApp.",
      whatsapp: `https://wa.me/${EMPRESA.whatsapp}` });
  }
  // ADM privado (login próprio) e fotos enviadas pelo ADM.
  if (pathname === "/adm" || pathname.startsWith("/adm/")) return rotaAdm(req, res, pathname);
  if (pathname === "/api/interesse" && req.method === "POST") return contarInteresse(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.writeHead(405).end();
  }
  if (pathname === "/health") return sendJson(res, 200, { ok: true, automaticReplies: false, atendimento: "humano" });
  if (pathname === "/api/empresa") return sendJson(res, 200, EMPRESA);
  if (pathname.startsWith("/fotos/")) return servirFoto(res, pathname);
  // Catálogo do site + máquinas publicadas pelo ADM (Radar com margem e Pátio).
  if (pathname === "/maquinas.json") return sendJson(res, 200, await maquinasPublicas());
  const pagina = /^\/maquina\/([a-z0-9-]+?)(?:\.html)?$/.exec(pathname);
  if (pagina) return servirPaginaMaquina(req, res, pagina[1]);
  if (pathname === "/sitemap.xml") {
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    return res.end(sitemap(await maquinasPublicas()));
  }
  if (pathname === "/api/catalogo" || pathname === "/catalogo.json") return sendJson(res, 200, CATALOGO);
  return serveStatic(req, res, pathname);
});
server.listen(PORT, HOST, () => console.log(`GOULLART em http://localhost:${PORT} — atendimento humano; IA desativada.`));
