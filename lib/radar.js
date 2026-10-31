// Radar automático (a cada 3 horas): conta do "abaixo do mercado" e montagem da entrada pública.
// Só dados públicos passam por aqui. Fonte, contato do vendedor e preço de origem nunca vão para o GitHub.

export const MARGEM_PADRAO = 20000; // mesma margem padrão do ADM (preço do site = origem + margem)
export const DESCONTO_MINIMO = 0.15; // "barata" = pelo menos 15% abaixo das parecidas

// "R$ 180.000 ou R$ 195.000" -> 180000; "R$ 275.000 cada" -> 275000; sem número -> null
export function precoEmReais(texto) {
  const m = String(texto ?? "").match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?\s*(mil)?/i);
  if (!m) return null;
  let v = Number(m[1].replace(/\./g, ""));
  if (m[2]) v *= 1000;
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

export function marcaDe(titulo) {
  const t = ` ${normal(titulo)} `;
  const achada = MARCAS.find((m) => t.includes(` ${m} `));
  return achada === "cat" ? "caterpillar" : achada ?? null;
}

// Modelo = primeiro trecho com número depois da marca ("PC200", "R220", "320D"), só letras e números.
export function modeloDe(titulo) {
  const m = normal(titulo).match(/\b([a-z]{0,4}\s?-?\d{2,4}[a-z]{0,3})\b/);
  return m ? m[1].replace(/[\s-]/g, "") : null;
}

function anoDe(a) {
  const m = String(a ?? "").match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

// Máquinas parecidas do catálogo: mesma categoria; mesma marca; ano até 3 anos de diferença.
// Mesmo modelo pesa mais: se houver parecidas do mesmo modelo, só elas contam.
export function parecidas(maquina, catalogo) {
  const marca = marcaDe(maquina.titulo), modelo = modeloDe(maquina.titulo), ano = anoDe(maquina.ano);
  const base = catalogo.filter((c) => c.categoria === maquina.categoria && marcaDe(c.titulo) === marca && marca
    && precoEmReais(c.preco) && (!ano || !anoDe(c.ano) || Math.abs(anoDe(c.ano) - ano) <= 3)
    && !/lote|cada/i.test(`${c.titulo} ${c.preco}`));
  const mesmoModelo = modelo ? base.filter((c) => modeloDe(c.titulo) === modelo) : [];
  return mesmoModelo.length ? mesmoModelo : base;
}

function mediana(v) {
  const s = [...v].sort((a, b) => a - b), i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

// Compara o preço que a GOULLART paga (origem) com a mediana das parecidas do catálogo.
export function avaliar(maquina, catalogo) {
  const origem = precoEmReais(maquina.precoOrigem);
  const iguais = parecidas(maquina, catalogo);
  if (!origem) return { barata: false, motivo: "sem preço" };
  if (!iguais.length) return { barata: false, motivo: "sem parecidas no catálogo", origem };
  const referencia = mediana(iguais.map((c) => precoEmReais(c.preco)));
  const desconto = 1 - origem / referencia;
  return { barata: desconto >= DESCONTO_MINIMO, desconto, referencia, origem, comparadas: iguais.map((c) => c.referencia),
    motivo: desconto >= DESCONTO_MINIMO ? `${Math.round(desconto * 100)}% abaixo` : `só ${Math.round(desconto * 100)}% abaixo` };
}

export function precoSite(origem, margem = MARGEM_PADRAO) {
  return origem + margem;
}

// Entrada pública para public/maquinas.json (sem fonte, cidade exata, contato ou preço de origem).
export function entradaPublica({ codigo, titulo, categoria, ano, horas, precoSite: valor, fotos = [] }) {
  if (!/^RADAR-\d{6}-\d{2}$/.test(codigo)) throw new Error(`código inválido: ${codigo}`);
  const data = `20${codigo.slice(6, 8)}-${codigo.slice(8, 10)}-${codigo.slice(10, 12)}`;
  return { ficha: `radar-${data}`, referencia: codigo, titulo: String(titulo).trim(), categoria,
    ano: String(ano ?? ""), horas: String(horas ?? ""), preco: formatarReais(valor), fotos };
}

export const CATEGORIAS = ["Escavadeiras", "Pás-carregadeiras", "Retroescavadeiras", "Motoniveladoras", "Tratores", "Caminhões", "Outros"];
