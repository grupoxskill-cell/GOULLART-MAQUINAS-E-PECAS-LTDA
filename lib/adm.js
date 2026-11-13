// Área ADM: Radar (preço do site = origem + margem, publicação manual), Pátio, CRM e Encontros.
// Tudo atrás de login; os dados ficam em DATA_DIR e nunca no repositório.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ler, gravar, atualizar, prepararPastas, FOTOS_DIR } from "./dados.js";
import { config, criarCookie, cookieSaida, sessaoValida, lerSessao, bloqueado, atrasoGlobal, registrarFalha, perdoarFalha, senhaConfere, hashSenha, ipCliente } from "./auth.js";
import { registrarEvento, ultimosEventos, ipDesconhecido, avisarAcesso } from "./auditoria.js";
import { encontrar, tipoDe, valorEmReais } from "./encontros.js";
import { receberOferta, avisar, descontoPct, classificar, guardarFoto } from "./radar-entrada.js";
import { criarWhatsapp, verificar, assinaturaValida, lerCorpoBruto, configWhatsapp, statusPublico, aplicarConfig } from "./whatsapp.js";
import { comSlugs, semVendidas } from "./paginas.js";
import { precoEmReais, ofertaPublica } from "./radar.js";
import { resumo as resumoInteresse } from "./interesse.js";
import { importarBackup, listarPublicacoes, alterarPublicacao, catalogoPublico, listarRadares, alterarRadar, ID_RE } from "./publicacoes.js";

