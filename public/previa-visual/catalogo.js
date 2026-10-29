const WHATSAPP = "5562999427276";
const busca = document.getElementById("busca");
const lista = document.getElementById("catalogo-lista");
const info = document.getElementById("catalogo-info");

document.getElementById("ano").textContent = new Date().getFullYear();

const normalizar = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const compactar = (s) => normalizar(s).replace(/[^a-z0-9]/g, "");
let pecas = [];

function linkOrcamento(peca) {
  const texto = `Gostaria de um orçamento da peça: ${peca.nome}${peca.codigo ? ` (código ${peca.codigo})` : ""}`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

function render() {
  const termos = normalizar(busca.value).split(/\s+/).filter(Boolean);
  const filtradas = pecas.filter((p) => termos.every((t) => p.indice.includes(t) || p.compacto.includes(compactar(t))));
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
    ? `${filtradas.length} referência(s) para cotação`
    : "Nenhuma peça encontrada. Consulte a equipe pelo WhatsApp.";
}

// A mesma URL relativa funciona no Node, no domínio próprio e no subdiretório do Pages.
fetch("../catalogo.json")
  .then((r) => { if (!r.ok) throw new Error("Catálogo indisponível"); return r.json(); })
  .then((dados) => {
    const unicas = new Map();
    for (const p of dados) {
      const chave = normalizar(p.nome).trim();
      const anterior = unicas.get(chave);
      unicas.set(chave, anterior ? { ...p, ...anterior } : p);
    }
    pecas = [...unicas.values()].map((p) => {
      const indice = normalizar([p.nome, p.codigo, p.aplicacao].join(" "));
      return { ...p, indice, compacto: compactar(indice) };
    });
    render();
  })
  .catch(() => { info.textContent = "Não foi possível carregar o catálogo. Solicite uma cotação pelo WhatsApp."; });

busca.addEventListener("input", render);
