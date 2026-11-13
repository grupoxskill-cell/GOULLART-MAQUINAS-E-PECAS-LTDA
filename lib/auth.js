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
// Com o Cloudflare na frente, esse último IP é o do Cloudflare (o mesmo para muita gente): aí vale o
// CF-Connecting-IP, que só é aceito quando o pedido veio de fato de um endereço do Cloudflare.
// Sem isso, 5 senhas erradas de qualquer visitante trancavam Júnior para fora pelo mesmo IP do Cloudflare.
const CLOUDFLARE_V4 = ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15",
  "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22"].map((c) => {
  const [base, bits] = c.split("/");
  return [ipv4Num(base), Number(bits)];
});
const CLOUDFLARE_V6 = ["2400:cb00:", "2606:4700:", "2803:f800:", "2405:b500:", "2405:8100:", "2c0f:f248:"];

function ipv4Num(ip) {
  const p = String(ip).split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export function ehCloudflare(ip) {
  const v = String(ip || "").toLowerCase().replace(/^::ffff:(?=\d+\.)/, "");
  if (v.includes(":")) return CLOUDFLARE_V6.some((p) => v.startsWith(p)) || /^2a06:98c[0-7]:/.test(v);
  const n = ipv4Num(v);
  return n != null && CLOUDFLARE_V4.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)));
}

const local = (ip) => !ip || ip === "::1" || /^(::ffff:)?127\./.test(ip);

export function ipCliente(req) {
  const direto = req.socket?.remoteAddress || "";
  // Cabeçalhos só valem quando o pedido chegou pelo nginx local; acesso direto à porta usa o IP da conexão.
  if (!local(direto)) return direto;
  const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ultimo = xff.at(-1) || direto;
  const cf = String(req.headers["cf-connecting-ip"] || "").trim();
  if (cf && ehCloudflare(ultimo) && /^[0-9a-f:.]{2,45}$/i.test(cf)) return cf;
  return ultimo;
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
  const credencial = hashSenha(senha);
  await gravar("config", { ...(atual || { margem: 20000 }), ...credencial,
    segredo: randomBytes(32).toString("hex") }); // senha nova derruba sessões antigas
  return senha;
}

function assinar(valor, segredo) {
  return createHmac("sha256", segredo).update(valor).digest("hex");
}

// Sessão: validade máxima de 12 h e, dentro dela, expira com 2 h sem uso. O cookie é renovado a cada uso.
const INATIVIDADE_MS = 2 * 3600_000;
export function criarCookie(segredo, https, expiraAbsoluto = Date.now() + SESSAO_HORAS * 3600_000) {
  const ultimaAtividade = Date.now();
  const valor = `${expiraAbsoluto}.${ultimaAtividade}.${assinar(`${expiraAbsoluto}.${ultimaAtividade}`, segredo)}`;
  const segundos = Math.max(1, Math.floor((Math.min(expiraAbsoluto, ultimaAtividade + INATIVIDADE_MS) - Date.now()) / 1000));
  return `adm=${valor}; Path=/adm; HttpOnly; SameSite=Strict; Max-Age=${segundos}${https ? "; Secure" : ""}`;
}

export const cookieSaida = "adm=; Path=/adm; HttpOnly; SameSite=Strict; Max-Age=0";

export function sessaoValida(req, segredo) {
  return Boolean(lerSessao(req, segredo));
}

// { expiraAbsoluto, ultimaAtividade } quando o cookie é válido; null se ausente, forjado, vencido ou parado há mais de 2 h.
export function lerSessao(req, segredo) {
  const m = /(?:^|;\s*)adm=(\d+)\.(\d+)\.([a-f0-9]{64})/.exec(req.headers.cookie || "");
  if (!m) return null;
  const expiraAbsoluto = Number(m[1]), ultimaAtividade = Number(m[2]), agora = Date.now();
  if (expiraAbsoluto < agora || agora - ultimaAtividade > INATIVIDADE_MS) return null;
  const esperado = Buffer.from(assinar(`${m[1]}.${m[2]}`, segredo));
  const recebido = Buffer.from(m[3]);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  return { expiraAbsoluto, ultimaAtividade };
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

// Senha certa: a tentativa contada antes da conferência deixa de valer.
export function perdoarFalha(ip) {
  const f = falhas.get(ip);
  if (f && f.qtd > 0) f.qtd -= 1;
  if (GLOBAL.qtd > 0) GLOBAL.qtd -= 1;
}

// Assíncrono: a conta pesada roda fora do laço principal e não trava o site enquanto alguém tenta senhas.
export async function senhaConfere(senha, cfg) {
  if (typeof senha !== "string" || !cfg?.sal || !/^[a-f0-9]{128}$/i.test(cfg.hash || "")) return false;
  const esperado = Buffer.from(cfg.hash, "hex");
  // Instalações anteriores omitiram o custo tanto com N=16384 quanto com N=65536.
  const custos = cfg.custo == null ? [2 ** 14, CUSTO_SENHA] : [cfg.custo];
  for (const custo of custos) {
    const hash = await scryptAsync(senha, cfg.sal, 64, opcoes(custo));
    if (timingSafeEqual(hash, esperado)) return true;
  }
  return false;
}
