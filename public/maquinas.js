// Catálogo de máquinas: lê maquinas.json (gerado a partir das fichas aprovadas) e filtra por tipo e busca.
(() => {
  const WHATSAPP = "5562999427276";
  const filtros = document.getElementById("maquinas-filtros");
  const busca = document.getElementById("maquinas-busca");
  const lista = document.getElementById("maquinas-lista");
  const info = document.getElementById("maquinas-info");

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

  function card(m) {
    const li = el("li", "machine");
    if (m.fotos.length) {
      const img = el("img");
      img.src = m.fotos[0];
      img.alt = m.titulo;
      img.loading = "lazy";
      img.decoding = "async";
      li.append(img);
    } else {
      li.append(el("div", "machine-nofoto", "Foto sob consulta"));
    }
    const corpo = el("div", "machine-body");
    corpo.append(el("span", "machine-cat", m.categoria), el("h3", "", m.titulo));
    const dados = [m.ano && `Ano ${m.ano}`, m.horas].filter(Boolean).join(" · ");
    if (dados) corpo.append(el("p", "machine-dados", dados));
    corpo.append(el("p", "machine-preco", m.preco || "Preço sob consulta"));
    corpo.append(el("p", "machine-status", "Disponibilidade a confirmar"));
    const a = el("a", "btn btn-primary machine-btn", "Tenho interesse");
    a.href = linkInteresse(m);
    a.target = "_blank";
    a.rel = "noopener";
    corpo.append(a);
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
    })
    .catch(() => { info.textContent = "Não foi possível carregar as máquinas. Consulte a equipe pelo WhatsApp."; });

  busca.addEventListener("input", render);
})();
