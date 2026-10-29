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

// O banner conserva o texto e a estrutura aprovados; só as fotografias alternam.
(() => {
  const banner = document.querySelector('.banner-carousel');
  if (!banner) return;
  const photos = [...banner.querySelectorAll('[data-banner-slide]')];
  const dots = [...banner.querySelectorAll('[data-banner-go]')];
  const pause = banner.querySelector('[data-banner-pause]');
  const position = banner.querySelector('.banner-position');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, timer = null, userPaused = reduced.matches, hover = false, touching = false, touchStart = null;
  const show = n => {
    current = (n + photos.length) % photos.length;
    photos.forEach((photo, i) => { photo.classList.toggle('is-active', i === current); photo.setAttribute('aria-hidden', String(i !== current)); });
    dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === current)));
    position.textContent = `${String(current + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
  };
  const schedule = () => {
    clearInterval(timer);
    pause.textContent = userPaused ? 'Reproduzir' : 'Pausar';
    pause.setAttribute('aria-pressed', String(userPaused));
    const focusedInside = banner.contains(document.activeElement) && document.activeElement !== pause;
    if (!userPaused && !hover && !touching && !document.hidden && !focusedInside) timer = setInterval(() => show(current + 1), 6500);
  };
  pause.addEventListener('click', () => { userPaused = !userPaused; schedule(); });
  banner.querySelector('[data-banner-next]').addEventListener('click', () => { show(current + 1); schedule(); });
  banner.querySelector('[data-banner-prev]').addEventListener('click', () => { show(current - 1); schedule(); });
  dots.forEach(dot => dot.addEventListener('click', () => { show(Number(dot.dataset.bannerGo)); schedule(); }));
  banner.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hover = true; schedule(); } });
  banner.addEventListener('pointerleave', () => { hover = false; schedule(); });
  banner.addEventListener('focusin', schedule);
  banner.addEventListener('focusout', () => queueMicrotask(schedule));
  banner.addEventListener('touchstart', e => { touching = true; touchStart = [e.touches[0].clientX,e.touches[0].clientY]; schedule(); }, {passive:true});
  banner.addEventListener('touchend', e => {
    if (touchStart) { const dx = e.changedTouches[0].clientX - touchStart[0], dy = e.changedTouches[0].clientY - touchStart[1]; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1)); }
    touching = false; touchStart = null; schedule();
  }, {passive:true});
  banner.addEventListener('touchcancel', () => { touching = false; touchStart = null; schedule(); }, {passive:true});
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { userPaused = reduced.matches; schedule(); });
  show(0); schedule();
})();

(() => {
  const ribbon = document.querySelector('.brand-ribbon');
  if (!ribbon) return;
  const button = ribbon.querySelector('[data-brands-pause]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  const update = () => {
    ribbon.classList.toggle('is-paused', paused);
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? 'Movimentar logos' : 'Pausar logos';
    ribbon.querySelector('.brand-track').style.animationPlayState = paused ? 'paused' : (reduced.matches ? 'running' : '');
  };
  button.addEventListener('click', () => { paused = !paused; update(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; update(); });
  update();
})();
