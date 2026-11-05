// Login do ADM: uma senha (hash scrypt) e sessão em cookie assinado com HMAC.
import { createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scryptAsync = promisify(scrypt);
// Custo do scrypt: 2^16 (4x o padrão do Node). Senhas antigas sem "custo" gravado continuam no padrão (2^14).
export const CUSTO_SENHA = 2 ** 16;
const opcoes = (custo) => ({ N: custo, maxmem: 256 * 1024 * 1024 });
import { ler, gravar } from "./dados.js";

const SESSAO_HORAS = 12;
const TENTATIVAS = { janelaMs: 15 * 60_000, max: 5 };
const falhas = new Map();
const GLOBAL = { max: 40, inicio: 0, qtd: 0 }; // limite total de senhas erradas, qualquer IP

// IP do visitante. O nginx acrescenta o IP real ao FIM do X-Forwarded-For; o começo pode ser forjado.
export function ipCliente(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff.at(-1) || req.socket?.remoteAddress || "";
}

export function hashSenha(senha, sal = randomBytes(16).toString("hex"), custo = CUSTO_SENHA) {
  return { sal, custo, hash: scryptSync(senha, sal, 64, opcoes(custo)).toString("hex") };
}

export async function config() {
  return ler("config", null);
}

// Cria a configuração com uma senha aleatória se ainda não existir; devolve a senha só nesse caso.
export async function garantirConfig(senhaInformada) {
  const atual = await config();
  if (atual && !senhaInformada) return null;
  const senha = senhaInformada || randomBytes(18).toString("base64url");
  const { sal, hash } = hashSenha(senha);
  await gravar("config", { ...(atual || { margem: 20000 }), sal, hash,
    segredo: randomBytes(32).toString("hex") }); // senha nova derruba sessões antigas
  return senha;
}

function assinar(valor, segredo) {
  return createHmac("sha256", segredo).update(valor).digest("hex");
}

export function criarCookie(segredo, https) {
  const expira = Date.now() + SESSAO_HORAS * 3600_000;
  const valor = `${expira}.${assinar(String(expira), segredo)}`;
  return `adm=${valor}; Path=/adm; HttpOnly; SameSite=Strict; Max-Age=${SESSAO_HORAS * 3600}${https ? "; Secure" : ""}`;
}

export const cookieSaida = "adm=; Path=/adm; HttpOnly; SameSite=Strict; Max-Age=0";

export function sessaoValida(req, segredo) {
  const m = /(?:^|;\s*)adm=(\d+)\.([a-f0-9]{64})/.exec(req.headers.cookie || "");
  if (!m || Number(m[1]) < Date.now()) return false;
  const esperado = Buffer.from(assinar(m[1], segredo));
  const recebido = Buffer.from(m[2]);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

// Bloqueio só por IP. Um limite global que trancasse todo mundo deixaria qualquer um
// trancar o dono para fora com 40 senhas erradas; em vez disso, o excesso global só atrasa.
export function bloqueado(ip) {
  const f = falhas.get(ip);
  if (!f || Date.now() - f.inicio > TENTATIVAS.janelaMs) return false;
  return f.qtd >= TENTATIVAS.max;
}

// Milissegundos de espera antes de conferir a senha quando há muitas falhas de vários IPs.
export function atrasoGlobal() {
  return Date.now() - GLOBAL.inicio <= TENTATIVAS.janelaMs && GLOBAL.qtd >= GLOBAL.max ? 2000 : 0;
}

export function registrarFalha(ip) {
  const agora = Date.now();
  if (agora - GLOBAL.inicio > TENTATIVAS.janelaMs) Object.assign(GLOBAL, { inicio: agora, qtd: 0 });
  GLOBAL.qtd += 1;
  if (falhas.size > 5000) for (const [k, v] of falhas) if (agora - v.inicio > TENTATIVAS.janelaMs) falhas.delete(k);
  const f = falhas.get(ip);
  if (!f || Date.now() - f.inicio > TENTATIVAS.janelaMs) falhas.set(ip, { inicio: Date.now(), qtd: 1 });
  else f.qtd += 1;
}

// Assíncrono: a conta pesada roda fora do laço principal e não trava o site enquanto alguém tenta senhas.
export async function senhaConfere(senha, cfg) {
  if (typeof senha !== "string" || !cfg?.hash || !cfg?.sal) return false;
  const hash = await scryptAsync(senha, cfg.sal, 64, opcoes(cfg.custo || 2 ** 14));
  const esperado = Buffer.from(cfg.hash, "hex");
  return hash.length === esperado.length && timingSafeEqual(hash, esperado);
}
