// Respostas que mudam pouco (lista de máquinas, catálogo, sitemap, página da máquina).
// - ETag: quem já tem a versão atual recebe só "304 — nada mudou".
// - gzip: o nginx não comprime o que vem do serviço (gzip_proxied desligado por padrão), então o próprio
//   serviço comprime para quem aceita. O catálogo cai de ~50 KB para ~8 KB no celular.
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const MINIMO_GZIP = 1024;

export function responderComEtag(req, res, tipo, corpo, extra = {}) {
  const etag = `"${createHash("sha1").update(corpo).digest("base64url")}"`;
  const base = { "Cache-Control": "no-cache", Vary: "Accept-Encoding", ETag: etag, ...extra };
  if (req.headers["if-none-match"] === etag) return res.writeHead(304, base).end();
  const aceitaGzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
  const bruto = Buffer.from(corpo);
  const gz = aceitaGzip && bruto.length >= MINIMO_GZIP;
  const enviado = gz ? gzipSync(bruto) : bruto;
  res.writeHead(200, { "Content-Type": tipo, ...base, ...(gz ? { "Content-Encoding": "gzip" } : {}), "Content-Length": enviado.length });
  res.end(req.method === "HEAD" ? undefined : enviado);
}
