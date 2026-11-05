// Entrada automática do Radar: recebe uma oferta (JSON), monta a ficha interna e baixa até 3 fotos.
// Regras em docs/RADAR-REGRAS.md. Nada aqui publica no site: a máquina entra como "novo" até Júnior aprovar.
import { randomBytes } from "node:crypto";
import { lookup as lookupCallback } from "node:dns";
import https from "node:https";
import { isIP } from "node:net";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FOTOS_DIR, prepararPastas } from "./dados.js";
import { tipoDe, valorEmReais } from "./encontros.js";

const LIMITE_FOTO = 4 * 1024 * 1024;
const texto = (v, max = 200) => String(v ?? "").trim().slice(0, max);

export function descontoPct(origem, mercado) {
  if (!Number.isFinite(origem) || !Number.isFinite(mercado) || mercado <= 0) return null;
  return Math.round(((mercado - origem) / mercado) * 1000) / 10;
}

export function classificar(pct) {
  if (pct == null) return "a confirmar";
  if (pct >= 25) return "Quente";
  if (pct >= 10) return "Boa";
  return "Fraca";
}

// Bloqueia endereços internos (localhost, rede privada, metadados da nuvem) para a entrada não virar porta de acesso ao servidor.
function ipPrivado(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) {
      const resto = v.slice(7);
      if (isIP(resto) === 4) return ipPrivado(resto);
      const [hi, lo] = resto.split(":").map((x) => parseInt(x, 16)); // ::ffff:7f00:1 = 127.0.0.1
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) return true;
      return ipPrivado([hi >> 8, hi & 255, lo >> 8, lo & 255].join("."));
    }
    if (v.startsWith("64:ff9b:") || v.startsWith("fec0")) return true;
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

// O IP é conferido no momento da conexão (lookup do próprio pedido), não antes: assim um domínio
// que troca de endereço entre a checagem e o download não consegue apontar para a rede interna.
function lookupSeguro(host, opcoes, cb) {
  lookupCallback(host, { ...opcoes, all: true }, (err, enderecos) => {
    if (err) return cb(err);
    if (!enderecos.length || enderecos.some((e) => ipPrivado(e.address))) {
      return cb(Object.assign(new Error("endereço de foto não permitido"), { code: "EPRIVADO" }));
    }
    if (opcoes?.all) return cb(null, enderecos);
    cb(null, enderecos[0].address, enderecos[0].family);
  });
}

function baixarFoto(url) {
  let u;
  try { u = new URL(url); } catch { return Promise.reject(new Error("link de foto inválido")); }
  if (u.protocol !== "https:") return Promise.reject(new Error("foto precisa ser https"));
  if (isIP(u.hostname.replace(/^\[|\]$/g, "")) && ipPrivado(u.hostname.replace(/^\[|\]$/g, ""))) {
    return Promise.reject(new Error("endereço de foto não permitido"));
  }
  return new Promise((ok, falha) => {
    const req = https.get(u, { lookup: lookupSeguro, timeout: 15_000, headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return falha(new Error(`foto respondeu ${r.statusCode}`)); }
      const partes = [];
      let total = 0;
      r.on("data", (p) => {
        total += p.length;
        if (total > LIMITE_FOTO) { req.destroy(); falha(new Error("foto grande demais")); } else partes.push(p);
      });
      r.on("end", () => ok(Buffer.concat(partes)));
      r.on("error", falha);
    });
    req.on("timeout", () => req.destroy(new Error("foto demorou demais")));
    req.on("error", (e) => falha(e.code === "EPRIVADO" ? new Error("endereço de foto não permitido") : e));
  });
}

async function guardarFoto(buf) {
  if (!buf || buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("foto precisa ser JPEG");
  await prepararPastas();
  const nome = `${randomBytes(12).toString("hex")}.jpg`;
  await writeFile(join(FOTOS_DIR, nome), buf, { mode: 0o644 });
  return `fotos/${nome}`;
}

// Fotos: [{ url | dados (data:image/jpeg;base64,...), marcaDagua }]. Até 3; falhas viram aviso na ficha.
async function receberFotos(lista) {
  const fotos = [], fotosMarca = [], avisos = [];
  for (const f of (Array.isArray(lista) ? lista : []).slice(0, 3)) {
    try {
      const b64 = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(f?.dados || ""));
      const buf = b64 ? Buffer.from(b64[1], "base64") : await baixarFoto(String(f?.url || ""));
      const caminho = await guardarFoto(buf);
      fotos.push(caminho);
      if (f?.marcaDagua) fotosMarca.push(caminho);
    } catch (err) {
      avisos.push(`Foto não recebida (${err.message}).`);
    }
  }
  return { fotos, fotosMarca, avisos };
}

// Cria a máquina do Radar a partir da oferta. Devolve { item, novo } — novo=false quando o mesmo link já entrou nos últimos 7 dias.
export async function receberOferta(e, radar) {
  const link = /^https?:\/\//i.test(texto(e.link, 500)) ? texto(e.link, 500) : "";
  const seteDias = Date.now() - 7 * 86_400_000;
  const repetida = link && radar.find((r) => r.link === link && Date.parse(r.criadoEm) > seteDias);
  if (repetida) return { item: repetida, novo: false };

  const titulo = texto(e.titulo, 120);
  if (!titulo) throw Object.assign(new Error("Informe o titulo da máquina."), { status: 400 });
  const precoOrigem = valorEmReais(e.precoOrigem);
  const precoMercado = valorEmReais(e.precoMercado);
  const pct = descontoPct(precoOrigem, precoMercado);
  const { fotos, fotosMarca, avisos } = await receberFotos(e.fotos);
  const categorias = ["Escavadeiras", "Pás-carregadeiras", "Retroescavadeiras", "Tratores", "Motoniveladoras", "Caminhões", "Outros"];
  const item = {
    id: randomBytes(8).toString("hex"), titulo,
    categoria: categorias.includes(e.categoria) ? e.categoria : tipoDe(titulo) || "Outros",
    ano: texto(e.ano, 30), horas: texto(e.horas, 40), local: texto(e.local, 80), obs: texto(e.obs, 1000),
    fotos, fotosMarca, precoOrigem, precoMercado, descontoPct: pct, classificacao: classificar(pct),
    fonte: texto(e.fonte, 300), link, contato: texto(e.contato, 200), avisos,
    origemEntrada: "radar-automatico", status: "novo", criadoEm: new Date().toISOString(),
  };
  return { item, novo: true };
}

// Aviso para WhatsApp/automação (ex.: Zapier, Make, iZap). Só dados para Júnior decidir; nunca bloqueia a entrada.
export async function avisar(url, item, precoSite, linkAdm) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        tipo: "radar_nova_oferta", titulo: item.titulo, ano: item.ano, horas: item.horas,
        // Preço de origem é privado: fica só no ADM, não vai para automações de terceiros.
        precoSite, descontoPct: item.descontoPct, classificacao: item.classificacao,
        fotosComMarcaDagua: item.fotosMarca.length, aprovar: linkAdm,
        mensagem: `RADAR GOULLART: ${item.titulo}${item.ano ? ` ${item.ano}` : ""} • ${item.classificacao}` +
          `${item.descontoPct != null ? ` (${item.descontoPct}% abaixo)` : ""} • site R$ ${Math.round(precoSite || 0).toLocaleString("pt-BR")}` +
          ` • Aprovar: ${linkAdm}`,
      }),
    });
  } catch (err) {
    console.error("aviso do Radar falhou:", err.message);
  }
}
