// Registro de acessos e ações do ADM (auditoria). Só Júnior vê, no próprio painel.
// Guarda apenas o necessário para perceber uso indevido: hora, tipo do evento, IP e o alvo (id/código).
// Nunca grava senha, token, cookie, dados de clientes ou do vendedor.
import { atualizar, ler } from "./dados.js";

const MAX_EVENTOS = 500;
const TIPOS_ACESSO = new Set(["login", "login_falhou", "sair", "senha_trocada", "token_gerado"]);

export async function registrarEvento(tipo, dados = {}) {
  const evento = { em: new Date().toISOString(), tipo, ...dados };
  try {
    await atualizar("auditoria", [], (lista) => {
      lista.push(evento);
      if (lista.length > MAX_EVENTOS) lista.splice(0, lista.length - MAX_EVENTOS);
    });
  } catch (err) {
    console.error("auditoria:", err.message); // o registro nunca derruba a ação em si
  }
  return evento;
}

export async function ultimosEventos(n = 30, soAcessos = false) {
  const lista = await ler("auditoria", []);
  return lista.filter((e) => !soAcessos || TIPOS_ACESSO.has(e.tipo)).slice(-n).reverse();
}

// IP que nunca entrou com sucesso antes: motivo para avisar Júnior.
export async function ipDesconhecido(ip) {
  const lista = await ler("auditoria", []);
  return !lista.some((e) => e.tipo === "login" && e.ip === ip);
}

// Aviso para a automação configurada em ADM > Config (mesmo endereço usado pelo Radar). Nunca bloqueia o login.
export async function avisarAcesso(url, texto) {
  if (!url) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({ tipo: "adm_acesso", mensagem: texto, em: new Date().toISOString() }) });
  } catch (err) {
    console.error("aviso de acesso falhou:", err.message);
  }
}