const ADM_DIR = fileURLToPath(new URL("../adm/", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const CATEGORIAS = ["Escavadeiras", "Pás-carregadeiras", "Retroescavadeiras", "Tratores", "Motoniveladoras", "Caminhões", "Outros"];
const FOTO_RE = /^fotos\/[a-f0-9]{24}\.jpg$/;
const LIMITE_JSON = 12 * 1024 * 1024;

export const reais = (n) => (Number.isFinite(n) ? `R$ ${Math.round(n).toLocaleString("pt-BR")}` : "");

function json(res, status, corpo, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(JSON.stringify(corpo));
}

// Rotas sem login ou de poucos campos (senha, config, token) só aceitam corpos pequenos.
const LIMITE_PEQUENO = 4 * 1024;
async function lerCorpo(req, limite = LIMITE_JSON) {
  let tamanho = 0;
  const partes = [];
  for await (const p of req) {
    tamanho += p.length;
    if (tamanho > limite) throw Object.assign(new Error("Arquivo grande demais."), { status: 413 });
    partes.push(p);
  }
  let dados;
  try { dados = JSON.parse(Buffer.concat(partes).toString("utf-8") || "{}"); }
  catch { throw Object.assign(new Error("Dados inválidos."), { status: 400 }); }
  // null, número ou texto no lugar do objeto viravam erro 500 nas rotas.
  if (!dados || typeof dados !== "object") throw Object.assign(new Error("Dados inválidos."), { status: 400 });
  return dados;
}

const texto = (v, max = 200) => String(v ?? "").trim().slice(0, max);

function limparMaquina(e, antigo = {}) {
  const titulo = texto(e.titulo ?? antigo.titulo, 120);
  if (!titulo) throw Object.assign(new Error("Informe o nome da máquina."), { status: 400 });
  const categoria = CATEGORIAS.includes(e.categoria) ? e.categoria : antigo.categoria || tipoDe(titulo) || "Outros";
  const fotos = (Array.isArray(e.fotos) ? e.fotos : antigo.fotos || []).filter((f) => FOTO_RE.test(f)).slice(0, 8);
  const arte = "arte" in e ? e.arte : antigo.arte;
  return { titulo, categoria, ano: texto(e.ano ?? antigo.ano, 30), horas: texto(e.horas ?? antigo.horas, 40),
    local: texto(e.local ?? antigo.local, 80), obs: texto(e.obs ?? antigo.obs, 1000), fotos,
    textoSite: texto(e.textoSite ?? antigo.textoSite, 600), arte: FOTO_RE.test(arte || "") ? arte : undefined };
}

// ---------- Radar ----------
// Regra de Júnior: preço do site = preço de origem + margem (R$ 20.000). Um precoSite gravado
// (congelado na publicação ou editado à mão) prevalece. O preço de origem em si nunca sai do ADM.
function precoSite(item, margem) {
  if (Number.isFinite(item.precoSite) && item.precoSite > 0) return item.precoSite;
  return Number.isFinite(item.precoOrigem) ? item.precoOrigem + margem : null;
}

// Fotos marcadas com marca d'água de outra revenda nunca vão para o site (docs/RADAR-REGRAS.md).
const fotosPublicas = (m) => (m.fotos || []).filter((f) => f !== m.arte && !(m.fotosMarca || []).includes(f));

export async function maquinasPublicas() {
  const [site, radar, patio, cfg] = await Promise.all([
    readFile(join(PUBLIC_DIR, "maquinas.json"), "utf-8").then(JSON.parse).catch(() => []),
    ler("radar", []), ler("patio", []), config()]);
  const margem = cfg?.margem ?? 20000;
  const deRadar = radar.filter((r) => r.status === "publicado").map((r) => ({
    referencia: `R-${r.id.slice(0, 6).toUpperCase()}`, titulo: r.titulo, categoria: r.categoria, ano: r.ano,
    horas: r.horas, preco: reais(precoSite(r, margem)), fotos: fotosPublicas(r) }));
  const dePatio = patio.filter((p) => p.publicado).map((p) => ({
    referencia: `P-${p.id.slice(0, 6).toUpperCase()}`, titulo: p.titulo, categoria: p.categoria, ano: p.ano,
    horas: p.horas, preco: reais(p.preco), fotos: fotosPublicas(p), patio: true, local: p.local }));
  return comSlugs(semVendidas([...dePatio, ...deRadar, ...site]));
}

// Máquinas publicadas pelo Radar e pelo Pátio no formato do catálogo do site.
// Do Radar vai só o que o cliente precisa: nada de fonte, local, observações ou preço de origem.
async function maquinasDoAdm() {
  const [radar, patio, cfg] = await Promise.all([ler("radar", []), ler("patio", []), config()]);
  const margem = cfg?.margem ?? 20000;
  const item = (m, prefixo, preco, local) => {
    const resumoTxt = [m.categoria, m.ano && `Ano ${m.ano}`, m.horas, local].filter(Boolean).join(" • ");
    return {
      id: `${prefixo}-${m.id.slice(0, 6).toUpperCase()}`, publicCode: `GOUL-${prefixo}${m.id.slice(0, 4).toUpperCase()}`, state: null,
      title: [m.titulo, m.ano].filter(Boolean).join(" "), category: "maquinas", price: Number.isFinite(preco) ? preco : null,
      publicText: m.textoSite || `${resumoTxt} • Confirme disponibilidade e condições com a equipe GOULLART.`,
      image: fotosPublicas(m)[0] ? `/${fotosPublicas(m)[0]}` : "",
      images: fotosPublicas(m).map((f) => `/${f}`),
      publishedAt: m.publicadoEm || m.criadoEm || null, receivedAt: m.criadoEm || null, retentionPolicy: "owner_confirmation",
      // Selo "abaixo do mercado" em /ofertas quando o Radar tem preço de mercado (só o desconto sobre o preço do site sai).
      offer: ofertaPublica(preco, m.precoMercado, m.publicadoEm || m.criadoEm),
    };
  };
  // Máquinas do Radar aprovadas por Júnior e publicadas pelo repositório (public/maquinas.json, ficha "radar-AAAA-MM-DD"):
  // entram na vitrine da página inicial com as fotos reais e a data da aprovação.
  const site = await readFile(join(PUBLIC_DIR, "maquinas.json"), "utf-8").then(JSON.parse).catch(() => []);
  const doRepositorio = site.filter((m) => /^radar-\d{4}-\d{2}-\d{2}$/.test(m.ficha) && m.fotos?.length).map((m) => {
    const data = m.ficha.slice(6);
    const resumoTxt = [m.categoria, m.ano && `Ano ${m.ano}`, m.horas, m.local].filter(Boolean).join(" • ");
    return {
      id: `S-${m.referencia}`, publicCode: m.referencia, state: null,
      title: [m.titulo, m.ano].filter(Boolean).join(" "), category: "maquinas", price: precoEmReais(m.preco),
      publicText: `${resumoTxt} • Confirme disponibilidade e condições com a equipe GOULLART.`,
      image: `/${m.fotos[0]}`, images: m.fotos.map((f) => `/${f}`),
      publishedAt: data, receivedAt: data, retentionPolicy: "owner_confirmation",
      offer: ofertaPublica(m.preco, m.mercado, data),
    };
  });
  return [
    ...patio.filter((p) => p.publicado).map((p) => item(p, "P", p.preco, p.local)),
    ...radar.filter((r) => r.status === "publicado").map((r) => item(r, "R", precoSite(r, margem))),
    ...doRepositorio,
  ].sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}

async function todasMaquinas() {
  const [site, radar, patio, cfg] = await Promise.all([
    readFile(join(PUBLIC_DIR, "maquinas.json"), "utf-8").then(JSON.parse).catch(() => []),
    ler("radar", []), ler("patio", []), config()]);
  const margem = cfg?.margem ?? 20000;
  return [
    ...patio.map((p) => ({ ...p, origem: "Pátio", preco: reais(p.preco), publicado: p.publicado })),
    ...radar.filter((r) => r.status !== "descartado").map((r) => ({ ...r, origem: "Radar",
      preco: reais(precoSite(r, margem)), publicado: r.status === "publicado" })),
    ...site.map((m) => ({ ...m, origem: "Site", publicado: true })),
  ];
}

// ---------- Fotos ----------
async function salvarFoto(dados) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dados || ""));
  const buf = m && Buffer.from(m[1], "base64");
  if (!buf || buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) throw Object.assign(new Error("Envie uma foto JPEG."), { status: 400 });
  if (buf.length > 4 * 1024 * 1024) throw Object.assign(new Error("Foto grande demais."), { status: 413 });
  await prepararPastas();
  const nome = `${randomBytes(12).toString("hex")}.jpg`;
  await writeFile(join(FOTOS_DIR, nome), buf, { mode: 0o600 });
  return `fotos/${nome}`;
}

