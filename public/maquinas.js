// Catálogo de máquinas: lê maquinas.json (gerado a partir das fichas aprovadas) e filtra por tipo e busca.
(() => {
  const WHATSAPP = "5562999427276";
  const filtros = document.getElementById("maquinas-filtros");
  const busca = document.getElementById("maquinas-busca");
  const lista = document.getElementById("maquinas-lista");
  const info = document.getElementById("maquinas-info");
  const patioLista = document.getElementById("patio-lista");
  const detalhe = document.getElementById("detalhe");
  const detalheConteudo = document.getElementById("detalhe-conteudo");

  const normalizar = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ORDEM = ["Escavadeiras", "Pás-carregadeiras", "Retroescavadeiras", "Tratores", "Motoniveladoras", "Caminhões", "Outros"];
  const posicao = (c) => (ORDEM.includes(c) ? ORDEM.indexOf(c) : ORDEM.length);
  let maquinas = [];
  let categoria = "Todas";

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
  detalhe.querySelector(".detalhe-fechar").addEventListener("click", () => detalhe.close());
  detalhe.addEventListener("click", (e) => { if (e.target === detalhe) detalhe.close(); });

  function card(m) {
    const li = el("li", "machine");
    const abrir = el("button", "machine-abrir");
    abrir.type = "button";
    abrir.setAttribute("aria-label", `Ver detalhes: ${m.titulo}`);
    abrir.append(m.fotos.length ? foto(m.fotos[0], m.titulo) : el("div", "machine-nofoto", "Foto sob consulta"));
    if (m.fotos.length > 1) abrir.append(el("span", "machine-qtd", `${m.fotos.length} fotos`));
    abrir.addEventListener("click", () => abrirDetalhe(m));
    li.append(abrir);
    const corpo = el("div", "machine-body");
    corpo.append(el("span", "machine-cat", m.patio ? `No pátio · ${m.categoria}` : m.categoria), el("h3", "", m.titulo));
    const dados = [m.ano && `Ano ${m.ano}`, m.horas].filter(Boolean).join(" · ");
    if (dados) corpo.append(el("p", "machine-dados", dados));
    corpo.append(el("p", "machine-preco", m.preco || "Preço sob consulta"));
    if (m.patio && m.local) corpo.append(el("p", "machine-dados", `Local: ${m.local}`));
    corpo.append(el("p", "machine-status", "Disponibilidade a confirmar"));
    const ver = el("button", "btn btn-ghost-dark", "Ver detalhes");
    ver.type = "button";
    ver.addEventListener("click", () => abrirDetalhe(m));
    corpo.append(ver, botaoInteresse(m));
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
    const filtradas = maquinas.filter(
      (m) => (categoria === "Todas" || m.categoria === categoria) && termos.every((t) => m.indice.includes(t))
    );
    lista.replaceChildren(...filtradas.map(card));
    info.textContent = filtradas.length
      ? `${filtradas.length} máquina(s)`
      : "Nenhuma máquina encontrada. Fale com a equipe pelo WhatsApp que a gente procura para você.";
  }

  fetch("maquinas.json")
    .then((r) => { if (!r.ok) throw new Error("Catálogo indisponível"); return r.json(); })
    .then((dados) => {
      maquinas = dados
        .map((m) => ({ ...m, indice: normalizar([m.titulo, m.categoria, m.ano, m.referencia].join(" ")) }))
        .sort((a, b) => posicao(a.categoria) - posicao(b.categoria));
      renderFiltros();
      render();
      const doPatio = maquinas.filter((m) => m.patio);
      if (patioLista) patioLista.replaceChildren(...doPatio.map(card));
    })
    .catch(() => { info.textContent = "Não foi possível carregar as máquinas. Consulte a equipe pelo WhatsApp."; });

  busca.addEventListener("input", render);
})();
