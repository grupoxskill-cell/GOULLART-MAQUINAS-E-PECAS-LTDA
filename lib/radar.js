// Radar automático (a cada 3 horas): conta do "abaixo do mercado" e montagem da entrada pública.
// Só dados públicos passam por aqui. Fonte, contato do vendedor e preço de origem nunca vão para o GitHub.

export const MARGEM_PADRAO = 20000; // mesma margem padrão do ADM (preço do site = origem + margem)
export const DESCONTO_MINIMO = 0.15; // "barata" = pelo menos 15% abaixo das parecidas
export const DIAS_RECENTE = 15; // anúncio publicado há no máximo 15 dias (regra de Júnior, 04/11/2026)

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

// "Itaúna, MG" / "Itaúna - MG" / "Itaúna/MG" -> "Itaúna - MG"; sem cidade ou sem UF válida -> null
export function localValido(texto) {
  const m = String(texto ?? "").trim().match(/^(.*?[A-Za-zÀ-ÿ].*?)\s*[,/-]\s*([A-Za-z]{2})$/);
  if (!m || !UFS.includes(m[2].toUpperCase())) return null;
  return `${m[1].trim()} - ${m[2].toUpperCase()}`;
}

// Só vira oferta o anúncio real, recente e com localização (regra de Júnior, 31/10/2026).
// a: { dataAnuncio (AAAA-MM-DD), local, temFotoOriginal, preco, ativo (link abriu e o anúncio está no ar) }
export function anuncioAprovado(a, hoje = new Date()) {
  const motivos = [];
  if (!precoEmReais(a.preco)) motivos.push("sem preço");
  if (!localValido(a.local)) motivos.push("sem cidade e estado");
  if (!a.temFotoOriginal) motivos.push("sem foto real da máquina");
  if (a.ativo === false) motivos.push("anúncio fora do ar");
  const data = /^\d{4}-\d{2}-\d{2}$/.test(a.dataAnuncio ?? "") ? new Date(`${a.dataAnuncio}T12:00:00-03:00`) : null;
  if (!data) motivos.push("sem data do anúncio");
  else if ((hoje - data) / 86400000 > DIAS_RECENTE) motivos.push(`anúncio com mais de ${DIAS_RECENTE} dias`);
  return { ok: motivos.length === 0, motivos };
}

// "R$ 180.000 ou R$ 195.000" -> 180000; "R$ 275.000 cada" -> 275000; "1,2 milhão" -> 1200000; sem número -> null
// Ponto seguido de 3 dígitos é separador de milhar ("259.000"); vírgula ou ponto com 1–2 dígitos é decimal ("1,2 milhão").
export function precoEmReais(texto) {
  const m = String(texto ?? "").match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2})(?!\d))?\s*(milh(?:ão|ões|ao|oes)|mi\b|mil\b)?/i);
  if (!m) return null;
  const inteiro = Number(m[1].replace(/\./g, ""));
  const decimal = m[2] ? Number(`0.${m[2]}`) : 0;
  const unidade = (m[3] || "").toLowerCase();
  const fator = unidade.startsWith("milh") || unidade === "mi" ? 1_000_000 : unidade === "mil" ? 1000 : 1;
  const v = Math.round((inteiro + decimal) * fator);
  return v >= 1000 ? v : null;
}