// Foto de máquina apagada ou descartada sai do disco: ela ficaria acessível em /fotos/ para sempre.
async function apagarFotos(fotos = []) {
  for (const f of fotos) if (FOTO_RE.test(f)) await unlink(join(FOTOS_DIR, f.slice(6))).catch(() => {});
}

// Fotos privadas são acessíveis somente numa sessão ADM válida.
// Fotos públicas precisam pertencer à galeria de um registro efetivamente publicado.
// A arte interna nunca faz parte da lista pública.
export async function servirFoto(req, res, pathname) {
  const rotaPrivada = pathname.startsWith("/adm/fotos/");
  const nome = pathname.slice(rotaPrivada ? "/adm/".length : 1);
  if (!FOTO_RE.test(nome)) return res.writeHead(404).end();
  const cfg = await config();
  const administrador = Boolean(cfg?.segredo && sessaoValida(req, cfg.segredo));
  if (rotaPrivada && !administrador) return res.writeHead(404, { "Cache-Control": "no-store" }).end();
  if (!administrador) {
    const [radar, patio] = await Promise.all([ler("radar", []), ler("patio", [])]);
    const publicada = [...radar.filter((m) => m.status === "publicado"),
      ...patio.filter((m) => m.publicado === true)]
      .some((m) => fotosPublicas(m).includes(nome));
    if (!publicada) return res.writeHead(404, { "Cache-Control": "no-store" }).end();
  }
  try {
    const buf = await readFile(join(FOTOS_DIR, nome.slice(6)));
    res.writeHead(200, { "Content-Type": "image/jpeg",
      "Cache-Control": administrador ? "private, no-store" : "public, no-cache, must-revalidate",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : buf);
  } catch { res.writeHead(404, { "Cache-Control": "no-store" }).end(); }
}

// ---------- CRM ----------
function resumoCrm(crm) {
  if (!crm) return null;
  const porId = new Map(crm.contacts.map((c) => [c.id, c]));
  return {
    importadoEm: crm.importadoEm, exportadoEm: crm.exportedAt || "",
    contatos: crm.contacts.map((c) => ({ id: c.id, nome: c.name, telefone: c.phone, classificacao: c.classification,
      linha: c.line, cidade: c.city, ultimo: c.lastInteractionAt || c.lastContact, obs: c.notes })),
    negociacoes: crm.deals.map((d) => ({ id: d.id, cliente: porId.get(d.contactId)?.name || "", telefone: porId.get(d.contactId)?.phone || "",
      pedido: d.title, categoria: d.category, tipo: d.kind, etapa: d.stage, prioridade: d.priority,
      orcamento: d.budget, pendencia: d.pending, proxima: d.nextAction, prazo: d.dueDate })),
    retornos: (crm.returns || []).filter((r) => r.status !== "Concluído").map((r) => ({ id: r.id, cliente: r.client,
      prioridade: r.priority, acao: r.action, prazo: r.dueDate, responsavel: r.owner }))
      .sort((a, b) => String(a.prazo || "9999").localeCompare(String(b.prazo || "9999"))),
  };
}

// ---------- Roteador ----------
// O painel não tem script nem estilo embutido: só o que vem deste servidor roda nele (barra XSS vindo de dados).
const CSP_ADM = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
async function servirArquivoAdm(res, nome, tipo) {
  try {
    res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "private, no-store", "Content-Security-Policy": CSP_ADM, "X-Robots-Tag": "noindex, nofollow, noarchive" });
    res.end(await readFile(join(ADM_DIR, nome)));
  } catch { res.writeHead(404).end(); }
}

// Valida a sessão novamente dentro da fila e aplica a mudança à configuração mais recente.
function editarConfig(req, alterar) {
  return atualizar("config", null, (atual) => {
    if (!atual?.segredo || !sessaoValida(req, atual.segredo)) {
      throw Object.assign(new Error("Faça login."), { status: 401 });
    }
    alterar(atual);
  });
}

function mesmaOrigem(req) {
  const origem = req.headers.origin;
  if (!origem) return true;
  try { return new URL(origem).host === (req.headers["x-forwarded-host"] || req.headers.host); }
  catch { return false; }
}

