// Login do ADM: uma senha (hash scrypt) e sessão em cookie assinado com HMAC.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ler, gravar } from "./dados.js";

const SESSAO_HORAS = 12;
const TENTATIVAS = { janelaMs: 15 * 60_000, max: 5 };
const falhas = new Map();

export function hashSenha(senha, sal = randomBytes(16).toString("hex")) {
  return { sal, hash: scryptSync(senha, sal, 64).toString("hex") };
}

export async function config() {
  return ler("config", null);
}

// Cria a configuração com uma senha aleatória se ainda não existir; devolve a senha só nesse caso.
export async function garantirConfig(senhaInformada) {
  const atual = await config();
  if (atual && !senhaInformada) return null;
  const senha = senhaInformada || randomBytes(9).toString("base64url");
  const { sal, hash } = hashSenha(senha);
  await gravar("config", { ...(atual || { margem: 20000 }), sal, hash,
    segredo: atual?.segredo || randomBytes(32).toString("hex") });
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

export function bloqueado(ip) {
  const f = falhas.get(ip);
  if (!f || Date.now() - f.inicio > TENTATIVAS.janelaMs) return false;
  return f.qtd >= TENTATIVAS.max;
}

export function registrarFalha(ip) {
  const f = falhas.get(ip);
  if (!f || Date.now() - f.inicio > TENTATIVAS.janelaMs) falhas.set(ip, { inicio: Date.now(), qtd: 1 });
  else f.qtd += 1;
}

export function senhaConfere(senha, cfg) {
  if (typeof senha !== "string" || !cfg) return false;
  const { hash } = hashSenha(senha, cfg.sal);
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(cfg.hash, "hex"));
}
