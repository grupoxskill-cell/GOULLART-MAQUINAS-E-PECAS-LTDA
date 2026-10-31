// Área ADM: Radar (preço do site = origem + margem, publicação manual), Pátio, CRM e Encontros.
// Tudo atrás de login; os dados ficam em DATA_DIR e nunca no repositório.
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ler, gravar, prepararPastas, FOTOS_DIR } from "./dados.js";
import { config, criarCookie, cookieSaida, sessaoValida, bloqueado, registrarFalha, senhaConfere, hashSenha } from "./auth.js";
import { encontrar, tipoDe, valorEmReais } from "./encontros.js";
import { comSlugs } from "./paginas.js";
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

async function lerCorpo(req) {
  let tamanho = 0;
  const partes = [];
  for await (const p of req) {
    tamanho += p.length;
    if (tamanho > LIMITE_JSON) throw Object.assign(new Error("Arquivo grande demais."), { status: 413 });
    partes.push(p);
  }
  try { return JSON.parse(Buffer.concat(partes).toString("utf-8") || "{}"); }
  catch { throw Object.assign(new Error("Dados inválidos."), { status: 400 }); }
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

export async function maquinasPublicas() {
  const [site, radar, patio, cfg] = await Promise.all([
    readFile(join(PUBLIC_DIR, "maquinas.json"), "utf-8").then(JSON.parse).catch(() => []),
    ler("radar", []), ler("patio", []), config()]);
  const margem = cfg?.margem ?? 20000;
  const deRadar = radar.filter((r) => r.status === "publicado").map((r) => ({
    referencia: `R-${r.id.slice(0, 6).toUpperCase()}`, titulo: r.titulo, categoria: r.categoria, ano: r.ano,
    horas: r.horas, preco: reais(precoSite(r, margem)), fotos: r.fotos }));
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
      image: m.arte ? `/${m.arte}` : m.fotos?.[0] ? `/${m.fotos[0]}` : "",
      images: [m.arte, ...(m.fotos || [])].filter(Boolean).map((f) => `/${f}`),
      publishedAt: m.publicadoEm || m.criadoEm || null, receivedAt: m.criadoEm || null, retentionPolicy: "owner_confirmation",
    };
  };
  return [
    ...patio.filter((p) => p.publicado).map((p) => item(p, "P", p.preco, p.local)),
    ...radar.filter((r) => r.status === "publicado").map((r) => item(r, "R", precoSite(r, margem))),
  ].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
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
async function servirArquivoAdm(res, nome, tipo) {
  try {
    res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-cache" });
    res.end(await readFile(join(ADM_DIR, nome)));
  } catch { res.writeHead(404).end(); }
}

function mesmaOrigem(req) {
  const origem = req.headers.origin;
  if (!origem) return true;
  try { return new URL(origem).host === (req.headers["x-forwarded-host"] || req.headers.host); }
  catch { return false; }
}

const ipDe = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
const viaHttps = (req) => req.headers["x-forwarded-proto"] === "https" || /https/.test(req.headers["cf-visitor"] || "");