const ipDe = ipCliente;
const linkSeguro = (v) => { const s = texto(v, 500); return /^https?:\/\//i.test(s) ? s : ""; };
const hashToken = (tok) => createHash("sha256").update(String(tok)).digest("hex");
const DIAS_ENVELHECIDA = 30; // máquina há mais tempo que isso no site pede decisão de Júnior
const ENTRADA_MAX = 60; // ofertas por IP a cada 15 minutos na entrada automática
const RADAR_NOVOS_MAX = 300; // ofertas "novo" guardadas ao mesmo tempo
const entradas = new Map();
const viaHttps = (req) => req.headers["x-forwarded-proto"] === "https" || /https/.test(req.headers["cf-visitor"] || "");

// Entrada automática do Radar (ver docs/RADAR-REGRAS.md): token de ADM > Config., sem login.
async function entradaRadar(req, res) {
  if (req.method !== "POST") return json(res, 405, { erro: "Use POST." });
  const cfg = await config();
  // Só o hash do token fica em config.json; configurações antigas com o token em texto ainda funcionam.
  const esperado = cfg?.tokenEntradaHash || (cfg?.tokenEntrada ? hashToken(cfg.tokenEntrada) : null);
  if (!esperado) return json(res, 503, { erro: "Entrada do Radar desligada. Gere o token em ADM > Config." });
  // Só no cabeçalho: na URL o token iria parar nos registros de acesso do nginx.
  const enviado = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(hashToken(enviado)), b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json(res, 401, { erro: "Token inválido." });
  // Mesmo com o token certo, um remetente não enche o disco: no máximo ENTRADA_MAX ofertas por IP a cada 15 min.
  const ip = ipDe(req), agora = Date.now(), e = entradas.get(ip);
  if (e && agora - e.inicio <= 15 * 60_000 && e.qtd >= ENTRADA_MAX) return json(res, 429, { erro: "Muitas ofertas em pouco tempo. Tente em alguns minutos." });
  if (!e || agora - e.inicio > 15 * 60_000) entradas.set(ip, { inicio: agora, qtd: 1 }); else e.qtd += 1;
  if (entradas.size > 5000) for (const [k, v] of entradas) if (agora - v.inicio > 15 * 60_000) entradas.delete(k);
  try {
    const radar = await ler("radar", []);
    if (radar.filter((r) => r.status === "novo").length >= RADAR_NOVOS_MAX) {
      return json(res, 429, { erro: `O Radar já tem ${RADAR_NOVOS_MAX} ofertas aguardando decisão. Avalie-as no ADM antes de mandar mais.` });
    }
    const { item, novo } = await receberOferta(await lerCorpo(req), radar);
    if (!novo) return json(res, 200, { ok: true, repetida: true, id: item.id });
    // Relê dentro da fila: a oferta pode ter levado segundos baixando fotos, e o mesmo link pode ter entrado nesse meio-tempo.
    let repetida = null;
    await atualizar("radar", [], (atual) => {
      repetida = item.link ? atual.find((r) => r.link === item.link && Date.parse(r.criadoEm) > Date.now() - 7 * 86_400_000) : null;
      if (!repetida) atual.push(item);
    });
    if (repetida) { await apagarFotos(item.fotos); return json(res, 200, { ok: true, repetida: true, id: repetida.id }); }
    const margem = cfg.margem ?? 20000;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    avisar(cfg.avisoWebhook, item, precoSite(item, margem), `https://${host}/adm/#radar`);
    await registrarEvento("entrada_radar", { ip, id: item.id });
    return json(res, 201, { ok: true, id: item.id, classificacao: item.classificacao, descontoPct: item.descontoPct, avisos: item.avisos });
  } catch (err) {
    if (err.status) return json(res, err.status, { erro: err.message });
    console.error(err);
    return json(res, 500, { erro: "Erro interno." });
  }
}

// Publicar/descartar uma máquina do Radar: mesmas regras no painel e no "SIM RADAR-…" do WhatsApp.
function aplicarAcaoRadar(item, acao, margem) {
  if (acao === "publicar") {
    // Publicar é a aprovação de Júnior: senha do ADM no painel, ou SIM com o código exato vindo do aprovador.
    if (!Number.isFinite(precoSite(item, margem))) throw Object.assign(new Error("Informe o preço de origem antes de publicar."), { status: 400 });
    // Capa do site = foto real da máquina (regra de Júnior); a arte é só para a aprovação no WhatsApp.
    if (!fotosPublicas(item).length) throw Object.assign(new Error("Sem foto própria da máquina: não publica."), { status: 400 });
    // Congela o preço do site no momento da publicação (origem + margem atual).
    item.precoSite = precoSite(item, margem);
    item.status = "publicado"; item.publicadoEm = new Date().toISOString();
  } else if (acao === "despublicar") item.status = "novo";
  else { item.status = "descartado"; item.arquivadoEm = new Date().toISOString(); /* Fotos e evidências preservadas. */ }
}
async function acaoRadarPorId(id, acao) {
  const margem = (await config())?.margem ?? 20000;
  let resultado;
  await atualizar("radar", [], (lista) => {
    const item = lista.find((x) => x.id === id);
    if (!item) throw Object.assign(new Error("Máquina não encontrada."), { status: 404 });
    aplicarAcaoRadar(item, acao, margem);
    resultado = item;
  });
  await registrarEvento(`radar_${acao}_whatsapp`, { id, titulo: resultado.titulo });
  return resultado;
}

// Oferta que chegou pelo WhatsApp: mesma ficha da entrada automática. Sem link, a repetição é pelo título + preço em 7 dias.
async function registrarOfertaWhatsapp(oferta) {
  const radar = await ler("radar", []);
  if (radar.filter((r) => r.status === "novo").length >= RADAR_NOVOS_MAX) throw new Error("Radar cheio: avalie as ofertas no ADM.");
  const { item, novo } = await receberOferta(oferta, radar);
  if (!novo) { await apagarFotos(oferta.fotosProntas); return { item, novo: false }; }
  let repetida = null;
  await atualizar("radar", [], (atual) => {
    const seteDias = Date.now() - 7 * 86_400_000;
    repetida = atual.find((r) => Date.parse(r.criadoEm) > seteDias && r.status !== "descartado" &&
      ((item.link && r.link === item.link) || (r.titulo === item.titulo && r.precoOrigem === item.precoOrigem && item.precoOrigem)));
    if (!repetida) atual.push(item);
  });
  if (repetida) { await apagarFotos(item.fotos); return { item: repetida, novo: false }; }
  await registrarEvento("entrada_radar_whatsapp", { id: item.id });
  return { item, novo: true };
}

const whatsapp = criarWhatsapp({
  registrarOferta: registrarOfertaWhatsapp,
  publicar: (id) => acaoRadarPorId(id, "publicar"),
  descartar: (id) => acaoRadarPorId(id, "descartar"),
  catalogo: () => maquinasPublicas(),
  margem: async () => (await config())?.margem ?? 20000,
  guardarFoto,
  lerFoto: (caminho) => readFile(join(FOTOS_DIR, String(caminho).slice(6))),
  config: () => config(),
});

// Webhook da Meta (WhatsApp Cloud API). GET = verificação; POST = mensagens, sempre com assinatura do App Secret.
async function entradaWhatsapp(req, res, url) {
  const cfg = await config();
  if (req.method === "GET") {
    const desafio = verificar(cfg, url.searchParams);
    if (!desafio) { res.writeHead(403).end(); return; }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); return res.end(desafio);
  }
  if (req.method !== "POST") { res.writeHead(405, { Allow: "GET, POST" }).end(); return; }
  const w = configWhatsapp(cfg);
  if (!w.appSecret || !w.token || !w.phoneNumberId || !w.aprovador) { res.writeHead(503).end(); return; }
  let corpo;
  try { corpo = await lerCorpoBruto(req); } catch { res.writeHead(413).end(); return; }
  if (!assinaturaValida(w.appSecret, corpo, req.headers["x-hub-signature-256"])) { res.writeHead(401).end(); return; }
  let payload;
  try { payload = JSON.parse(corpo.toString("utf-8")); } catch { res.writeHead(400).end(); return; }
  // A Meta espera resposta rápida; o processamento segue em segundo plano.
  res.writeHead(200).end();
  whatsapp.receber(cfg, payload).catch((e) => console.error("whatsapp:", e.message));
}

