// Conta visitas à página da máquina e cliques em "Tenho interesse" (sem dados pessoais).
// Fora do servidor da GOULLART (ex.: GitHub Pages) o envio só falha em silêncio.
(() => {
  const enviar = (ref, tipo) => {
    if (!ref) return;
    const corpo = JSON.stringify({ ref, tipo });
    try {
      if (!navigator.sendBeacon?.("/api/interesse", new Blob([corpo], { type: "application/json" }))) {
        fetch("/api/interesse", { method: "POST", body: corpo, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch { /* contagem é opcional */ }
  };
  const pagina = document.body.dataset.ref;
  if (pagina) enviar(pagina, "visita");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-interesse]");
    if (a) enviar(a.dataset.ref || pagina, "interesse");
  });
})();
