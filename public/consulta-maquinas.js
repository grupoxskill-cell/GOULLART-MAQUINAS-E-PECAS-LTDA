const primeira = document.getElementById("primeira");
const segunda = document.getElementById("segunda");
const tabela = document.getElementById("comparacao");
const aviso = document.getElementById("aviso");
let fichas = [];
function renderizar() {
  const a = fichas.find(m => m.referencia === primeira.value);
  const b = fichas.find(m => m.referencia === segunda.value);
  for (const opcao of segunda.options) opcao.disabled = Boolean(a && opcao.value === a.referencia);
  if (a && b === a) { segunda.value = ""; return renderizar(); }
  tabela.hidden = !a && !b;
  tabela.tBodies[0].replaceChildren();
  for (const [rotulo, chave] of [["Máquina","titulo"],["Código","codigoVitrine"],["Ano","ano"],["Horas / km","horas"],["Preço","preco"],["Local","local"],["Situação","situacao"]]) {
    const linha = tabela.tBodies[0].insertRow();
    const cab = document.createElement("th"); cab.scope = "row"; cab.textContent = rotulo; linha.append(cab);
    for (const m of [a,b]) linha.insertCell().textContent = m ? m[chave] || "A confirmar" : "—";
  }
}
async function carregar() {
  for (const [url,pdf,arquivo] of [["/adm/consulta-maquinas.json","/adm/catalogo-maquinas.pdf",false],["/consulta-maquinas.json","/catalogo-maquinas.pdf",true]]) {
    try {
      const r = await fetch(url, {cache:"no-store"});
      if (!r.ok) continue;
      const dados = await r.json();
      if (!Array.isArray(dados)) continue;
      fichas = dados;
      for (const select of [primeira,segunda]) {
        select.replaceChildren(new Option("Selecione uma máquina",""), ...fichas.map(m => new Option(m.titulo + " · " + m.codigoVitrine, m.referencia)));
        select.disabled = !fichas.length;
        select.addEventListener("change", renderizar);
      }
      const ref = new URLSearchParams(location.search).get("ref");
      const inicial = fichas.find(m => ref && [m.referencia,m.codigoVitrine].includes(ref));
      if (inicial) primeira.value = inicial.referencia;
      const link = document.getElementById("pdf"); link.href = pdf; link.hidden = false;
      aviso.textContent = !fichas.length ? "Sem fichas nesta consulta." : arquivo ? "Catálogo da última atualização do site. Confirme a situação com a equipe." : "";
      renderizar(); return;
    } catch { /* Tenta a edição estática se o serviço estiver indisponível. */ }
  }
  aviso.textContent = "Não foi possível carregar o catálogo. Tente novamente.";
}
carregar();

const troca = document.getElementById("troca");
const resultado = document.getElementById("resultado");
const moeda = n => n.toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
troca.addEventListener("input", () => { resultado.textContent = ""; });
troca.addEventListener("submit", event => {
  event.preventDefault();
  if (!troca.reportValidity()) return;
  const refs = ["ref1","ref2","ref3"].map(campo => troca.elements[campo].valueAsNumber).sort((a,b) => a-b);
  const valor = Math.max(0, Math.round((refs[1] - (troca.elements.custos.valueAsNumber || 0)) * 100) / 100);
  const alvo = troca.elements.alvo.valueAsNumber;
  const diferenca = Number.isFinite(alvo) ? alvo - valor : null;
  let mensagem = "Referência mediana de " + moeda(refs[1]) + ". Valor estimado na troca de " + moeda(valor) + ".";
  if (diferenca !== null) mensagem += diferenca >= 0 ? " Diferença estimada a completar de " + moeda(diferenca) + "." : " A estimativa supera o preço desejado em " + moeda(-diferenca) + ".";
  resultado.textContent = mensagem;
});