export async function rotaAdm(req, res, pathname) {
  if (pathname === "/adm") { res.writeHead(301, { Location: "/adm/" }); return res.end(); }
  if (req.method === "GET" && pathname === "/adm/") return servirArquivoAdm(res, "index.html", "text/html; charset=utf-8");
  if (req.method === "GET" && pathname === "/adm/app.js") return servirArquivoAdm(res, "app.js", "text/javascript; charset=utf-8");
  if (req.method === "GET" && pathname === "/adm/app.css") return servirArquivoAdm(res, "app.css", "text/css; charset=utf-8");
  const fonte = /^\/adm\/fontes\/(InterDisplay-(?:Black|ExtraBold|SemiBold)\.otf)$/.exec(pathname);
  if (req.method === "GET" && fonte) return servirArquivoAdm(res, `fontes/${fonte[1]}`, "font/otf");
  if (req.method === "GET" && pathname === "/adm/logo.png") return servirArquivoAdm(res, "logo.png", "image/png");
  if (pathname.startsWith("/adm/fotos/") && (req.method === "GET" || req.method === "HEAD")) {
    return servirFoto(req, res, pathname);
  }
  if (pathname === "/adm/entrada/radar") return entradaRadar(req, res);
  if (pathname === "/adm/entrada/whatsapp") return entradaWhatsapp(req, res, new URL(req.url, "http://x"));
  // Catálogo público do site (sem login, só campos públicos).
  if (req.method === "GET" && pathname === "/adm/catalogo.json") {
    try {
      // O site consulta este arquivo de tempos em tempos: se nada mudou, responde só "304" em vez de 40 KB.
      const corpo = JSON.stringify(await catalogoPublico(await maquinasDoAdm()));
      const etag = `"${createHash("sha1").update(corpo).digest("base64url")}"`;
      if (req.headers["if-none-match"] === etag) { res.writeHead(304, { ETag: etag, "Cache-Control": "no-cache" }); return res.end(); }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache", ETag: etag });
      return res.end(corpo);
    } catch (err) { console.error(err); res.writeHead(500).end(); return; }
  }
  if (!pathname.startsWith("/adm/api/")) { res.writeHead(404).end(); return; }

  const metodo = req.method;
  if (metodo !== "GET" && !mesmaOrigem(req)) return json(res, 403, { erro: "Origem não permitida." });
  const cfg = await config();
  if (!cfg) return json(res, 503, { erro: "ADM ainda não configurado. Rode scripts/criar-senha.mjs no servidor." });
  const rota = pathname.slice("/adm/api".length);

  try {
    if (rota === "/entrar" && metodo === "POST") {
      const ip = ipDe(req);
      if (bloqueado(ip)) return json(res, 429, { erro: "Muitas tentativas. Espere 15 minutos." });
      // Ataque de muitos IPs ao mesmo tempo: todo mundo espera um pouco, mas Júnior nunca fica trancado para fora.
      const espera = atrasoGlobal();
      if (espera) await new Promise((r) => setTimeout(r, espera));
      // A tentativa conta ANTES da conferência (lenta): pedidos em paralelo não passam do limite de 5.
      registrarFalha(ip);
      const { senha } = await lerCorpo(req, LIMITE_PEQUENO);
      if (!(await senhaConfere(senha, cfg))) {
        await registrarEvento("login_falhou", { ip });
        return json(res, 401, { erro: "Senha incorreta." });
      }
      perdoarFalha(ip);
      // Entrada de um IP nunca visto: Júnior recebe aviso pela automação configurada (se houver).
      if (await ipDesconhecido(ip)) avisarAcesso(cfg.avisoWebhook, `ADM GOULLART: login de um endereço novo (${ip}) em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Se não foi você, troque a senha agora em ADM > Config.`);
      await registrarEvento("login", { ip });
      return json(res, 200, { ok: true }, { "Set-Cookie": criarCookie(cfg.segredo, viaHttps(req)) });
    }
    if (rota === "/sair" && metodo === "POST") {
      // Sair derruba todas as sessões abertas (um cookie copiado deixa de valer), não só a deste navegador.
      if (sessaoValida(req, cfg.segredo)) {
        await editarConfig(req, (atual) => { atual.segredo = randomBytes(32).toString("hex"); });
        await registrarEvento("sair", { ip: ipDe(req) });
      }
      return json(res, 200, { ok: true }, { "Set-Cookie": cookieSaida });
    }
    const sessao = lerSessao(req, cfg.segredo);
    if (!sessao) return json(res, 401, { erro: "Faça login." });
    // Sessão deslizante: enquanto Júnior usa o painel, o cookie é renovado (a cada 5 min) até o limite de 12 h.
    if (Date.now() - sessao.ultimaAtividade > 5 * 60_000) res.setHeader("Set-Cookie", criarCookie(cfg.segredo, viaHttps(req), sessao.expiraAbsoluto));
    const auditar = (tipo, dados = {}) => registrarEvento(tipo, { ip: ipDe(req), ...dados });

    const margem = cfg.margem ?? 20000;

    if (rota === "/resumo" && metodo === "GET") {
      const [radar, patio, crm, pubs] = await Promise.all([ler("radar", []), ler("patio", []), ler("crm", null), ler("publicacoes", null)]);
      const encontros = crm ? encontrar(crm.deals, crm.contacts, await todasMaquinas()) : [];
      // Ofertas envelhecidas: máquinas há mais de 30 dias no site, para Júnior decidir baixar o preço, renovar a foto ou tirar.
      const hoje = Date.now();
      const envelhecidas = (await catalogoPublico(await maquinasDoAdm())).items
        .filter((i) => i.category === "maquinas" && /^\d{4}-\d{2}-\d{2}/.test(i.publishedAt || ""))
        .map((i) => ({ codigo: i.publicCode, titulo: i.title, publicadoEm: i.publishedAt.slice(0, 10), dias: Math.floor((hoje - Date.parse(i.publishedAt.slice(0, 10) + "T12:00:00Z")) / 86_400_000) }))
        .filter((i) => i.dias > DIAS_ENVELHECIDA).sort((a, b) => b.dias - a.dias);
      return json(res, 200, { margem, envelhecidas, acessos: await ultimosEventos(10, true), radarNovos: radar.filter((r) => r.status === "novo").length,
        radarPublicados: radar.filter((r) => r.status === "publicado").length,
        patio: patio.length, patioPublicados: patio.filter((p) => p.publicado).length,
        crmImportadoEm: crm?.importadoEm || null, encontros: encontros.length,
        // Conta só o que o site mostra de fato (peça sem foto e máquina vendida ficam fora, como em catalog-data.js).
        publicacoesImportadasEm: pubs?.importadoEm || null,
        publicacoesNoSite: pubs ? pubs.itens.filter((i) => i.noSite && globalThis.GoullartCatalogData.visivel({ publicCode: i.codigo, category: i.categoria, image: i.imagens?.[0] || "", images: i.imagens })).length : 0,
        encontrosRadarNovo: encontros.filter((e) => e.achados.some((a) => a.maquina.origem === "Radar" && !a.maquina.publicado)).length });
    }

    // Ofertas coladas do ChatGPT (sem GPT personalizado): mesmas regras da entrada automática do Radar.
    if (rota === "/radar/importar" && metodo === "POST") {
      const corpo = await lerCorpo(req);
      const ofertas = (Array.isArray(corpo) ? corpo : Array.isArray(corpo?.ofertas) ? corpo.ofertas : [corpo]).slice(0, 20);
      const resultados = [];
      for (const oferta of ofertas) {
        try {
          const atual = await ler("radar", []);
          const { item, novo } = await receberOferta(oferta || {}, atual);
          if (novo) await atualizar("radar", [], (lista) => { lista.push(item); });
          resultados.push({ titulo: item.titulo, novo, classificacao: item.classificacao, descontoPct: item.descontoPct, avisos: item.avisos || [] });
        } catch (err) {
          if (!err.status) throw err;
          resultados.push({ titulo: String(oferta?.titulo || "(sem título)"), erro: err.message });
        }
      }
      await auditar("radar_colado", { ofertas: resultados.filter((r) => r.novo).length });
      return json(res, 200, { resultados });
    }

    let m;
    if ((m = /^\/(radar|patio)$/.exec(rota))) {
      const tipo = m[1];
      if (metodo === "GET") {
        const lista = await ler(tipo, []);
        return json(res, 200, lista.map((i) => tipo === "radar" ? { ...i, precoSiteCalculado: precoSite(i, margem) } : i)
          .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))));
      }
      if (metodo === "POST") {
        const e = await lerCorpo(req);
        const item = { id: randomBytes(8).toString("hex"), ...limparMaquina(e), criadoEm: new Date().toISOString() };
        if (tipo === "radar") Object.assign(item, { precoOrigem: valorEmReais(e.precoOrigem), fonte: texto(e.fonte, 300), status: "novo" });
        else Object.assign(item, { preco: valorEmReais(e.preco), publicado: false });
        await atualizar(tipo, [], (lista) => { lista.push(item); });
        return json(res, 201, item);
      }
    }
    if ((m = /^\/(radar|patio)\/([a-f0-9]{16})(?:\/(publicar|despublicar|descartar))?$/.exec(rota))) {
      const [, tipo, id, acao] = m;
      const e = metodo === "PUT" && !acao ? await lerCorpo(req) : null;
      let resultado, fotosParaApagar = [];
      await atualizar(tipo, [], (lista) => {
        const i = lista.findIndex((x) => x.id === id);
        if (i < 0) throw Object.assign(new Error("Máquina não encontrada."), { status: 404 });
        if (metodo === "DELETE" && !acao) {
          // Apagar é decisão de Júnior no painel; o registro sai e as fotos saem do disco (não ficam em /fotos/).
          fotosParaApagar = lista[i].fotos || [];
          lista.splice(i, 1);
        } else if (metodo === "PUT" && !acao) {
          const antigo = lista[i];
          lista[i] = { ...antigo, ...limparMaquina(e, antigo) };
          if (tipo === "radar") {
            if ("precoOrigem" in e) lista[i].precoOrigem = valorEmReais(e.precoOrigem);
            if ("precoSite" in e) lista[i].precoSite = e.precoSite === "" || e.precoSite == null ? undefined : valorEmReais(e.precoSite);
            if ("fonte" in e) lista[i].fonte = texto(e.fonte, 300);
            if ("link" in e) lista[i].link = linkSeguro(e.link);
            if ("contato" in e) lista[i].contato = texto(e.contato, 200);
            if ("precoMercado" in e) lista[i].precoMercado = valorEmReais(e.precoMercado);
            if (Array.isArray(e.fotosMarca)) lista[i].fotosMarca = e.fotosMarca.filter((f) => lista[i].fotos.includes(f));
            lista[i].descontoPct = descontoPct(lista[i].precoOrigem, lista[i].precoMercado);
            lista[i].classificacao = classificar(lista[i].descontoPct);
          } else if ("preco" in e) lista[i].preco = valorEmReais(e.preco);
        } else if (metodo === "POST" && acao) {
          const item = lista[i];
          if (tipo === "radar") {
            aplicarAcaoRadar(item, acao, margem);
          } else {
            if (acao === "publicar" && !fotosPublicas(item).length) throw Object.assign(new Error("Sem foto da máquina: não publica."), { status: 400 });
            item.publicado = acao === "publicar"; if (item.publicado) item.publicadoEm = new Date().toISOString();
          }
        } else throw Object.assign(new Error("Ação inválida."), { status: 405 });
        resultado = lista[i] || { ok: true };
      });
      await apagarFotos(fotosParaApagar);
      if (metodo !== "PUT" || acao) await auditar(`${tipo}_${metodo === "DELETE" ? "apagar" : acao}`, { id, titulo: resultado?.titulo });
      return json(res, 200, resultado);
    }

    if (rota === "/publicacoes" && metodo === "GET") return json(res, 200, await listarPublicacoes());
    if (rota === "/publicacoes" && metodo === "POST") { const r = await importarBackup(await lerCorpo(req)); await auditar("publicacoes_importadas", { itens: r.itens }); return json(res, 200, r); }
    if ((m = /^\/publicacoes\/([^/]+)$/.exec(rota)) && metodo === "PUT") {
      if (!ID_RE.test(m[1])) return json(res, 404, { erro: "Publicação não encontrada." });
      return json(res, 200, await alterarPublicacao(m[1], await lerCorpo(req)));
    }
    if (rota === "/radares" && metodo === "GET") return json(res, 200, await listarRadares());
    if ((m = /^\/radares\/([^/]+)$/.exec(rota)) && metodo === "PUT") {
      // O caminho já chegou decodificado; "%" solto derrubava a rota com erro 500.
      if (!ID_RE.test(m[1])) return json(res, 404, { erro: "Radar não encontrado." });
      return json(res, 200, await alterarRadar(m[1], await lerCorpo(req)));
    }

    if (rota === "/interesse" && metodo === "GET") return json(res, 200, await resumoInteresse());

    if (rota === "/fotos" && metodo === "POST") return json(res, 201, { foto: await salvarFoto((await lerCorpo(req)).dados) });

    if (rota === "/crm" && metodo === "GET") return json(res, 200, resumoCrm(await ler("crm", null)));
    if (rota === "/crm" && metodo === "POST") {
      const b = await lerCorpo(req);
      if (!Array.isArray(b?.contacts) || !Array.isArray(b?.deals)) return json(res, 400, { erro: "Arquivo não parece um backup do CRM GOULLART." });
      await gravar("crm", { ...b, importadoEm: new Date().toISOString() });
      await auditar("crm_importado", { contatos: b.contacts.length, negociacoes: b.deals.length });
      return json(res, 200, { ok: true, contatos: b.contacts.length, negociacoes: b.deals.length });
    }

    if (rota === "/encontros" && metodo === "GET") {
      const crm = await ler("crm", null);
      return json(res, 200, crm ? encontrar(crm.deals, crm.contacts, await todasMaquinas()) : []);
    }

    if (rota === "/config" && metodo === "PUT") {
      const e = await lerCorpo(req, LIMITE_PEQUENO);
      const alteracoes = {};
      if ("margem" in e) {
        const nova = valorEmReais(e.margem);
        if (nova == null || nova < 0 || nova > 1_000_000) return json(res, 400, { erro: "Margem inválida." });
        alteracoes.margem = nova;
      }
      if ("avisoWebhook" in e) {
        const url = String(e.avisoWebhook || "").trim();
        if (url && !/^https:\/\/\S+$/.test(url)) return json(res, 400, { erro: "O endereço do aviso precisa começar com https://" });
        alteracoes.avisoWebhook = url || undefined;
      }
      const novo = await editarConfig(req, (atual) => Object.assign(atual, alteracoes));
      await auditar("config_alterada", { campos: Object.keys(e) });
      return json(res, 200, { margem: novo.margem ?? 20000, avisoWebhook: novo.avisoWebhook || "" });
    }
    if (rota === "/whatsapp" && metodo === "GET") {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      return json(res, 200, { ...statusPublico(cfg, await ler("whatsapp-estado", {})), webhook: `https://${host}/adm/entrada/whatsapp` });
    }
    if (rota === "/whatsapp" && metodo === "PUT") {
      const e = await lerCorpo(req, LIMITE_PEQUENO);
      const novo = await editarConfig(req, (atual) => aplicarConfig(atual, e));
      await auditar("whatsapp_config", { campos: Object.keys(e).filter((k) => k !== "token" && k !== "appSecret").concat(e.token ? ["token"] : [], e.appSecret ? ["appSecret"] : []) });
      return json(res, 200, statusPublico(novo, await ler("whatsapp-estado", {})));
    }
    if (rota === "/whatsapp/teste" && metodo === "POST") {
      if (!statusPublico(cfg).pronto) return json(res, 400, { erro: "Preencha ID do número, token, App Secret e aprovador antes do teste." });
      try { await whatsapp.enviarTeste(cfg); } catch (err) { return json(res, 502, { erro: err.message }); }
      await auditar("whatsapp_teste");
      return json(res, 200, { ok: true });
    }
    if (rota === "/entrada" && metodo === "GET") {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      // O token só é mostrado na hora em que é gerado; depois o servidor guarda apenas o hash.
      return json(res, 200, { url: `https://${host}/adm/entrada/radar`, token: "", ligada: Boolean(cfg.tokenEntradaHash || cfg.tokenEntrada), avisoWebhook: cfg.avisoWebhook || "" });
    }
    if (rota === "/entrada/token" && metodo === "POST") {
      const novo = randomBytes(24).toString("base64url");
      await editarConfig(req, (atual) => {
        delete atual.tokenEntrada;
        atual.tokenEntradaHash = hashToken(novo);
      });
      await auditar("token_gerado");
      return json(res, 200, { token: novo });
    }
    if (rota === "/senha" && metodo === "POST") {
      // Mesma trava do login: com um cookie roubado não dá para ficar chutando a senha atual.
      const ip = ipDe(req);
      if (bloqueado(ip)) return json(res, 429, { erro: "Muitas tentativas. Espere 15 minutos." });
      registrarFalha(ip); // conta antes da conferência, como no login
      const e = await lerCorpo(req, LIMITE_PEQUENO);
      if (!(await senhaConfere(e.atual, cfg))) {
        await auditar("senha_atual_errada");
        return json(res, 401, { erro: "Senha atual incorreta." });
      }
      perdoarFalha(ip);
      if (typeof e.nova !== "string" || e.nova.length < 14) return json(res, 400, { erro: "A nova senha precisa de 14 caracteres ou mais." });
      // Segredo novo: sessões abertas com a senha antiga deixam de valer.
      const segredo = randomBytes(32).toString("hex");
      await editarConfig(req, (atual) => Object.assign(atual, hashSenha(e.nova), { segredo }));
      await auditar("senha_trocada");
      return json(res, 200, { ok: true }, { "Set-Cookie": criarCookie(segredo, viaHttps(req)) });
    }
    return json(res, 404, { erro: "Rota não encontrada." });
  } catch (err) {
    if (err.status) return json(res, err.status, { erro: err.message });
    console.error(err);
    return json(res, 500, { erro: "Erro interno." });
  }
}
