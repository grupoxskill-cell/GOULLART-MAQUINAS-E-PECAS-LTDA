// Site GOULLART: catálogo e contato humano. A IA permanece desativada.
import http from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { rotaAdm, servirFoto, maquinasPublicas } from "./lib/adm.js";
import { paginaMaquina, sitemap, tiposDeMaquina } from "./lib/paginas.js";
import { registrar } from "./lib/interesse.js";
import { ipCliente } from "./lib/auth.js";

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

// Respostas que mudam pouco (lista de máquinas, sitemap, página da máquina) levam ETag: o navegador, o
// WhatsApp e o Google recebem só "304 — nada mudou" em vez do arquivo inteiro a cada visita.
function responderComEtag(req, res, tipo, corpo, extra = {}) {
  const etag = `"${createHash("sha1").update(corpo).digest("base64url")}"`;
  if (req.headers["if-none-match"] === etag) return res.writeHead(304, { ETag: etag, "Cache-Control": "no-cache", ...extra }).end();
  res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-cache", ETag: etag, ...extra });
  res.end(req.method === "HEAD" ? undefined : corpo);
}

async function servirPaginaMaquina(req, res, slug) {
  const todas = await maquinasPublicas();
  const m = todas.find((x) => x.slug === slug);
  if (!m) return res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Máquina não encontrada");
  responderComEtag(req, res, "text/html; charset=utf-8", await paginaMaquina(m, todas), {
    // Só recursos do próprio site (o formulário de contato abre o WhatsApp); o JSON-LD (type=application/ld+json) não é executado e não precisa de exceção.
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://wa.me https://api.whatsapp.com; frame-ancestors 'none'" });
}

async function contarInteresse(req, res) {
  // Só o próprio site conta: outra página não consegue enviar JSON sem pré-voo CORS (que aqui não existe).
  if (!/^application\/json\b/i.test(req.headers["content-type"] || "") || req.headers["sec-fetch-site"] === "cross-site") return res.writeHead(403).end();
  let corpo = "";
  for await (const parte of req) { corpo += parte; if (corpo.length > 1024) return res.writeHead(413).end(); }
  let dados;
  try { dados = JSON.parse(corpo); } catch { return res.writeHead(400).end(); }
  const refs = new Map((await maquinasPublicas()).map((m) => [m.referencia, m.titulo]));
  const ip = ipCliente(req);
  const texto = (v) => (typeof v === "string" ? v : "");
  const ok = registrar(texto(dados?.ref), texto(dados?.tipo), ip, refs);
  res.writeHead(ok ? 204 : 400).end();
}

async function atender(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Nada do serviço pode ser embutido em outro site (clickjacking no ADM), e o navegador fica só em HTTPS.
  res.setHeader("X-Frame-Options", "DENY");
  if (req.headers["x-forwarded-proto"] === "https" || /https/.test(req.headers["cf-visitor"] || "")) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
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
  if (pathname === "/adm" || pathname.startsWith("/adm/")) {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    return rotaAdm(req, res, pathname);
  }
  if (pathname === "/api/interesse" && req.method === "POST") return contarInteresse(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.writeHead(405).end();
  }
  if (pathname === "/health") return sendJson(res, 200, { ok: true, automaticReplies: false, atendimento: "humano" });
  if (pathname === "/api/empresa") return sendJson(res, 200, EMPRESA);
  if (pathname.startsWith("/fotos/")) return servirFoto(req, res, pathname);
  // Catálogo do site + máquinas publicadas pelo ADM (Radar com margem e Pátio).
  if (pathname === "/maquinas.json") return responderComEtag(req, res, "application/json; charset=utf-8", JSON.stringify(await maquinasPublicas()));
  const pagina = /^\/maquina\/([a-z0-9-]+?)(?:\.html)?$/.exec(pathname);
  if (pagina) return servirPaginaMaquina(req, res, pagina[1]);
  if (pathname === "/sitemap.xml") {
    return responderComEtag(req, res, "application/xml; charset=utf-8", sitemap(await maquinasPublicas(), await tiposDeMaquina()));
  }
  if (pathname === "/api/catalogo" || pathname === "/catalogo.json") return sendJson(res, 200, CATALOGO);
  return serveStatic(req, res, pathname);
}

// Nenhum erro de um pedido (corpo cortado, JSON de dados corrompido etc.) pode derrubar o servidor.
const server = http.createServer((req, res) => {
  atender(req, res).catch((err) => {
    // Não registrar query string: ela pode conter identificadores e links privados.
    console.error("pedido falhou:", req.method, new URL(req.url, "http://localhost").pathname, err?.message || err);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    if (!res.writableEnded) res.end("Erro interno.");
  });
});
process.on("unhandledRejection", (err) => console.error("promessa sem tratamento:", err));
// Conexões lentas de propósito não prendem o servidor: cabeçalhos em até 20 s e o pedido inteiro em até
// 3 min (folga para enviar fotos pelo celular).
server.headersTimeout = 20_000;
server.requestTimeout = 180_000;
// Ao reiniciar (atualização a cada 10 min), termina os pedidos em andamento antes de sair.
for (const sinal of ["SIGTERM", "SIGINT"]) {
  process.once(sinal, () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
server.listen(PORT, HOST, () => console.log(`GOULLART em http://localhost:${PORT} — atendimento humano; IA desativada.`));