export function formatarReais(v) {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

const MARCAS = ["caterpillar", "cat", "komatsu", "hyundai", "john deere", "volvo", "doosan", "jcb", "case", "new holland",
  "liugong", "xcmg", "sany", "hitachi", "kobelco", "bobcat", "randon", "valtra", "massey ferguson", "scania",
  "volkswagen", "mercedes", "ford", "iveco", "dynapac", "bomag", "sdlg", "lonking", "zoomlion"];

function normal(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const REGEX_MARCA = new RegExp(`\\b(${MARCAS.join("|")})\\b`);

// Preserva a série e a versão: R220LC-9 e R220LC-9S são modelos diferentes.
export function marcaDe(titulo) {
  const marca = normal(titulo).match(REGEX_MARCA)?.[0];
  return marca === "cat" ? "caterpillar" : marca ?? null;
}

export function modeloDe(titulo) {
  const texto = normal(titulo);
  const marca = texto.match(REGEX_MARCA);
  if (!marca) return null;
  const depois = texto.slice(marca.index + marca[0].length).split(/\b(?:ano\s+)?(?:19|20)\d{2}\b/)[0];
  const modelo = depois.replace(/[^a-z0-9]/g, "");
  return /\d/.test(modelo) ? modelo : null;
}

function anoDe(valor) {
  return /^(?:19|20)\d{2}$/.test(String(valor).trim()) ? Number(valor) : null;
}

function horasDe(valor) {
  const m = String(valor ?? "").trim().match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(?:h|hs|horas?)?$/i);
  if (!m) return null;
  const horas = Number(m[1].replace(/\./g, "") + (m[2] ? "." + m[2] : ""));
  return Number.isFinite(horas) ? horas : null;
}

// No catálogo há parcelas, lotes e alternativas de preço. Só entra valor total inequívoco.
function precoTotal(valor) {
  if (typeof valor === "number") return Number.isSafeInteger(valor) && valor >= 1000 ? valor : null;
  const texto = normal(valor).trim();
  if (!/^(?:r\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:mil|milhao|milhoes|mi)?(?:\s+(?:a vista|no pix))?$/.test(texto)) return null;
  const preco = precoEmReais(texto);
  return Number.isSafeInteger(preco) ? preco : null;
}

function linkAnuncio(texto) {
  try {
    const url = new URL(texto);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    for (const nome of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid$|gclid$)/i.test(nome)) url.searchParams.delete(nome);
    }
    url.searchParams.sort();
    return url.host.toLowerCase() + url.pathname.replace(/\/$/, "") + url.search;
  } catch { return ""; }
}

function identidades(item, ano, horas) {
  // Agrupa também republicações com identificadores diferentes e a mesma leitura de horas e ano.
  const chaves = new Set([`leitura:${ano}:${horas}`]);
  for (const id of [item.referencia, item.codigo, item.id]) {
    if (id) chaves.add("id:" + normal(id).trim());
  }
  for (const serie of [item.serie, item.numeroSerie, item.serial]) {
    if (serie) chaves.add("serie:" + normal(serie).trim());
  }
  const url = linkAnuncio(item.link);
  if (url) chaves.add("url:" + url);
  for (const foto of item.fotos || []) {
    if (typeof foto === "string" && foto.trim()) chaves.add("foto:" + foto);
  }
  return chaves;
}

// Fichas que se ligam por código, foto, URL ou leitura são uma só unidade.
// Quando os preços da mesma unidade divergem, usamos o menor para não inflar a referência.
export function parecidas(maquina, catalogo) {
  const marca = marcaDe(maquina.titulo), modelo = modeloDe(maquina.titulo);
  const ano = anoDe(maquina.ano), horas = horasDe(maquina.horas);
  if (!maquina.categoria || !marca || !modelo || !ano || horas === null) return [];
  const toleranciaHoras = Math.min(1000, horas * 0.20);
  let grupos = [{ chaves: identidades(maquina, ano, horas), propria: true }];
  for (const item of catalogo) {
    if (item.categoria !== maquina.categoria || marcaDe(item.titulo) !== marca || modeloDe(item.titulo) !== modelo) continue;
    const anoItem = anoDe(item.ano), horasItem = horasDe(item.horas);
    if (!anoItem || Math.abs(anoItem - ano) > 2 || horasItem === null || Math.abs(horasItem - horas) > toleranciaHoras) continue;
    const chaves = identidades(item, anoItem, horasItem);
    const grupo = { chaves, propria: false, ficha: null, preco: Infinity };
    const restantes = [];
    for (const outro of grupos) {
      if (![...outro.chaves].some(chave => chaves.has(chave))) { restantes.push(outro); continue; }
      for (const chave of outro.chaves) chaves.add(chave);
      grupo.propria ||= outro.propria;
      if (outro.preco < grupo.preco) { grupo.ficha = outro.ficha; grupo.preco = outro.preco; }
    }
    const preco = precoTotal(item.preco);
    if ((item.referencia || item.codigo || linkAnuncio(item.link)) && preco && preco < grupo.preco && !/\b(?:lote|cada)\b/i.test(item.titulo)) {
      grupo.preco = preco;
      grupo.ficha = item;
    }
    grupos = [...restantes, grupo];
  }
  return grupos.filter(g => !g.propria && g.ficha).map(g => g.ficha);
}

