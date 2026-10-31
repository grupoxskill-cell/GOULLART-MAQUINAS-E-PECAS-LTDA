// Publicações e Radares vindos do painel do ChatGPT (backup goullart-agro-brasil-backup.json).
// O backup fica só em DATA_DIR. O site lê /adm/catalogo.json, que mostra apenas campos públicos.
// Sem backup importado, o catálogo público é a cópia estática em espelho/api/catalog.json.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ler, gravar } from "./dados.js";

const CATALOGO_ESTATICO = fileURLToPath(new URL("../espelho/api/catalog.json", import.meta.url));
const ORIGEM_PROPRIA = "https://www.goullartmaquinaspesadas.com.br";
import "../espelho/catalog-data.js";
export const CATEGORIAS_PUB = ["maquinas", "pecas", "implementos", "locacao", "licitacao"];
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const texto = (v, max) => String(v ?? "").trim().slice(0, max);
const semOrigem = (url) => String(globalThis.GoullartCatalogData.asset(url) || "").split(ORIGEM_PROPRIA).join("");
const imagemValida = (url) => /^\/(?:assets|media|fotos)\/[A-Za-z0-9_\-./%]+$/.test(url);

export async function catalogoEstatico() {
  try { return JSON.parse(await readFile(CATALOGO_ESTATICO, "utf-8")); }
  catch { return { items: [], opportunities: [], updatedAt: null }; }
}

function erro(status, mensagem) { return Object.assign(new Error(mensagem), { status }); }

// Importa o backup. Fica no site exatamente o que o site mostra hoje; o resto entra como "fora do site".
export async function importarBackup(b) {
  if (!Array.isArray(b?.items) || !b.items.every((i) => i && typeof i.id === "string")) {
    throw erro(400, "Arquivo não parece o backup do painel GOULLART (goullart-agro-brasil-backup.json).");
  }
  const base = await catalogoEstatico();
  const noSite = new Map((base.items || []).map((i) => [i.id, i]));
  const itens = b.items.filter((i) => ID_RE.test(i.id)).map((i) => {
    const publico = noSite.get(i.id);
    const imagens = [i.image, ...(Array.isArray(i.images) ? i.images : [])]
      .map((x) => semOrigem(typeof x === "string" ? x : x?.src)).filter(imagemValida);
    return {
      id: i.id,
      codigo: publico?.publicCode || "",
      titulo: texto(i.title, 160),
      categoria: CATEGORIAS_PUB.includes(i.category) ? i.category : "maquinas",
      preco: Number.isFinite(i.price) ? i.price : null,
      textoPublico: texto(i.publicText, 2000),
      notasPrivadas: texto(i.privateNotes, 5000),
      fonte: texto(i.sourceKey, 80),
      imagens: [...new Set(imagens)].slice(0, 12),
      noSite: Boolean(publico),
      catalogItem: Boolean(i.catalogItem),
      publicadoEm: publico?.publishedAt ?? i.publishedAt ?? null,
      recebidoEm: publico?.receivedAt || i.receivedAt || i.updatedAt || null,
      atualizadoEm: i.updatedAt || null,
    };
  });
  const radares = (Array.isArray(b.radars) ? b.radars : []).filter((r) => r && typeof r.id === "string").map((r) => ({
    id: texto(r.id, 64), nome: texto(r.name, 120), criterios: texto(r.criteria, 4000), status: texto(r.status, 30),
  }));
  await gravar("publicacoes", { importadoEm: new Date().toISOString(), itens });
  await gravar("radares", radares);
  return { itens: itens.length, noSite: itens.filter((i) => i.noSite).length, radares: radares.length };
}

export async function listarPublicacoes() {
  return ler("publicacoes", null);
}

export async function alterarPublicacao(id, e) {
  const dados = await ler("publicacoes", null);
  const item = dados?.itens.find((i) => i.id === id);
  if (!item) throw erro(404, "Publicação não encontrada.");
  if ("titulo" in e) { const t = texto(e.titulo, 160); if (!t) throw erro(400, "Informe o título."); item.titulo = t; }
  if ("categoria" in e && CATEGORIAS_PUB.includes(e.categoria)) item.categoria = e.categoria;
  if ("preco" in e) {
    const n = e.preco === "" || e.preco == null ? null : Number(String(e.preco).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (n != null && (!Number.isFinite(n) || n < 0)) throw erro(400, "Preço inválido.");
    item.preco = n;
  }
  if ("textoPublico" in e) item.textoPublico = texto(e.textoPublico, 2000);
  if ("notasPrivadas" in e) item.notasPrivadas = texto(e.notasPrivadas, 5000);
  if ("imagens" in e && Array.isArray(e.imagens)) item.imagens = e.imagens.map(String).filter(imagemValida).slice(0, 12);
  if ("noSite" in e) {
    item.noSite = Boolean(e.noSite);
    if (item.noSite && !item.publicadoEm) item.publicadoEm = new Date().toISOString();
  }
  item.atualizadoEm = new Date().toISOString();
  await gravar("publicacoes", dados);
  return item;
}

function proximoCodigo(itens) {
  const usados = itens.map((i) => Number(/^GOUL-(\d+)$/.exec(i.codigo)?.[1] || 0));
  return `GOUL-${String(Math.max(0, ...usados) + 1).padStart(3, "0")}`;
}

// Formato que o site (app.js / hero-offers.mjs) espera, só com campos públicos.
// `extras`: máquinas publicadas pelo Radar e pelo Pátio do ADM, mostradas primeiro.
export async function catalogoPublico(extras = []) {
  const base = await catalogoEstatico();
  const dados = await ler("publicacoes", null);
  if (!dados) {
    return globalThis.GoullartCatalogData.feed({ ...base, items: [...extras, ...(base.items || []).map(({ sourceKey, ...resto }) => resto)] });
  }
  let alterou = false;
  const items = dados.itens.filter((i) => i.noSite).map((i) => {
    if (!i.codigo) { i.codigo = proximoCodigo(dados.itens); alterou = true; }
    return {
      id: i.id, publicCode: i.codigo, state: null, title: i.titulo, category: i.categoria,
      price: i.preco, catalogItem: i.catalogItem || undefined, publicText: i.textoPublico,
      image: i.imagens[0] || "", images: i.imagens, publishedAt: i.publicadoEm, receivedAt: i.recebidoEm,
      retentionPolicy: "owner_confirmation",
    };
  });
  if (alterou) await gravar("publicacoes", dados);
  return globalThis.GoullartCatalogData.feed({ opportunities: base.opportunities || [], items: [...extras, ...items], updatedAt: dados.importadoEm });
}

export async function listarRadares() {
  return ler("radares", []);
}

export async function alterarRadar(id, e) {
  const radares = await ler("radares", []);
  const r = radares.find((x) => x.id === id);
  if (!r) throw erro(404, "Radar não encontrado.");
  if ("nome" in e) r.nome = texto(e.nome, 120) || r.nome;
  if ("criterios" in e) r.criterios = texto(e.criterios, 4000);
  if ("status" in e) r.status = texto(e.status, 30);
  await gravar("radares", radares);
  return r;
}
