// WhatsApp do Radar pela API oficial da Meta (Cloud API), direto no servidor — sem iZap.
//
// Fluxo (docs/WHATSAPP-RADAR.md):
//  1. O aprovador (Júnior, número configurado no ADM) encaminha anúncios para o número da empresa.
//  2. A Meta entrega cada mensagem em POST /adm/entrada/whatsapp (assinada com o App Secret).
//  3. Mensagens seguidas do aprovador (texto + fotos) viram UMA oferta no Radar ("Aguardando você").
//  4. Se a oferta passa nas regras (preço, cidade/UF, foto, 15% abaixo das parecidas), o servidor manda
//     a foto + o código RADAR-AAMMDD-NN para o aprovador. Senão, avisa o motivo; a oferta fica no ADM.
//  5. "SIM RADAR-…" vindo do aprovador publica no site; "NÃO RADAR-…" descarta.
//
// Regras fixas: só o aprovador é atendido; mensagens de clientes são ignoradas e não são guardadas;
// nada é publicado sem o SIM com o código exato; fonte, link e preço de origem nunca vão para o site.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ler, atualizar } from "./dados.js";
import { anuncioAprovado, avaliar, localValido, precoEmReais, formatarReais } from "./radar.js";
import { tipoDe } from "./encontros.js";
import { descontoPct, classificar } from "./radar-entrada.js";

const API = () => (process.env.WHATSAPP_API_BASE || "https://graph.facebook.com").replace(/\/$/, "");
const JUNTAR_MS = () => Number(process.env.WHATSAPP_JUNTAR_MS || 90_000); // espera fotos e texto do mesmo anúncio
const LIMITE_CORPO = 1024 * 1024;
const LIMITE_FOTO = 4 * 1024 * 1024;
const VISTOS_MAX = 2000;
export const CODIGO_RE = /^RADAR-\d{6}-\d{2}$/;
const so = (v) => String(v ?? "").replace(/\D/g, "");

// ---------- Configuração (guardada em config.json, 0600; segredos nunca voltam para o navegador) ----------
export function configWhatsapp(cfg) {
  const w = cfg?.whatsapp || {};
  return {
    phoneNumberId: so(w.phoneNumberId), token: w.token || "", appSecret: w.appSecret || "",
    verifyToken: w.verifyToken || "", aprovador: so(w.aprovador), versao: /^v\d{1,2}\.\d$/.test(w.versao || "") ? w.versao : "v23.0",
  };
}
export function statusPublico(cfg, estado = {}) {
  const w = configWhatsapp(cfg);
  return {
    phoneNumberId: w.phoneNumberId, aprovadorFinal: w.aprovador ? w.aprovador.slice(-4) : "", versao: w.versao,
    tokenSalvo: Boolean(w.token), appSecretSalvo: Boolean(w.appSecret), verifyToken: w.verifyToken,
    pronto: Boolean(w.phoneNumberId && w.token && w.appSecret && w.verifyToken && w.aprovador),
    ultimoRecebido: estado.ultimoRecebido || null, ultimoEnvio: estado.ultimoEnvio || null, ultimoErro: estado.ultimoErro || null,
  };
}
// Aplica o que veio do ADM. Campo secreto vazio = manter o que já estava.
export function aplicarConfig(atual, e) {
  const w = { ...(atual.whatsapp || {}) };
  if ("phoneNumberId" in e) { const v = so(e.phoneNumberId); if (v && v.length < 6) throw erro(400, "ID do número inválido."); w.phoneNumberId = v || undefined; }
  if ("aprovador" in e) {
    const v = so(e.aprovador);
    if (v && (v.length < 12 || v.length > 13 || !v.startsWith("55"))) throw erro(400, "Aprovador: use o número com 55 e DDD, ex.: 55 62 9xxxx-xxxx.");
    w.aprovador = v || undefined;
  }
  if ("versao" in e && e.versao) { if (!/^v\d{1,2}\.\d$/.test(e.versao)) throw erro(400, "Versão da API inválida (ex.: v23.0)."); w.versao = e.versao; }
  if (typeof e.token === "string" && e.token.trim()) { if (e.token.trim().length < 20) throw erro(400, "Token curto demais."); w.token = e.token.trim(); }
  if (typeof e.appSecret === "string" && e.appSecret.trim()) { if (!/^[a-f0-9]{32}$/i.test(e.appSecret.trim())) throw erro(400, "App Secret tem 32 letras/números (a-f, 0-9)."); w.appSecret = e.appSecret.trim(); }
  if (e.gerarVerifyToken || !w.verifyToken) w.verifyToken = randomBytes(18).toString("base64url");
  if (e.desligar) { delete w.token; delete w.appSecret; }
  atual.whatsapp = w;
}
function erro(status, msg) { return Object.assign(new Error(msg), { status }); }

