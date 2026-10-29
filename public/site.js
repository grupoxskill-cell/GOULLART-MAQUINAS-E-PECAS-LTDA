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

// Banner da página inicial: troca a cada 6 s, pausa com mouse/foco e respeita "reduzir movimento".
(() => {
  const slider = document.querySelector(".slider");
  if (!slider) return;
  const slides = [...slider.querySelectorAll(".slide")];
  const pontos = [...slider.querySelectorAll(".slider-pontos button")];
  let atual = 0;
  let timer = null;
  const mostrar = (i) => {
    atual = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      const ativo = n === atual;
      s.classList.toggle("ativo", ativo);
      s.setAttribute("aria-hidden", String(!ativo));
      s.querySelectorAll("a").forEach((a) => (ativo ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
    });
    pontos.forEach((p, n) => p.setAttribute("aria-selected", String(n === atual)));
  };
  const parar = () => { clearInterval(timer); timer = null; };
  const iniciar = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    parar();
    timer = setInterval(() => mostrar(atual + 1), 6000);
  };
  slider.querySelectorAll(".slider-seta").forEach((b) => b.addEventListener("click", () => { mostrar(atual + Number(b.dataset.dir)); iniciar(); }));
  pontos.forEach((p, n) => p.addEventListener("click", () => { mostrar(n); iniciar(); }));
  slider.addEventListener("mouseenter", parar);
  slider.addEventListener("mouseleave", iniciar);
  slider.addEventListener("focusin", parar);
  slider.addEventListener("focusout", iniciar);
  // Deslizar com o dedo no celular.
  let x0 = null;
  slider.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; parar(); }, { passive: true });
  slider.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - (x0 ?? 0);
    if (Math.abs(dx) > 40) mostrar(atual + (dx < 0 ? 1 : -1));
    x0 = null; iniciar();
  });
  iniciar();
})();

// Pedido: monta a mensagem e abre o WhatsApp; nada é enviado sem o cliente confirmar lá.
(() => {
  const form = document.getElementById("form-pedido");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const linhas = [`Olá! Vim pelo site da GOULLART.`, `Procuro: ${d.get("tipo")}`, `Pedido: ${String(d.get("descricao")).trim()}`];
    if (String(d.get("nome")).trim()) linhas.push(`Nome: ${String(d.get("nome")).trim()}`);
    if (String(d.get("cidade")).trim()) linhas.push(`Cidade: ${String(d.get("cidade")).trim()}`);
    window.open(`https://wa.me/5562999427276?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank", "noopener");
  });
})();
