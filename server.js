// Site GOULLART: catálogo e contato humano. A IA permanece desativada.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3000;
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
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.writeHead(405).end();
  }
  if (pathname === "/health") return sendJson(res, 200, { ok: true, automaticReplies: false, atendimento: "humano" });
  if (pathname === "/api/empresa") return sendJson(res, 200, EMPRESA);
  if (pathname === "/api/catalogo" || pathname === "/catalogo.json") return sendJson(res, 200, CATALOGO);
  return serveStatic(req, res, pathname);
});
server.listen(PORT, () => console.log(`GOULLART em http://localhost:${PORT} — atendimento humano; IA desativada.`));
