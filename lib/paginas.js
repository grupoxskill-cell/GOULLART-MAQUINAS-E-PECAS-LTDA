// Página própria de cada máquina (prévia com foto e preço no WhatsApp/Google), sitemap e slugs.
// Usado pelo build estático (catálogo do site) e pelo servidor (máquinas publicadas pelo ADM).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const SITE = "https://www.goullartmaquinaspesadas.com.br";
const WHATSAPP = "5562999427276";
const MODELO = fileURLToPath(new URL("../public/maquinas.html", import.meta.url));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function slugify(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

// Máquinas do catálogo do site ficam com slug limpo (nome + ano); as do ADM (R-/P-) levam a referência,
// para o slug de uma máquina do site nunca mudar quando algo é publicado pelo ADM.
export function comSlugs(lista) {
  const usados = new Set();
  return lista.map((m) => {
    const ano = String(m.ano || "").match(/\d{4}/)?.[0];
    const base = slugify(`${m.titulo} ${ano || ""}`);
    let slug = /^[RP]-/.test(m.referencia) ? `${base}-${slugify(m.referencia)}` : base;
    if (usados.has(slug)) slug = `${base}-${slugify(m.referencia)}`;
    usados.add(slug);
    return { ...m, slug };
  });
}

const precoNum = (p) => { const m = String(p || "").match(/\d{1,3}(?:\.\d{3})+|\d{4,}/); return m ? Number(m[0].replace(/\./g, "")) : null; };

function descricao(m) {
  return [m.titulo, m.ano && `ano ${m.ano}`, m.horas, m.preco && `preço anunciado ${m.preco}`].filter(Boolean).join(", ") +
    ". GOULLART Pesados: máquinas pesadas, peças e locação.";
}

// Topo e rodapé vêm de maquinas.html, para as páginas acompanharem o resto do site.
async function moldura() {
  const html = await readFile(MODELO, "utf-8");
  const pegar = (re) => html.match(re)?.[0] ?? "";
  const subir = (trecho) => trecho.replace(/(href|src)="(?!https?:|#|tel:|mailto:|\/)/g, '$1="../');
  return {
    topo: subir(pegar(/  <header class="topbar">[\s\S]*?<\/header>\n/)).replace(' aria-current="page"', ""),
    rodape: subir(pegar(/  <footer class="footer\b[^"]*">[\s\S]*?<\/footer>\n/)).replace(' aria-current="page"', ""),
    flutuante: subir(pegar(/<aside class="goullart-contact"[\s\S]*?<\/aside>/)),
  };
}

export async function paginaMaquina(m, todas) {
  const { topo, rodape, flutuante } = await moldura();
  const url = `${SITE}/maquina/${m.slug}.html`;
  const fotoPrincipal = m.fotos?.[0] ? `${SITE}/${m.fotos[0]}` : `${SITE}/assets/slide-maquinas.jpg`;
  const interesse = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Tenho interesse na máquina: ${m.titulo} (ref. ${m.referencia}). Ainda está disponível?\n${url}`)}`;
  const compartilhar = `https://wa.me/?text=${encodeURIComponent(`${m.titulo}${m.preco ? ` - ${m.preco}` : ""}\n${url}`)}`;
  const ficha = [["Tipo", m.categoria], ["Ano", m.ano], ["Horas / km", m.horas], ["Local", m.patio ? m.local : ""], ["Referência", m.referencia]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  const fotos = (m.fotos || []).length
    ? m.fotos.map((f, i) => `<img src="../${esc(f)}" alt="${esc(m.titulo)} — foto ${i + 1}"${i ? ' loading="lazy"' : ""} decoding="async">`).join("\n          ")
    : '<div class="machine-nofoto">Foto sob consulta</div>';
  const parecidas = todas.filter((x) => x.slug !== m.slug && x.categoria === m.categoria && x.fotos?.length).slice(0, 3);
  const preco = precoNum(m.preco);
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: m.titulo, image: (m.fotos || []).map((f) => `${SITE}/${f}`),
    description: descricao(m), category: m.categoria, sku: m.referencia, brand: { "@type": "Brand", name: "GOULLART Pesados" },
    ...(preco ? { offers: { "@type": "Offer", price: preco, priceCurrency: "BRL", url, seller: { "@type": "Organization", name: "GOULLART" } } } : {}) };

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(m.titulo)}${m.ano ? ` ${esc(m.ano)}` : ""} | GOULLART Pesados</title>
  <meta name="description" content="${esc(descricao(m))}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="GOULLART Pesados">
  <meta property="og:title" content="${esc(m.titulo)}${m.preco ? ` — ${esc(m.preco)}` : ""}">
  <meta property="og:description" content="${esc([m.ano && `Ano ${m.ano}`, m.horas, "Disponibilidade a confirmar com a equipe GOULLART."].filter(Boolean).join(" · "))}">
  <meta property="og:image" content="${esc(fotoPrincipal)}">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#061e42">
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="../customer-contact.css?v=20261029-1">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body data-ref="${esc(m.referencia)}">
  <a class="skip-link" href="#conteudo">Ir para o conteúdo</a>

${topo}
  <main id="conteudo" class="section section-alt">
    <div class="wrap">
      <nav class="trilha" aria-label="Você está em"><a href="../index.html">Início</a> › <a href="../maquinas.html">Máquinas</a> › <a href="../maquinas.html?tipo=${encodeURIComponent(m.categoria)}">${esc(m.categoria)}</a></nav>
      <div class="maquina">
        <div class="maquina-fotos">
          ${fotos}
        </div>
        <aside class="maquina-info">
          <span class="machine-cat">${esc(m.patio ? `No pátio GOULLART · ${m.categoria}` : m.categoria)}</span>
          <h1>${esc(m.titulo)}</h1>
          <dl class="detalhe-ficha">${ficha}</dl>
          <p class="maquina-preco">${esc(m.preco || "Preço sob consulta")}</p>
          <p class="machine-status">Disponibilidade, estado e condições confirmados pela equipe antes da negociação.</p>
          <a class="btn btn-primary maquina-btn" data-interesse href="${esc(interesse)}" target="_blank" rel="noopener">Tenho interesse</a>
          <a class="btn btn-ghost-dark maquina-btn" href="${esc(compartilhar)}" target="_blank" rel="noopener">Compartilhar no WhatsApp</a>
        </aside>
      </div>
${parecidas.length ? `      <section class="parecidas" aria-labelledby="parecidas-titulo">
        <h2 id="parecidas-titulo">Outras ${esc(m.categoria.toLowerCase())}</h2>
        <ul class="machines">
${parecidas.map((p) => `          <li class="machine"><a class="machine-abrir" href="${esc(p.slug)}.html"><img src="../${esc(p.fotos[0])}" alt="${esc(p.titulo)}" loading="lazy" decoding="async"></a><div class="machine-body"><span class="machine-cat">${esc(p.categoria)}</span><h3><a class="machine-titulo" href="${esc(p.slug)}.html">${esc(p.titulo)}</a></h3><p class="machine-dados">${esc([p.ano && `Ano ${p.ano}`, p.horas].filter(Boolean).join(" · "))}</p><p class="machine-preco">${esc(p.preco || "Preço sob consulta")}</p></div></li>`).join("\n")}
        </ul>
      </section>
` : ""}    </div>
  </main>

${rodape}
${flutuante}  <script src="../site.js"></script>
  <script src="../interesse.js"></script>
  <script defer src="../customer-contact.js?v=20261029-1"></script>
</body>
</html>
`;
}

export function sitemap(maquinas) {
  const urls = ["", "maquinas.html", "pecas.html", ...maquinas.map((m) => `maquina/${m.slug}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `  <url><loc>${SITE}/${u}</loc></url>`).join("\n")}\n</urlset>\n`;
}
