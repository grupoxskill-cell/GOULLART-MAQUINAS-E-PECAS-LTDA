// Área ADM: Radar (preço do site = origem + margem, publicação manual), Pátio, CRM e Encontros.
// Tudo atrás de login; os dados ficam em DATA_DIR e nunca no repositório.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ler, gravar, atualizar, prepararPastas, FOTOS_DIR } from "./dados.js";
import { config, criarCookie, cookieSaida, sessaoValida, bloqueado, atrasoGlobal, registrarFalha, senhaConfere, hashSenha, ipCliente } from "./auth.js";
import { encontrar, tipoDe, valorEmReais } from "./encontros.js";
import { receberOferta, avisar, descontoPct, classificar } from "./radar-entrada.js";
import { comSlugs } from "./paginas.js";
import { precoEmReais } from "./radar.js";
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
function precoSite(item, margem) {
  return item.precoSite ?? (Number.isFinite(item.precoOrigem) ? item.precoOrigem + margem : null);
}

// Fotos marcadas com marca d'água de outra revenda nunca vão para o site (docs/RADAR-REGRAS.md).
const fotosPublicas = (m) => (m.fotos || []).filter((f) => !(m.fotosMarca || []).includes(f));

export async function maquinasPublicas() {
  const [site, radar, patio, cfg] = await Promise.all([
    readFile(join(PUBLIC_DIR, "maquinas.json"), "utf-8").then(JSON.parse).catch(() => []),
    ler("radar", []), ler("patio", []), config()]);
  const margem = cfg?.margem ?? 20000;
  const deRadar = radar.filter((r) => r.status === "publicado").map((r) => ({
    referencia: `R-${r.id.slice(0, 6).toUpperCase()}`, titulo: r.titulo, categoria: r.categoria, ano: r.ano,
    horas: r.horas, preco: reais(precoSite(r, margem)), fotos: [r.arte, ...fotosPublicas(r)].filter(Boolean) }));
  const dePatio = patio.filter((p) => p.publicado).map((p) => ({
    referencia: `P-${p.id.slice(0, 6).toUpperCase()}`, titulo: p.titulo, categoria: p.categoria, ano: p.ano,
    horas: p.horas, preco: reais(p.preco), fotos: p.fotos, patio: true, local: p.local }));
  return comSlugs([...dePatio, ...deRadar, ...site]);
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
      image: m.arte ? `/${m.arte}` : fotosPublicas(m)[0] ? `/${fotosPublicas(m)[0]}` : "",
      images: [m.arte, ...fotosPublicas(m)].filter(Boolean).map((f) => `/${f}`),
      publishedAt: m.publicadoEm || m.criadoEm || null, receivedAt: m.criadoEm || null, retentionPolicy: "owner_confirmation",
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
  await writeFile(join(FOTOS_DIR, nome), buf, { mode: 0o644 });
  return `fotos/${nome}`;
}

// Foto de máquina apagada ou descartada sai do disco: ela ficaria acessível em /fotos/ para sempre.
async function apagarFotos(fotos = []) {
  for (const f of fotos) if (FOTO_RE.test(f)) await unlink(join(FOTOS_DIR, f.slice(6))).catch(() => {});
}

export async function servirFoto(res, pathname) {
  const nome = pathname.slice(1);
  if (!FOTO_RE.test(nome)) return res.writeHead(404).end();
  try {
    const buf = await readFile(join(FOTOS_DIR, nome.slice(6)));
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
    res.end(buf);
  } catch { res.writeHead(404).end(); }
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
    res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-cache", "Content-Security-Policy": CSP_ADM });
    res.end(await readFile(join(ADM_DIR, nome)));
  } catch { res.writeHead(404).end(); }
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
    return json(res, 201, { ok: true, id: item.id, classificacao: item.classificacao, descontoPct: item.descontoPct, avisos: item.avisos });
  } catch (err) {
    if (err.status) return json(res, err.status, { erro: err.message });
    console.error(err);
    return json(res, 500, { erro: "Erro interno." });
  }
}

