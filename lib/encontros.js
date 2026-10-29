// Cruza pedidos do CRM com máquinas do Radar, do Pátio e do catálogo do site.
// Pontua tipo de máquina, marca, modelo e orçamento; só devolve encontros com pontuação mínima.

const normalizar = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TIPOS = [
  ["Escavadeiras", /escavadeira|escavadora|\bpc ?\d{3}\b/],
  ["Pás-carregadeiras", /pa[ -]?carregadeira|carregadeira|minicarregadeira|\bbobcat\b/],
  ["Retroescavadeiras", /retro ?escavadeira|\bretro\b/],
  ["Tratores", /trator|\bd\d{1,2}\b/],
  ["Motoniveladoras", /motoniveladora|patrol/],
  ["Caminhões", /caminhao|cacamba|basculante|pipa|cavalo mecanico|roll[- ]?on/],
];

const MARCAS = [
  ["caterpillar", /\bcaterpillar\b|\bcat\b/], ["komatsu", /komatsu|\bpc\b|\bpc ?\d{2,3}/], ["volvo", /volvo|\bec ?\d{3}/], ["hyundai", /hyundai/],
  ["john deere", /john deere|\bdeere\b|\bjd\b/], ["case", /\bcase\b/], ["jcb", /\bjcb\b/],
  ["doosan", /doosan|develon|\bdx ?\d{3}/], ["liugong", /liugong/], ["sany", /\bsany\b/], ["xcmg", /xcmg/],
  ["new holland", /new holland/], ["scania", /scania/], ["mercedes", /mercedes/], ["volkswagen", /volkswagen|\bvw\b/],
  ["ford", /\bford\b/], ["valtra", /valtra/], ["randon", /randon/],
];

const ETAPAS_FECHADAS = new Set(["perdido", "entregue", "fora do funil comercial"]);

export function tipoDe(texto) {
  const t = normalizar(texto);
  return TIPOS.find(([, re]) => re.test(t))?.[0] ?? null;
}

function marcasDe(texto) {
  const t = normalizar(texto);
  return new Set(MARCAS.filter(([, re]) => re.test(t)).map(([m]) => m));
}

// Modelos são palavras com letra e número (PC200, 320D, D6, 966L) ou números de 3+ dígitos.
function modelosDe(texto) {
  const t = normalizar(texto).replace(/(\b[a-z]{1,3})[ -](\d{2,4}[a-z]?\b)/g, "$1$2");
  return new Set(t.split(/[^a-z0-9]+/).filter((p) =>
    !/^\d+x\d+$/.test(p) && (/[a-z]/.test(p) && /\d/.test(p) || /^\d{3,4}[a-z]?$/.test(p))));
}

// "R$ 520.000", "R$ 355 mil", 380000 → número em reais; null quando não dá para ler.
export function valorEmReais(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = normalizar(v);
  const m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(mil|k)?/);
  if (!m) return null;
  let n = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (m[2]) n *= 1000;
  return n >= 1000 ? n : null;
}

// Pedidos de peças e serviços não são comparados com máquinas inteiras.
// Orçamento do campo próprio ou, se vazio, o primeiro "R$ ..." escrito no pedido.
function orcamentoDe(pedido) {
  const campo = valorEmReais(pedido.budget);
  if (campo) return campo;
  const m = normalizar(pedido.title).match(/r\$\s*[\d.,]+\s*(mil|k)?/);
  return m ? valorEmReais(m[0]) : null;
}

export function pedidoAberto(d) {
  return !d.saleConfirmed && !/^(pecas|servicos)$/.test(normalizar(d.category)) && !ETAPAS_FECHADAS.has(normalizar(d.stage)) &&
    /compra|locacao|troca|pretendid|potencial|indicacao de comprador/.test(normalizar(d.kind));
}

function perfil(texto) {
  return { tipo: tipoDe(texto), marcas: marcasDe(texto), modelos: modelosDe(texto) };
}

export function pontuar(pedido, maquina) {
  const p = perfil([pedido.title, pedido.category, pedido.notes].join(" "));
  const m = perfil([maquina.titulo, maquina.categoria].join(" "));
  const motivos = [];
  let pontos = 0;
  const tipoMaquina = maquina.categoria || m.tipo;
  if (p.tipo && tipoMaquina && p.tipo !== tipoMaquina) return { pontos: 0, motivos: ["outro tipo"] };
  if (p.tipo && p.tipo === tipoMaquina) { pontos += 2; motivos.push("mesmo tipo"); }
  const marca = [...p.marcas].find((x) => m.marcas.has(x));
  if (marca) { pontos += 2; motivos.push(`marca ${marca}`); }
  const modelo = [...p.modelos].find((x) => m.modelos.has(x));
  if (modelo) { pontos += 3; motivos.push(`modelo ${modelo.toUpperCase()}`); }
  const orcamento = orcamentoDe(pedido);
  const preco = valorEmReais(maquina.preco);
  if (orcamento && preco) {
    if (preco <= orcamento * 1.1) { pontos += 1; motivos.push("cabe no orçamento"); }
    else if (preco > orcamento * 1.3) { pontos -= 2; motivos.push("acima do orçamento"); }
  }
  return { pontos, motivos };
}

// pedidos: deals do CRM; contatos: contacts do CRM; maquinas: [{titulo, categoria, preco, origem, publicado, ...}]
export function encontrar(pedidos, contatos, maquinas, minimo = 3) {
  const porId = new Map((contatos || []).map((c) => [c.id, c]));
  const resultado = [];
  for (const d of (pedidos || []).filter(pedidoAberto)) {
    const achados = maquinas
      .map((m) => ({ maquina: m, ...pontuar(d, m) }))
      .filter((x) => x.pontos >= minimo)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 5);
    if (achados.length) {
      const c = porId.get(d.contactId) || {};
      resultado.push({ pedidoId: d.id, pedido: d.title, etapa: d.stage, prioridade: d.priority,
        cliente: c.name || "", telefone: c.phone || "", achados });
    }
  }
  return resultado.sort((a, b) => b.achados[0].pontos - a.achados[0].pontos);
}
