// Navegação compartilhada. Atendimento humano pelo WhatsApp.
(() => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu-principal');
  if (toggle && menu) {
    const fechar = () => { menu.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => {
      const aberto = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(aberto));
      menu.classList.toggle('is-open', aberto);
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) fechar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { fechar(); toggle.focus(); } });
    document.addEventListener('click', e => { if (!e.target.closest('.topbar')) fechar(); });
  }
  const ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();
})();
