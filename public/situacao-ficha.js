// A página estática também acompanha o estado conferido no ADM.
(async () => {
  try {
    const resposta = await fetch("../adm/consulta-maquinas.json", { cache: "no-store" });
    if (!resposta.ok) return;
    const ref = document.body.dataset.ref;
    const m = (await resposta.json()).find(i => i.referencia === ref || i.codigoVitrine === ref);
    if (!m) return;
    document.querySelector("[data-situacao]").textContent = "Disponibilidade · " + m.situacao;
    const botao = document.querySelector("[data-interesse]");
    if (m.situacao === "Vendida" || m.situacao === "Reservada") {
      botao.textContent = m.situacao === "Vendida" ? "Quero uma igual a essa" : "Consultar reserva";
      const url = new URL(botao.href);
      url.searchParams.set("text", botao.textContent + ": " + m.titulo + " (ref. " + ref + ")");
      botao.href = url.href;
    }
  } catch { /* A versão estática informa que a disponibilidade precisa de conferência. */ }
})();
