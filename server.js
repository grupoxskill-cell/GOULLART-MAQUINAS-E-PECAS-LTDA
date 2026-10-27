// Servidor sem dependências: serve o site estático e faz a ponte com a API da OpenAI.
// A chave OPENAI_API_KEY fica apenas no servidor e nunca é enviada ao navegador.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  `Você é o assistente virtual da Goullart Máquinas e Peças LTDA.
Atenda clientes em português do Brasil, com educação e objetividade.
Ajude com dúvidas sobre máquinas, peças, manutenção e orçamentos.
Não invente preços, prazos ou disponibilidade de estoque: nesses casos,
peça os dados de contato do cliente e diga que um vendedor retornará.`;

const MAX_HISTORY = 20; // mensagens enviadas para o modelo por requisição
const MAX_CHARS = 2000; // tamanho máximo de cada mensagem do usuário
const RATE_LIMIT = { windowMs: 60_000, max: 20 }; // por IP

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 100_000) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > limit) throw new Error("Corpo da requisição muito grande");
  }
  return data;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_HISTORY);
  if (clean.length === 0 || clean[clean.length - 1].role !== "user") return null;
  return clean;
}

async function handleChat(req, res) {
  if (!OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "OPENAI_API_KEY não configurada no servidor." });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
  if (rateLimited(ip)) {
    return sendJson(res, 429, { error: "Muitas mensagens. Aguarde um minuto e tente novamente." });
  }

  let messages;
  try {
    messages = sanitizeMessages(JSON.parse(await readBody(req)).messages);
  } catch {
    messages = null;
  }
  if (!messages) return sendJson(res, 400, { error: "Requisição inválida." });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Erro da OpenAI:", response.status, data?.error?.message);
      return sendJson(res, 502, { error: "O assistente está indisponível no momento." });
    }
    sendJson(res, 200, { reply: data.choices?.[0]?.message?.content ?? "" });
  } catch (err) {
    console.error("Falha ao chamar a OpenAI:", err);
    sendJson(res, 502, { error: "O assistente está indisponível no momento." });
  }
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const filePath = normalize(join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Página não encontrada");
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/api/chat" && req.method === "POST") return handleChat(req, res);
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405).end();
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  if (!OPENAI_API_KEY) console.warn("Aviso: OPENAI_API_KEY não definida — o chat não vai responder.");
});