export async function rotaAdm(req, res, pathname) {
  if (pathname === "/adm") { res.writeHead(301, { Location: "/adm/" }); return res.end(); }
  if (req.method === "GET" && pathname === "/adm/") return servirArquivoAdm(res, "index.html", "text/html; charset=utf-8");
  if (req.method === "GET" && pathname === "/adm/app.js") return servirArquivoAdm(res, "app.js", "text/javascript; charset=utf-8");
  if (req.method === "GET" && pathname === "/adm/app.css") return servirArquivoAdm(res, "app.css", "text/css; charset=utf-8");
  // Catálogo público do site (sem login, só campos públicos).
  if (req.method === "GET" && pathname === "/adm/catalogo.json") {
    try {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(await catalogoPublico(await maquinasDoAdm())));
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
      const { senha } = await lerCorpo(req);
      if (!senhaConfere(senha, cfg)) { registrarFalha(ip); return json(res, 401, { erro: "Senha incorreta." }); }
      return json(res, 200, { ok: true }, { "Set-Cookie": criarCookie(cfg.segredo, viaHttps(req)) });
    }
    if (rota === "/sair" && metodo === "POST") return json(res, 200, { ok: true }, { "Set-Cookie": cookieSaida });
    if (!sessaoValida(req, cfg.segredo)) return json(res, 401, { erro: "Faça login." });

    const margem = cfg.margem ?? 20000;

    if (rota === "/resumo" && metodo === "GET") {
      const [radar, patio, crm, pubs] = await Promise.all([ler("radar", []), ler("patio", []), ler("crm", null), ler("publicacoes", null)]);
      const encontros = crm ? encontrar(crm.deals, crm.contacts, await todasMaquinas()) : [];
      return json(res, 200, { margem, radarNovos: radar.filter((r) => r.status === "novo").length,
        radarPublicados: radar.filter((r) => r.status === "publicado").length,
        patio: patio.length, patioPublicados: patio.filter((p) => p.publicado).length,
        crmImportadoEm: crm?.importadoEm || null, encontros: encontros.length,
        publicacoesImportadasEm: pubs?.importadoEm || null, publicacoesNoSite: pubs ? pubs.itens.filter((i) => i.noSite).length : 0,
        encontrosRadarNovo: encontros.filter((e) => e.achados.some((a) => a.maquina.origem === "Radar" && !a.maquina.publicado)).length });
    }

    let m;
    if ((m = /^\/(radar|patio)$/.exec(rota))) {
      const tipo = m[1];
      const lista = await ler(tipo, []);
      if (metodo === "GET") {
        return json(res, 200, lista.map((i) => tipo === "radar" ? { ...i, precoSiteCalculado: precoSite(i, margem) } : i)
          .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))));
      }
      if (metodo === "POST") {
        const e = await lerCorpo(req);
        const item = { id: randomBytes(8).toString("hex"), ...limparMaquina(e), criadoEm: new Date().toISOString() };
        if (tipo === "radar") Object.assign(item, { precoOrigem: valorEmReais(e.precoOrigem), fonte: texto(e.fonte, 300), status: "novo" });
        else Object.assign(item, { preco: valorEmReais(e.preco), publicado: false });
        lista.push(item);
        await gravar(tipo, lista);
        return json(res, 201, item);
      }
    }
    if ((m = /^\/(radar|patio)\/([a-f0-9]{16})(?:\/(publicar|despublicar|descartar))?$/.exec(rota))) {
      const [, tipo, id, acao] = m;
      const lista = await ler(tipo, []);
      const i = lista.findIndex((x) => x.id === id);
      if (i < 0) return json(res, 404, { erro: "Máquina não encontrada." });
      if (metodo === "DELETE" && !acao) {
        lista.splice(i, 1);
      } else if (metodo === "PUT" && !acao) {
        const e = await lerCorpo(req);
        const antigo = lista[i];
        lista[i] = { ...antigo, ...limparMaquina(e, antigo) };
        if (tipo === "radar") {
          if ("precoOrigem" in e) lista[i].precoOrigem = valorEmReais(e.precoOrigem);
          if ("precoSite" in e) lista[i].precoSite = e.precoSite === "" || e.precoSite == null ? undefined : valorEmReais(e.precoSite);
          if ("fonte" in e) lista[i].fonte = texto(e.fonte, 300);
        } else if ("preco" in e) lista[i].preco = valorEmReais(e.preco);
      } else if (metodo === "POST" && acao) {
        const item = lista[i];
        if (tipo === "radar") {
          if (acao === "publicar") {
            if (!Number.isFinite(precoSite(item, margem))) return json(res, 400, { erro: "Informe o preço de origem antes de publicar." });
            // Congela o preço do site no momento da publicação (origem + margem atual).
            item.precoSite = precoSite(item, margem);
            item.status = "publicado"; item.publicadoEm = new Date().toISOString();
          } else if (acao === "despublicar") item.status = "novo";
          else item.status = "descartado";
        } else { item.publicado = acao === "publicar"; if (item.publicado) item.publicadoEm = new Date().toISOString(); }
      } else return json(res, 405, { erro: "Ação inválida." });
      await gravar(tipo, lista);
      return json(res, 200, lista[i] || { ok: true });
    }

    if (rota === "/publicacoes" && metodo === "GET") return json(res, 200, await listarPublicacoes());
    if (rota === "/publicacoes" && metodo === "POST") return json(res, 200, await importarBackup(await lerCorpo(req)));
    if ((m = /^\/publicacoes\/([^/]+)$/.exec(rota)) && metodo === "PUT") {
      if (!ID_RE.test(m[1])) return json(res, 404, { erro: "Publicação não encontrada." });
      return json(res, 200, await alterarPublicacao(m[1], await lerCorpo(req)));
    }
    if (rota === "/radares" && metodo === "GET") return json(res, 200, await listarRadares());
    if ((m = /^\/radares\/([^/]+)$/.exec(rota)) && metodo === "PUT") return json(res, 200, await alterarRadar(decodeURIComponent(m[1]), await lerCorpo(req)));

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
      const e = await lerCorpo(req);
      const nova = valorEmReais(e.margem);
      if (nova == null || nova < 0 || nova > 1_000_000) return json(res, 400, { erro: "Margem inválida." });
      await gravar("config", { ...cfg, margem: nova });
      return json(res, 200, { margem: nova });
    }
    if (rota === "/senha" && metodo === "POST") {
      const e = await lerCorpo(req);
      if (!senhaConfere(e.atual, cfg)) return json(res, 401, { erro: "Senha atual incorreta." });
      if (typeof e.nova !== "string" || e.nova.length < 8) return json(res, 400, { erro: "A nova senha precisa de 8 caracteres ou mais." });
      await gravar("config", { ...cfg, ...hashSenha(e.nova) });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { erro: "Rota não encontrada." });
  } catch (err) {
    if (err.status) return json(res, err.status, { erro: err.message });
    console.error(err);
    return json(res, 500, { erro: "Erro interno." });
  }
}
