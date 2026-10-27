const WHATSAPP = "5562999427276";
const busca = document.getElementById("busca");
const lista = document.getElementById("catalogo-lista");
const info = document.getElementById("catalogo-info");

document.getElementById("ano").textContent = new Date().getFullYear();

const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let pecas = [];

function linkOrcamento(peca) {
  const texto = `Olá! Gostaria de um orçamento da peça: ${peca.nome}${peca.codigo ? ` (código ${peca.codigo})` : ""}`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

function render() {
  const termos = normalizar(busca.value).split(/\s+/).filter(Boolean);
  const filtradas = pecas.filter((p) => termos.every((t) => p.indice.includes(t)));
  lista.replaceChildren(
    ...filtradas.map((p) => {
      const li = document.createElement("li");
      li.className = "catalog-item";
      const nome = document.createElement("strong");
      nome.textContent = p.nome;
      li.append(nome);
      for (const extra of [p.codigo && `Código: ${p.codigo}`, p.aplicacao]) {
        if (!extra) continue;
        const span = document.createElement("span");
        span.textContent = extra;
        li.append(span);
      }
      const a = document.createElement("a");
      a.href = linkOrcamento(p);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Pedir orçamento";
      li.append(a);
      return li;
    })
  );
  info.textContent = filtradas.length
    ? `${filtradas.length} peça(s) encontrada(s)`
    : "Nenhuma peça encontrada. Fale com a gente pelo WhatsApp que localizamos para você.";
}

fetch("/api/catalogo")
  .then((r) => r.json())
  .then((dados) => {
    pecas = dados.map((p) => ({ ...p, indice: normalizar([p.nome, p.codigo, p.aplicacao].join(" ")) }));
    render();
  })
  .catch(() => (info.textContent = "Não foi possível carregar o catálogo."));

busca.addEventListener("input", render);
