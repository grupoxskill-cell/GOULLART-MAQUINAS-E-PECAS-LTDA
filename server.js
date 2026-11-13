// Servidor sem dependências: serve o site estático e faz a ponte com a API da OpenAI.
// A chave OPENAI_API_KEY fica apenas no servidor e nunca é enviada ao navegador.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));
const loadJson = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf-8"));
const EMPRESA = await loadJson("./data/empresa.json");
const CATALOGO = await loadJson("./data/catalogo.json");

const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  `Você é ${EMPRESA.assistente}, a IA de atendimento do site da ${EMPRESA.nome} (${EMPRESA.razaoSocial}).
A GOULLART atende máquinas pesadas novas e usadas, peças, locação, intermediação e transporte.

Jeito de falar: português brasileiro simples, próximo e comercial, frases curtas, uma ideia por bloco
e uma pergunta por vez. Não abra com "Oi" ou "Olá", não use emojis nem travessões. Se perguntarem,
diga com transparência que é a IA de atendimento da GOULLART; nunca diga que é humana nem o Júnior.

Seu objetivo é entender o que o cliente precisa e pedir só o próximo dado que falta:
- Peças: marca, modelo completo, peça, código/referência, quantidade e cidade de destino.
  Em rodante, diferencie aro motriz, corrente, par de correntes, roletes, guias, sapatas e conjunto.
- Máquinas: tipo/modelo, aplicação (fazenda, obra, mineração, terraplanagem), orçamento e cidade.
- Locação: equipamento, serviço, cidade, início e duração.
Depois, encaminhe para o WhatsApp ${EMPRESA.whatsappExibicao} (https://wa.me/${EMPRESA.whatsapp}),
onde o Júnior confirma preço, disponibilidade e condições.

Regras:
- Nunca invente preço, estoque, prazo, desconto, parcelamento, garantia ou compatibilidade técnica.
- Ofereça peças somente destas categorias: ${EMPRESA.categorias.join(", ")}.
- Use somente os dados da empresa e do catálogo abaixo. Se a peça não estiver na lista, diga que a
  equipe pode localizar e peça o dado que falta para identificar.
- Não invente códigos de peça. Não prometa retorno em horário específico.

Dados da empresa (JSON):
${JSON.stringify(EMPRESA)}

Peças do catálogo (JSON):
${JSON.stringify(CATALOGO)}`;

const MAX_HISTORY = 20; // mensagens enviadas para o modelo por requisição
const MAX_CHARS = 2000; // tamanho máximo de cada mensagem do usuário
const MAX_REPLY_TOKENS = 600; // limita o tamanho (e o custo) de cada resposta
const OPENAI_TIMEOUT_MS = 30_000;
const RATE_LIMIT = { windowMs: 60_000, max: 20 }; // por IP

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
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

// O Render acrescenta o IP real do visitante no fim do X-Forwarded-For; os valores anteriores
// vêm do próprio visitante e podem ser falsificados para escapar do limite de mensagens.
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",").pop().trim();
  return req.socket.remoteAddress;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 100_000) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > limit) {
      req.destroy();
      throw new Error("Corpo da requisição muito grande");
    }
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
  if (rateLimited(clientIp(req))) {
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
        max_tokens: MAX_REPLY_TOKENS,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Erro da OpenAI:", response.status, data?.error?.message);
      return sendJson(res, 502, { error: "O assistente está indisponível no momento." });
    }
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return sendJson(res, 502, { error: "O assistente não conseguiu responder agora." });
    sendJson(res, 200, { reply });
  } catch (err) {
    console.error("Falha ao chamar a OpenAI:", err);
    sendJson(res, 502, { error: "O assistente está indisponível no momento." });
  }
}

async function serveStatic(req, res, pathname) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(pathname);
  } catch {
    // Endereço com "%" malformado: antes derrubava o servidor inteiro.
    res.writeHead(400).end();
    return;
  }
  const filePath = normalize(join(PUBLIC_DIR, urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath));
  if (!filePath.startsWith(PUBLIC_DIR + sep) || urlPath.includes("\0")) {
    res.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(filePath);
    const type = MIME[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": type.startsWith("text/html") ? "no-cache" : "public, max-age=3600",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Página não encontrada");
  }
}

// Limpa contadores antigos para o mapa não crescer indefinidamente.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now - entry.start > RATE_LIMIT.windowMs) hits.delete(ip);
  }
}, RATE_LIMIT.windowMs).unref();

async function route(req, res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  const { pathname } = new URL(req.url, "http://localhost");
  const isRead = req.method === "GET" || req.method === "HEAD";

  // O site só abre o chat quando o assistente está pronto; sem a chave, cai no WhatsApp.
  if (pathname === "/health" && isRead) return sendJson(res, 200, { ok: true, chat: Boolean(OPENAI_API_KEY) });
  if (pathname === "/api/empresa" && isRead) return sendJson(res, 200, EMPRESA);
  if (pathname === "/api/catalogo" && isRead) return sendJson(res, 200, CATALOGO);
  if (pathname === "/api/chat") {
    if (req.method === "POST") return handleChat(req, res);
    res.writeHead(405, { Allow: "POST" }).end();
    return;
  }
  if (isRead) return serveStatic(req, res, pathname);
  res.writeHead(405, { Allow: "GET, HEAD" }).end();
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error("Erro inesperado:", err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});
server.requestTimeout = 60_000;

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  if (!OPENAI_API_KEY) console.warn("Aviso: OPENAI_API_KEY não definida — o chat não vai responder.");
});