// ---------- Chamadas à Graph API ----------
async function graph(w, caminho, opcoes = {}) {
  const r = await fetch(`${API()}/${w.versao}/${caminho}`, {
    ...opcoes, signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${w.token}`, ...(opcoes.headers || {}) },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WhatsApp respondeu ${r.status}: ${corpo?.error?.message || "erro"}`.slice(0, 300));
  return corpo;
}
export async function enviarTexto(w, para, texto) {
  return graph(w, `${w.phoneNumberId}/messages`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: so(para), type: "text", text: { body: String(texto).slice(0, 4000), preview_url: false } }),
  });
}
async function enviarFoto(w, para, jpeg, legenda) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "image/jpeg");
  form.append("file", new Blob([jpeg], { type: "image/jpeg" }), "radar.jpg");
  const { id } = await graph(w, `${w.phoneNumberId}/media`, { method: "POST", body: form });
  return graph(w, `${w.phoneNumberId}/messages`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: so(para), type: "image", image: { id, caption: String(legenda).slice(0, 1024) } }),
  });
}
// Baixa a foto que chegou: a Graph devolve um link temporário que só abre com o token.
const HOSTS_MIDIA = /(^|\.)(fbsbx\.com|facebook\.com|fbcdn\.net|whatsapp\.net)$/;
async function baixarMidia(w, mediaId) {
  if (!/^\d{5,30}$/.test(String(mediaId))) throw new Error("mídia inválida");
  const info = await graph(w, String(mediaId));
  const u = new URL(info.url);
  const permitido = HOSTS_MIDIA.test(u.hostname) || (process.env.WHATSAPP_API_BASE && u.origin === new URL(API()).origin);
  if (u.protocol !== "https:" && !permitido) throw new Error("link de mídia inválido");
  if (!permitido) throw new Error("link de mídia fora da Meta");
  const r = await fetch(u, { headers: { Authorization: `Bearer ${w.token}` }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`mídia respondeu ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > LIMITE_FOTO) throw new Error("foto grande demais");
  return buf;
}

// ---------- Leitura do anúncio (texto livre do WhatsApp) ----------
// Telefone em qualquer formato: "+55 62 99999 8888", "(62) 99999-8888", "62999998888", "9 9999 8888".
const TELEFONE_FONTE = String.raw`(?:\+?55[\s.-]*)?\(?\b\d{2}\)?[\s.-]*9?[\s.-]?\d{4}[\s.-]?\d{4}\b`;
const TELEFONE = new RegExp(TELEFONE_FONTE);
const TELEFONE_G = new RegExp(TELEFONE_FONTE, "g");
const limparLinha = (l) => l.replace(/[*_~`]/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();
export function lerAnuncio(texto) {
  const linhas = String(texto || "").split(/\r?\n/).map(limparLinha).filter(Boolean);
  const tudo = linhas.join("\n");
  const ruido = /^(vendo|vende-se|vendo ou troco|oportunidade|repasse|promo[çc][ãa]o|aten[çc][ãa]o|bom dia|boa tarde|boa noite)\b[!.:]*$/i;
  const informativa = /^(ano|hor[íi]metro|horas?|km|valor|pre[çc]o|r\$|nf|nota|financiamento|entrada|parcelas?|aceito|fa[çc]o|pego|local|cidade|publicad|postad|data\b|https?:)/i;
  // Título = primeiras linhas descritivas: sem saudação, sem dados (ano, preço…), sem cidade e sem contato do vendedor.
  const contato = /(vendedor|contato|falar com|whats|zap|tel\b|telefone|@|\(\d{2}\)|\d{4,5}-\d{4})/i;
  // Valor em dinheiro em qualquer ponto da linha (preço de origem é privado e nunca vai para o título público).
  const dinheiro = /r\$|\breais\b|\b\d[\d.,]*\s*(?:mil|milh[ãa]o|milh[õo]es|k)\b|[àa] vista|por apenas|\bpix\b/i;
  // Linha com nome e preço juntos ("ESCAVADEIRA 210G - R$ 250.000"): sai só o trecho de dinheiro; sobra o nome.
  const semDinheiro = (l) => l.replace(/r\$\s*[\d.,]+(?:\s*(?:mil|milh[ãa]o|milh[õo]es))?/gi, " ")
    .replace(/\b\d[\d.,]*\s*(?:mil|milh[ãa]o|milh[õo]es|k)\b/gi, " ").replace(/[àa] vista|por apenas|\bno pix\b|\bpix\b|\breais\b|\bs[óo]\b/gi, " ")
    .replace(/[\s:;,–—-]+$/, "").replace(/^[\s:;,–—-]+/, "").replace(/\s{2,}/g, " ").trim();
  const candidatas = linhas.filter((l) => !ruido.test(l) && !informativa.test(l) && !/^[\d\s.,/-]+$/.test(l) && !localValido(l) && !contato.test(l) && !TELEFONE.test(l))
    .map((l) => (dinheiro.test(l) ? semDinheiro(l) : l))
    .filter((l) => (l.match(/[A-Za-zÀ-ÿ]{2,}/g) || []).length >= 2 && !dinheiro.test(l));
  const titulo = candidatas.slice(0, 2).join(" ").replace(TELEFONE_G, "").replace(/\s{2,}/g, " ").trim().slice(0, 120);
  // Ano: o informado ("Ano 2018"); sem ele, um ano solto numa linha que não seja data, preço, telefone ou link.
  const anoMax = new Date().getFullYear() + 1;
  const linhasAno = linhas.filter((l) => !/\b\d{1,2}\/\d{1,2}\/(?:19|20)?\d{2}\b|publicad|postad|\bdata\b|\bem\s+\d{1,2}\//i.test(l) && !/r\$|https?:/i.test(l) && !TELEFONE.test(l));
  const anoInformado = tudo.match(/\bano\b[^\d\n]{0,12}((?:19|20)\d{2})(?:\s*\/\s*(?:19|20)?\d{2})?/i)?.[1];
  const anoSolto = linhasAno.join("\n").match(/\b((?:19|20)\d{2})\b/)?.[1];
  const ano = [anoInformado, anoSolto].find((a) => a && Number(a) <= anoMax) || "";
  const horasM = tudo.match(/hor[íi]metro[^\d\n]{0,12}([\d.]+)/i) || tudo.match(/\b([\d.]{3,7})\s*(?:h\b|hrs?\b|horas\b)/i);
  const kmM = tudo.match(/\bkm\b[^\d\n]{0,6}([\d.]{3,9})/i) || tudo.match(/\b([\d.]{3,9})\s*km\b/i);
  // Preço: linha com R$ (ignora a riscada ~R$~, entrada e parcelas).
  // O trecho riscado (~R$ 400.000~) sai antes; o preço novo da mesma linha continua valendo.
  const linhaPreco = String(texto || "").split(/\r?\n/).map((l) => l.replace(/~[^~]*~/g, " "))
    .filter((l) => /r\$/i.test(l) && !/entrada|parcela/i.test(l));
  const precoOrigem = linhaPreco.map((l) => precoEmReais(limparLinha(l).replace(/^.*?r\$/i, ""))).find(Boolean) || null;
  let local = "";
  for (const l of linhas) {
    const c = localValido(l.replace(/^(local|cidade|localiza[çc][ãa]o)\s*:?\s*/i, "").replace(/^📍/, ""));
    if (c) { local = c; break; }
  }
  // Link do anúncio: o primeiro que não é contato ou perfil do vendedor (wa.me, Instagram…). Esses
  // repetem em anúncios diferentes do mesmo vendedor e fariam o segundo parecer repetido.
  const contatoUrl = /^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com|instagram\.com|instagr\.am|t\.me|linktr\.ee|facebook\.com\/(?:profile|people)|m\.me)\b/i;
  const link = ((tudo.match(/https?:\/\/\S+/g) || []).find((u) => !contatoUrl.test(u)) || "").slice(0, 500);
  return { titulo, ano, horas: horasM ? `${horasM[1]} h` : kmM ? `${kmM[1]} km` : "", precoOrigem, local, link, dataAnuncio: dataDoAnuncio(linhas) };
}

// Data do anúncio quando o texto traz ("21/10 às 12:44", "publicado em 03/11/2026"). Linhas de ano/modelo
// ("ANO 08/09") não contam. Sem data no texto, vale a data do encaminhamento (docs/radar.md).
export function dataDoAnuncio(linhas, hoje = new Date()) {
  for (const l of linhas) {
    if (/\b(ano|modelo|fab|fabrica[çc][ãa]o)\b/i.test(l)) continue;
    const m = l.match(/\b(\d{1,2})\/(\d{1,2})(?:\/((?:20)?\d{2}))?\b/);
    if (!m) continue;
    const dia = Number(m[1]), mes = Number(m[2]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
    const anoHoje = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(hoje));
    let ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : anoHoje;
    let d = new Date(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}T12:00:00-03:00`);
    if (Number.isNaN(d.getTime()) || d.getUTCDate() !== dia) continue;
    if (!m[3] && d - hoje > 2 * 86_400_000) { ano -= 1; d = new Date(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}T12:00:00-03:00`); }
    if (d - hoje > 2 * 86_400_000) continue; // data no futuro: não é a data do anúncio
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  return "";
}

// ---------- Estado em disco ----------
const hojeCodigo = (d = new Date()) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g("year")}${g("month")}${g("day")}`;
};
const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
// Código nunca se repete, mesmo se a oferta for apagada no ADM: o último número de cada dia fica em whatsapp-codigos.
async function proximoCodigo(radar) {
  const dia = hojeCodigo();
  let codigo;
  await atualizar("whatsapp-codigos", {}, (cont) => {
    let n = cont[dia] || 0;
    for (const r of radar) { const m = new RegExp(`^RADAR-${dia}-(\\d{2})$`).exec(r.codigo || ""); if (m) n = Math.max(n, Number(m[1])); }
    if (n >= 99) throw new Error("limite de 99 códigos no dia");
    cont[dia] = n + 1;
    for (const k of Object.keys(cont)) if (k < String(Number(dia) - 100)) delete cont[k]; // guarda só os dias recentes
    codigo = `RADAR-${dia}-${String(n + 1).padStart(2, "0")}`;
  });
  return codigo;
}
async function registrarEstado(campos) {
  await atualizar("whatsapp-estado", {}, (e) => Object.assign(e, campos)).catch(() => {});
}

// ---------- Webhook ----------
export function verificar(cfg, query) {
  const w = configWhatsapp(cfg);
  if (!w.verifyToken) return null;
  const a = Buffer.from(String(query.get("hub.verify_token") || "")), b = Buffer.from(w.verifyToken);
  if (query.get("hub.mode") !== "subscribe" || a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const desafio = String(query.get("hub.challenge") || "");
  return /^[\w-]{1,200}$/.test(desafio) ? desafio : null;
}
export function assinaturaValida(appSecret, corpo, cabecalho) {
  if (!appSecret || !/^sha256=[a-f0-9]{64}$/.test(String(cabecalho || ""))) return false;
  const esperado = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(corpo).digest("hex")}`);
  const recebido = Buffer.from(String(cabecalho));
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
export async function lerCorpoBruto(req) {
  const partes = []; let total = 0;
  for await (const p of req) { total += p.length; if (total > LIMITE_CORPO) throw erro(413, "corpo grande demais"); partes.push(p); }
  return Buffer.concat(partes);
}

