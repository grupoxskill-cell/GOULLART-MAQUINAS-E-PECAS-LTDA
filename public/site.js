// Comportamentos comuns a todas as páginas: menu do celular e ano do rodapé.
(() => {
  const topo = document.querySelector(".topbar");
  const botao = document.querySelector(".menu-btn");
  if (topo && botao) {
    const alternar = (aberto) => {
      topo.classList.toggle("menu-aberto", aberto);
      botao.setAttribute("aria-expanded", String(aberto));
      botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    };
    botao.addEventListener("click", () => alternar(!topo.classList.contains("menu-aberto")));
    topo.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => alternar(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") alternar(false); });
  }
  const ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();
})();