export async function rotaAdm(req, res, pathname) {
  if (pathname === "/adm") { res.writeHead(301, { Location: "/adm/" }); return res.end(); }
  if (req.method === "GET" && pathname === "/adm/") return servirArquivoAdm(res, "index.html", "text/html; charset=utf-8");
  if (req.method === "GET" && pathname === "/adm/app.js") return servirArquivoAdm(res, "app.js", "text/javascript; charset=utf-8");
  if (req.method === "GET" && pathname === "/adm/app.css") return servirArquivoAdm(res, "app.css", "text/css; charset=utf-8");
  const fonte = /^\/adm\/fontes\/(InterDisplay-(?:Black|ExtraBold|SemiBold)\.otf)$/.exec(pathname);
  if (req.method === "GET" && fonte) return servirArquivoAdm(res, `fontes/${fonte[1]}`, "font/otf");
  if (req.method === "GET" && pathname === "/adm/logo.png") return servirArquivoAdm(res, "logo.png", "image/png");
  if (pathname === "/adm/entrada/radar") return entradaRadar(req, res);
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
      const { senha } = await lerCorpo(req, LIMITE_PEQUENO);
      if (!senhaConfere(senha, cfg)) { registrarFalha(ip); return json(res, 401, { erro: "Senha incorreta." }); }
      return json(res, 200, { ok: true }, { "Set-Cookie": criarCookie(cfg.segredo, viaHttps(req)) });
    }
    if (rota === "/sair" && metodo === "POST") {
      // Sair derruba todas as sessões abertas (um cookie copiado deixa de valer), não só a deste navegador.
      if (sessaoValida(req, cfg.segredo)) await gravar("config", { ...cfg, segredo: randomBytes(32).toString("hex") });
      return json(res, 200, { ok: true }, { "Set-Cookie": cookieSaida });
    }
    if (!sessaoValida(req, cfg.segredo)) return json(res, 401, { erro: "Faça login." });

    const margem = cfg.margem ?? 20000;

    if (rota === "/resumo" && metodo === "GET") {
      const [radar, patio, crm, pubs] = await Promise.all([ler("radar", []), ler("patio", []), ler("crm", null), ler("publicacoes", null)]);
      const encontros = crm ? encontrar(crm.deals, crm.contacts, await todasMaquinas()) : [];
      return json(res, 200, { margem, radarNovos: radar.filter((r) => r.status === "novo").length,
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
            if (acao === "publicar") {
              if (!Number.isFinite(precoSite(item, margem))) throw Object.assign(new Error("Informe o preço de origem antes de publicar."), { status: 400 });
              // Sem arte nem foto pública a vitrine da página inicial esconde a máquina, e o ADM diria "publicado" à toa.
              if (!item.arte && !fotosPublicas(item).length) throw Object.assign(new Error("Sem arte nem foto própria da máquina: não publica."), { status: 400 });
              // Congela o preço do site no momento da publicação (origem + margem atual).
              item.precoSite = precoSite(item, margem);
              item.status = "publicado"; item.publicadoEm = new Date().toISOString();
            } else if (acao === "despublicar") item.status = "novo";
            else { item.status = "descartado"; fotosParaApagar = item.fotos || []; item.fotos = []; item.fotosMarca = []; }
          } else {
            if (acao === "publicar" && !item.arte && !fotosPublicas(item).length) throw Object.assign(new Error("Sem foto da máquina: não publica."), { status: 400 });
            item.publicado = acao === "publicar"; if (item.publicado) item.publicadoEm = new Date().toISOString();
          }
        } else throw Object.assign(new Error("Ação inválida."), { status: 405 });
        resultado = lista[i] || { ok: true };
      });
      await apagarFotos(fotosParaApagar);
      return json(res, 200, resultado);
    }

    if (rota === "/publicacoes" && metodo === "GET") return json(res, 200, await listarPublicacoes());
    if (rota === "/publicacoes" && metodo === "POST") return json(res, 200, await importarBackup(await lerCorpo(req)));
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
      return json(res, 200, { ok: true, contatos: b.contacts.length, negociacoes: b.deals.length });
    }

    if (rota === "/encontros" && metodo === "GET") {
      const crm = await ler("crm", null);
      return json(res, 200, crm ? encontrar(crm.deals, crm.contacts, await todasMaquinas()) : []);
    }

    if (rota === "/config" && metodo === "PUT") {
      const e = await lerCorpo(req, LIMITE_PEQUENO);
      const novo = { ...cfg };
      if ("margem" in e) {
        const nova = valorEmReais(e.margem);
        if (nova == null || nova < 0 || nova > 1_000_000) return json(res, 400, { erro: "Margem inválida." });
        novo.margem = nova;
      }
      if ("avisoWebhook" in e) {
        const url = String(e.avisoWebhook || "").trim();
        if (url && !/^https:\/\/\S+$/.test(url)) return json(res, 400, { erro: "O endereço do aviso precisa começar com https://" });
        novo.avisoWebhook = url || undefined;
      }
      await gravar("config", novo);
      return json(res, 200, { margem: novo.margem ?? 20000, avisoWebhook: novo.avisoWebhook || "" });
    }
    if (rota === "/entrada" && metodo === "GET") {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      // O token só é mostrado na hora em que é gerado; depois o servidor guarda apenas o hash.
      return json(res, 200, { url: `https://${host}/adm/entrada/radar`, token: "", ligada: Boolean(cfg.tokenEntradaHash || cfg.tokenEntrada), avisoWebhook: cfg.avisoWebhook || "" });
    }
    if (rota === "/entrada/token" && metodo === "POST") {
      const novo = randomBytes(24).toString("base64url");
      const { tokenEntrada, ...resto } = cfg; // apaga qualquer token antigo em texto puro
      await gravar("config", { ...resto, tokenEntradaHash: hashToken(novo) });
      return json(res, 200, { token: novo });
    }
    if (rota === "/senha" && metodo === "POST") {
      const e = await lerCorpo(req, LIMITE_PEQUENO);
      if (!senhaConfere(e.atual, cfg)) return json(res, 401, { erro: "Senha atual incorreta." });
      if (typeof e.nova !== "string" || e.nova.length < 8) return json(res, 400, { erro: "A nova senha precisa de 8 caracteres ou mais." });
      // Segredo novo: sessões abertas com a senha antiga deixam de valer.
      const segredo = randomBytes(32).toString("hex");
      await gravar("config", { ...cfg, ...hashSenha(e.nova), segredo });
      return json(res, 200, { ok: true }, { "Set-Cookie": criarCookie(segredo, viaHttps(req)) });
    }
    return json(res, 404, { erro: "Rota não encontrada." });
  } catch (err) {
    if (err.status) return json(res, err.status, { erro: err.message });
    console.error(err);
    return json(res, 500, { erro: "Erro interno." });
  }
}