// deps: { registrarOferta(oferta) -> {item, novo}, publicar(id) -> item, descartar(id) -> item, catalogo() -> [...], margem() -> n, guardarFoto(buf) -> caminho, lerFoto(caminho) -> buf }
export function criarWhatsapp(deps) {
  // Anúncio em montagem por remetente: { textos, midias }. Fica também em disco (whatsapp-pendente) para
  // um reinício do servidor no meio da espera não perder o anúncio que a Meta já deu como entregue.
  const pendentes = new Map();
  const timers = new Map();
  let fila = Promise.resolve();
  let recebimento = Promise.resolve();
  const salvarPendentes = () => atualizar("whatsapp-pendente", {}, () => Object.fromEntries(pendentes)).catch(() => {});
  const emFila = (fn) => (fila = fila.then(fn, fn).catch((e) => { console.error("whatsapp:", e.message); registrarEstado({ ultimoErro: { em: new Date().toISOString(), msg: e.message } }); }));

  const jaVisto = async (id) => (await ler("whatsapp-vistos", [])).includes(id);
  // Marca como visto só depois de guardar a mensagem (pendente em disco ou decisão na fila).
  async function marcarVisto(id) {
    await atualizar("whatsapp-vistos", [], (lista) => {
      if (!lista.includes(id)) lista.push(id);
      if (lista.length > VISTOS_MAX) lista.splice(0, lista.length - VISTOS_MAX);
    });
  }

  async function responder(w, texto) {
    await enviarTexto(w, w.aprovador, texto);
    await registrarEstado({ ultimoEnvio: new Date().toISOString() });
  }

  async function decisao(w, acao, codigo) {
    const radar = await ler("radar", []);
    const item = radar.find((r) => r.codigo === codigo);
    if (!item) return responder(w, `Não achei ${codigo}. Confira o código.`);
    if (item.status === "publicado") return responder(w, `${codigo} já está no site.`);
    if (acao === "SIM") {
      try {
        await deps.publicar(item.id);
        await responder(w, `✅ ${codigo} publicado. ${item.titulo} já aparece no site.`);
      } catch (e) {
        await responder(w, `⚠️ ${codigo} não publicado: ${e.message} Ajuste no ADM e responda SIM ${codigo} de novo.`);
      }
    } else {
      await deps.descartar(item.id);
      await responder(w, `${codigo} descartado. Fica guardado no ADM.`);
    }
  }

  async function processarAnuncio({ textos, midias }) {
    const w = configWhatsapp(await deps.config());
    const texto = textos.join("\n").slice(0, 5000);
    const dados = lerAnuncio(texto);
    if (!dados.titulo && !dados.precoOrigem) {
      // Só fotos, sem o texto do anúncio: avisa para mandar o texto (fotos antes do texto, ou como legenda).
      if (midias.length && !textos.length) await responder(w, `Recebi ${midias.length} foto(s) sem o texto do anúncio. Encaminhe as fotos e, logo depois, o texto (ou a foto com o texto na legenda).`);
      return;
    }
    const fotos = [];
    const avisos = [];
    for (const id of midias.slice(0, 3)) {
      try { fotos.push(await deps.guardarFoto(await baixarMidia(w, id))); } catch (e) { avisos.push(`Foto não recebida (${e.message}).`); }
    }
    const categoria = tipoDe(dados.titulo) || "Outros";
    const { item, novo } = await deps.registrarOferta({
      titulo: dados.titulo || "Máquina (título a confirmar)", categoria, ano: dados.ano, horas: dados.horas, local: dados.local,
      precoOrigem: dados.precoOrigem, link: dados.link, fonte: "Encaminhado pelo aprovador no WhatsApp", obs: texto,
      fotosProntas: fotos, avisos, origemEntrada: "whatsapp",
    });
    if (!novo) return responder(w, `Esse anúncio já estava no Radar (${item.codigo || item.titulo}).`);
    const filtro = anuncioAprovado({ dataAnuncio: dados.dataAnuncio || hojeISO(), local: item.local, temFotoOriginal: fotos.length > 0, preco: item.precoOrigem, ativo: true });
    // Foto que não é JPEG (ex.: mandada como documento): diz o motivo certo em vez de "sem foto".
    if (!fotos.length && avisos.some((a) => /JPEG/.test(a))) filtro.motivos.splice(filtro.motivos.indexOf("sem foto real da máquina"), 1, "foto não é JPEG (encaminhe como foto, não como documento)");
    const conta = avaliar({ titulo: item.titulo, categoria: item.categoria, ano: item.ano, precoOrigem: item.precoOrigem }, await deps.catalogo());
    const motivos = [...filtro.motivos, ...(conta.barata ? [] : [conta.motivo])];
    // Guarda a referência de mercado calculada: classifica a oferta e dá o selo de oferta no site depois do SIM.
    const mercado = Number.isFinite(conta.referencia) ? Math.round(conta.referencia) : null;
    const anotar = (r) => {
      if (!mercado || r.precoMercado) return;
      r.precoMercado = mercado;
      r.descontoPct = descontoPct(r.precoOrigem, mercado);
      r.classificacao = classificar(r.descontoPct);
    };
    if (motivos.length) {
      await atualizar("radar", [], (radar) => { const r = radar.find((x) => x.id === item.id); if (r) anotar(r); });
      return responder(w, `Recebido: ${item.titulo}${item.ano ? ` ${item.ano}` : ""}. Não virou oferta: ${motivos.join(", ")}. Ficou no ADM (Radar) para você decidir.`);
    }
    let codigo;
    await atualizar("radar", [], async (radar) => {
      const r = radar.find((x) => x.id === item.id);
      if (!r) return;
      codigo = await proximoCodigo(radar);
      r.codigo = codigo;
      anotar(r);
    });
    const site = item.precoOrigem + (await deps.margem());
    const legenda = [
      `${codigo} · ${item.titulo}${item.ano ? ` ${item.ano}` : ""} · ${item.local}`,
      item.horas ? `Horas/km: ${item.horas}` : "",
      `Origem ${formatarReais(item.precoOrigem)} · Site ${formatarReais(site)} · ${Math.round(conta.desconto * 100)}% abaixo de ${conta.comparadas.length} parecida(s)`,
      `Responda SIM ${codigo} para publicar ou NÃO ${codigo}.`,
    ].filter(Boolean).join("\n");
    await enviarFoto(w, w.aprovador, await deps.lerFoto(fotos[0]), legenda);
    await registrarEstado({ ultimoEnvio: new Date().toISOString() });
  }

  // Fecha o anúncio do remetente e manda processar.
  function fechar(remetente) {
    clearTimeout(timers.get(remetente)); timers.delete(remetente);
    const p = pendentes.get(remetente);
    if (!p) return;
    pendentes.delete(remetente);
    salvarPendentes();
    emFila(() => processarAnuncio(p));
  }
  function agendar(remetente) {
    clearTimeout(timers.get(remetente));
    const t = setTimeout(() => fechar(remetente), JUNTAR_MS());
    t.unref?.();
    timers.set(remetente, t);
  }
  // Ao subir o servidor: retoma anúncios que estavam esperando.
  ler("whatsapp-pendente", {}).then((salvos) => {
    for (const [rem, p] of Object.entries(salvos || {})) {
      if (!Array.isArray(p?.textos) || !Array.isArray(p?.midias)) continue;
      pendentes.set(rem, { textos: p.textos, midias: p.midias, legenda: Boolean(p.legenda) });
      agendar(rem);
    }
  }).catch(() => {});

  // Recebe o JSON já com assinatura conferida.
  async function receber(cfg, payload) {
    const w = configWhatsapp(cfg);
    for (const entrada of Array.isArray(payload?.entry) ? payload.entry : []) {
      for (const mudanca of Array.isArray(entrada?.changes) ? entrada.changes : []) {
        const v = mudanca?.value;
        if (so(v?.metadata?.phone_number_id) !== w.phoneNumberId) continue;
        for (const msg of Array.isArray(v?.messages) ? v.messages : []) {
          // Cliente ou qualquer outro número: ignorado e não guardado (atendimento é humano, no aplicativo).
          if (!w.aprovador || so(msg?.from) !== w.aprovador) continue;
          // Uma mensagem por vez: duas entregas iguais ao mesmo tempo não passam juntas pela checagem.
          recebimento = recebimento.then(() => tratarMensagem(w, msg)).catch((e) => console.error("whatsapp:", e.message));
          await recebimento;
        }
      }
    }
  }

  async function tratarMensagem(w, msg) {
    if (typeof msg.id !== "string" || await jaVisto(msg.id)) return;
    await registrarEstado({ ultimoRecebido: new Date().toISOString() });
    const texto = msg.type === "text" ? String(msg.text?.body || "") : String(msg[msg.type]?.caption || "");
    const decisaoM = /^\s*(SIM|N[ÃA]O)\s+(RADAR-\d{6}-\d{2})\s*\.?\s*$/i.exec(texto);
    if (decisaoM) {
      const acao = decisaoM[1].toUpperCase().startsWith("S") ? "SIM" : "NAO";
      await marcarVisto(msg.id);
      emFila(() => decisao(w, acao, decisaoM[2].toUpperCase()));
      return;
    }
    const remetente = so(msg.from);
    const foto = msg.type === "image" && msg.image?.id ? String(msg.image.id) : null;
    // Limites entre anúncios: o texto fecha o anúncio. Fotos que chegam antes dele são dele; um texto novo,
    // ou uma foto depois de um texto, começa o anúncio seguinte.
    // Exceção: álbum com legenda (1ª foto com o texto, as outras sem): as fotos seguintes sem legenda ficam juntas.
    const atual = pendentes.get(remetente);
    const continuaAlbum = atual?.legenda && foto && !texto.trim();
    if (atual?.textos.length && (texto.trim() || foto) && !continuaAlbum) fechar(remetente);
    if (!pendentes.has(remetente)) pendentes.set(remetente, { textos: [], midias: [] });
    const p = pendentes.get(remetente);
    if (foto) p.midias.push(foto);
    if (texto.trim()) { p.textos.push(texto); p.legenda = Boolean(foto); }
    await salvarPendentes();
    await marcarVisto(msg.id);
    agendar(remetente);
  }

  return { receber, enviarTeste: (cfg) => { const w = configWhatsapp(cfg); return enviarTexto(w, w.aprovador, "Teste do Radar GOULLART: WhatsApp conectado ao site ✅"); } };
}