function mediana(v) {
  const s = [...v].sort((a, b) => a - b), i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

// Compara o preço que a GOULLART paga (origem) com a mediana das parecidas do catálogo.
export function avaliar(maquina, catalogo) {
  const origem = precoTotal(maquina.precoOrigem);
  if (!origem) return { barata: false, motivo: "sem preço total confirmado" };
  const iguais = parecidas(maquina, catalogo);
  const comparadas = iguais.map(c => c.referencia || c.codigo || c.link);
  if (iguais.length < 3) return { barata: false, motivo: `amostra insuficiente (${iguais.length} de 3 comparáveis)`, origem, comparadas };
  const precos = iguais.map(c => precoTotal(c.preco));
  const referencia = mediana(precos);
  const desconto = (referencia - origem) / referencia;
  const barata = desconto >= DESCONTO_MINIMO;
  return { barata, desconto, referencia, origem, comparadas, metodo: "mediana dos preços pedidos",
    faixa: [Math.min(...precos), Math.max(...precos)],
    motivo: barata ? `${Math.round(desconto * 100)}% abaixo da mediana` : "desconto inferior a 15% sobre a mediana" };
}

export function precoSite(origem, margem = MARGEM_PADRAO) {
  return origem + margem;
}

// Entrada pública para public/maquinas.json: cidade e estado sim; fonte, contato e preço de origem nunca.
// precoMercado (opcional) é a mediana pública das parecidas: vira o selo "abaixo do mercado" na página /ofertas.
// O desconto é calculado sobre o preço do site, nunca sobre o preço de origem (que não sai do ADM).
export function entradaPublica({ codigo, titulo, categoria, ano, horas, local, precoSite: valor, precoMercado, fotos = [] }) {
  if (!/^RADAR-\d{6}-\d{2}$/.test(codigo)) throw new Error(`código inválido: ${codigo}`);
  const cidade = localValido(local);
  if (!cidade) throw new Error(`localização precisa ter cidade e estado: ${local}`);
  const data = `20${codigo.slice(6, 8)}-${codigo.slice(8, 10)}-${codigo.slice(10, 12)}`;
  const entrada = { ficha: `radar-${data}`, referencia: codigo, titulo: String(titulo).trim(), categoria,
    ano: String(ano ?? ""), horas: String(horas ?? ""), local: cidade, preco: formatarReais(valor), fotos };
  const mercado = precoEmReais(precoMercado);
  if (mercado && mercado > valor) Object.assign(entrada, { mercado: formatarReais(mercado), desconto: Math.round((1 - valor / mercado) * 100) });
  return entrada;
}

// Selo de oferta no formato que o site espera (catalog-page-client.js): só quando há preço de mercado acima do preço do site.
export function ofertaPublica(precoSiteValor, precoMercadoValor, data) {
  const site = precoEmReais(precoSiteValor), mercado = precoEmReais(precoMercadoValor);
  if (!site || !mercado || mercado <= site) return undefined;
  return { verified: true, price: site, referencePrice: mercado, discountPercent: Math.round((1 - site / mercado) * 100), reviewedAt: String(data || "").slice(0, 10) };
}

export const CATEGORIAS = ["Escavadeiras", "Pás-carregadeiras", "Retroescavadeiras", "Motoniveladoras", "Tratores", "Caminhões", "Outros"];
