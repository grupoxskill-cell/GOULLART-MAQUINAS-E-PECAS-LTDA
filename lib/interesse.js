// Contador de visitas e cliques em "Tenho interesse" por máquina. Não guarda IP nem dados pessoais:
// o IP só serve, em memória, para não contar a mesma pessoa várias vezes em 30 minutos.
import { ler, gravar } from "./dados.js";

const JANELA_MS = 30 * 60_000;
const vistos = new Map();
let fila = Promise.resolve();

function repetido(chave) {
  const agora = Date.now();
  if (vistos.size > 20_000) for (const [k, t] of vistos) if (agora - t > JANELA_MS) vistos.delete(k);
  // Teto fixo de memória: se ainda assim passar do limite (muitos IPs ao mesmo tempo), recomeça a lista.
  if (vistos.size > 100_000) vistos.clear();
  const antes = vistos.get(chave);
  vistos.set(chave, agora);
  return antes && agora - antes < JANELA_MS;
}

// IPv6: a mesma pessoa troca de endereço dentro do bloco /64; conta o bloco, não o endereço.
// Expande o "::" antes de cortar, senão redes diferentes viram a mesma chave.
export function rede(ip) {
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (v4) return v4[1];
  if (!ip.includes(":")) return ip;
  const [antes, depois = ""] = ip.split("%")[0].split("::");
  const a = antes ? antes.split(":") : [], d = ip.includes("::") && depois ? depois.split(":") : [];
  const grupos = ip.includes("::") ? [...a, ...Array(Math.max(0, 8 - a.length - d.length)).fill("0"), ...d] : a;
  return grupos.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(":");
}

// refs: Map referência → título das máquinas publicadas; só essas são contadas.
export function registrar(ref, tipo, ip, refs) {
  if (!refs.has(ref) || !["visita", "interesse"].includes(tipo)) return false;
  if (repetido(`${rede(ip)}|${ref}|${tipo}`)) return true;
  const dia = new Date().toISOString().slice(0, 10);
  // Gravações em fila para dois cliques simultâneos não sobrescreverem um ao outro.
  fila = fila.then(async () => {
    const dados = await ler("interesse", {});
    const m = (dados[ref] ||= { titulo: refs.get(ref), visitas: 0, interesses: 0, dias: {} });
    m.titulo = refs.get(ref);
    const d = (m.dias[dia] ||= { v: 0, i: 0 });
    if (tipo === "visita") { m.visitas++; d.v++; } else { m.interesses++; d.i++; }
    m.ultimo = new Date().toISOString();
    await gravar("interesse", dados);
  }).catch((err) => console.error("interesse:", err));
  return true;
}

export async function resumo(dias = 7) {
  const dados = await ler("interesse", {});
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  return Object.entries(dados).map(([ref, m]) => {
    const recentes = Object.entries(m.dias).filter(([d]) => d >= desde);
    return { ref, titulo: m.titulo, visitas: m.visitas, interesses: m.interesses, ultimo: m.ultimo,
      visitas7: recentes.reduce((s, [, d]) => s + d.v, 0), interesses7: recentes.reduce((s, [, d]) => s + d.i, 0) };
  }).sort((a, b) => b.interesses7 - a.interesses7 || b.visitas7 - a.visitas7 || b.interesses - a.interesses);
}
