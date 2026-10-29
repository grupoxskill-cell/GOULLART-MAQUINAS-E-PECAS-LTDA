// Catálogo de máquinas: lê maquinas.json (catálogo do site + publicações do ADM).
// Na página inicial (lista com data-destaque) mostra alguns destaques com foto; em maquinas.html mostra tudo com filtros.
(() => {
  const WHATSAPP = "5562999427276";
  const filtros = document.getElementById("maquinas-filtros");
  const busca = document.getElementById("maquinas-busca");
  const lista = document.getElementById("maquinas-lista");
  const info = document.getElementById("maquinas-info");
  const patioSecao = document.getElementById("patios");
  const patioLista = document.getElementById("patio-lista");
  const qtd = document.getElementById("qtd-maquinas");
  const detalhe = document.getElementById("detalhe");
  const detalheConteudo = document.getElementById("detalhe-conteudo");
  const destaque = Number(lista?.dataset.destaque) || 0;

  const normalizar = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ORDEM = ["Escavadeiras", "Pás-carregadeiras", "Retroescavadeiras", "Tratores", "Motoniveladoras", "Caminhões", "Outros"];
  const posicao = (c) => (ORDEM.includes(c) ? ORDEM.indexOf(c) : ORDEM.length);
  let maquinas = [];
  const params = new URLSearchParams(location.search);
  let categoria = params.get("tipo") || "Todas";
  const ordem = document.getElementById("maquinas-ordem");
  const maximo = document.getElementById("maquinas-max");
  // "R$ 520.000", "R$ 355.000 cada", "R$ 180.000 ou R$ 195.000" → primeiro valor em reais.
  const precoNum = (p) => { const m = String(p || "").match(/\d{1,3}(?:\.\d{3})+|\d{4,}/); return m ? Number(m[0].replace(/\./g, "")) : null; };
  const valorDigitado = (v) => { const n = Number(String(v || "").replace(/\D/g, "")); return n > 0 ? n : null; };

  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto) e.textContent = texto;
    return e;
  }

  function linkInteresse(m) {
    const texto = `Tenho interesse na máquina: ${m.titulo} (ref. ${m.referencia}). Ainda está disponível?`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
  }

  function foto(src, alt) {
    const img = el("img");
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  }

  function botaoInteresse(m) {
    const a = el("a", "btn btn-primary machine-btn", "Tenho interesse");
    a.href = linkInteresse(m);
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function abrirDetalhe(m) {
    const galeria = el("div", "detalhe-galeria");
    if (m.fotos.length) galeria.append(...m.fotos.map((f, i) => foto(f, `${m.titulo} — foto ${i + 1}`)));
    else galeria.append(el("div", "machine-nofoto", "Foto sob consulta"));
    const titulo = el("h3", "", m.titulo);
    titulo.id = "detalhe-titulo";
    const ficha = el("dl", "detalhe-ficha");
    for (const [rotulo, valor] of [["Tipo", m.categoria], ["Ano", m.ano], ["Horas / km", m.horas],
      ["Local", m.patio ? m.local : ""], ["Referência", m.referencia]]) {
      if (valor) ficha.append(el("dt", "", rotulo), el("dd", "", valor));
    }
    detalheConteudo.replaceChildren(galeria, el("span", "machine-cat", m.patio ? "No pátio GOULLART" : m.categoria), titulo, ficha,
      el("p", "machine-preco", m.preco || "Preço sob consulta"),
      el("p", "machine-status", "Disponibilidade, estado e condições confirmados pela equipe antes da negociação."), botaoInteresse(m));
    detalhe.showModal();
  }
  detalhe?.querySelector(".detalhe-fechar").addEventListener("click", () => detalhe.close());
  detalhe?.addEventListener("click", (e) => { if (e.target === detalhe) detalhe.close(); });

  function card(m) {
    const li = el("li", "machine");
    const abrir = el("button", "machine-abrir");
    abrir.type = "button";
    abrir.setAttribute("aria-label", `Ver fotos e detalhes: ${m.titulo}`);
    abrir.append(m.fotos.length ? foto(m.fotos[0], m.titulo) : el("div", "machine-nofoto", "Foto sob consulta"));
    if (m.patio) abrir.append(el("span", "machine-selo", "No pátio"));
    if (m.fotos.length > 1) abrir.append(el("span", "machine-qtd", `${m.fotos.length} fotos`));
    abrir.addEventListener("click", () => abrirDetalhe(m));
    li.append(abrir);
    const corpo = el("div", "machine-body");
    const titulo = el("button", "machine-titulo", m.titulo);
    titulo.type = "button";
    titulo.addEventListener("click", () => abrirDetalhe(m));
    const h3 = el("h3");
    h3.append(titulo);
    corpo.append(el("span", "machine-cat", m.categoria), h3);
    const dados = [m.ano && `Ano ${m.ano}`, m.horas, m.patio && m.local].filter(Boolean).join(" · ");
    if (dados) corpo.append(el("p", "machine-dados", dados));
    corpo.append(el("p", "machine-preco", m.preco || "Preço sob consulta"));
    corpo.append(el("p", "machine-status", "Disponibilidade a confirmar"), botaoInteresse(m));
    li.append(corpo);
    return li;
  }

  function renderFiltros() {
    const cats = ["Todas", ...new Set(maquinas.map((m) => m.categoria))];
    filtros.replaceChildren(
      ...cats.map((c) => {
        const b = el("button", "chip", c);
        b.type = "button";
        b.setAttribute("aria-pressed", String(c === categoria));
        b.addEventListener("click", () => {
          categoria = c;
          renderFiltros();
          render();
        });
        return b;
      })
    );
  }

  function render() {
    const termos = normalizar(busca.value).split(/\s+/).filter(Boolean);
    const limite = valorDigitado(maximo?.value);
    const filtradas = maquinas.filter(
      (m) => (categoria === "Todas" || m.categoria === categoria) && termos.every((t) => m.indice.includes(t)) &&
        (!limite || (m.valor != null && m.valor <= limite))
    );
    if (ordem?.value === "menor") filtradas.sort((a, b) => (a.valor ?? Infinity) - (b.valor ?? Infinity));
    if (ordem?.value === "maior") filtradas.sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity));
    lista.replaceChildren(...filtradas.map(card));
    info.textContent = filtradas.length
      ? `${filtradas.length} máquina(s)`
      : "Nenhuma máquina encontrada. Fale com a equipe pelo WhatsApp que a gente procura para você.";
  }

  // Destaques: máquinas com foto, alternando os tipos para a vitrine não ficar só com escavadeiras.
  function renderDestaques() {
    const porTipo = new Map();
    const anoDe = (m) => Number(String(m.ano).match(/\d{4}/)?.[0]) || 0;
    const comFoto = maquinas.filter((x) => x.fotos.length).sort((a, b) => Number(Boolean(b.patio)) - Number(Boolean(a.patio)) || anoDe(b) - anoDe(a));
    // Vitrine só com máquinas pesadas, na ordem dos tipos (escavadeiras primeiro); "Outros" fica no catálogo completo.
    for (const tipo of ORDEM.filter((t) => t !== "Outros")) porTipo.set(tipo, []);
    for (const m of comFoto) if (porTipo.has(m.categoria)) porTipo.get(m.categoria).push(m);
    const escolhidas = [];
    while (escolhidas.length < destaque && [...porTipo.values()].some((v) => v.length)) {
      for (const v of porTipo.values()) if (v.length && escolhidas.length < destaque) escolhidas.push(v.shift());
    }
    lista.replaceChildren(...escolhidas.map(card));
    info.hidden = true;
  }

  fetch("maquinas.json")
    .then((r) => { if (!r.ok) throw new Error("Catálogo indisponível"); return r.json(); })
    .then((dados) => {
      maquinas = dados
        .map((m) => ({ ...m, valor: precoNum(m.preco), indice: normalizar([m.titulo, m.categoria, m.ano, m.referencia].join(" ")) }))
        .sort((a, b) => Number(Boolean(b.patio)) - Number(Boolean(a.patio)) || posicao(a.categoria) - posicao(b.categoria));
      if (qtd) qtd.textContent = String(maquinas.length);
      if (filtros) {
        if (!["Todas", ...ORDEM].includes(categoria)) categoria = "Todas";
        busca.value = params.get("q") || "";
        if (maximo) maximo.value = params.get("max") || "";
        renderFiltros();
        render();
        busca.addEventListener("input", render);
        maximo?.addEventListener("input", render);
        ordem?.addEventListener("change", render);
      } else if (lista) renderDestaques();
      const doPatio = maquinas.filter((m) => m.patio);
      if (patioLista && doPatio.length) {
        patioLista.replaceChildren(...doPatio.map(card));
        if (patioSecao) patioSecao.hidden = false;
      }
    })
    .catch(() => { if (info) info.textContent = "Não foi possível carregar as máquinas. Consulte a equipe pelo WhatsApp."; });
})();
