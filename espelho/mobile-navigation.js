(() => {
  const toggle = document.querySelector('.mobile-menu-toggle');
  const dialog = document.getElementById('goullart-sidebar');
  const menu = document.getElementById('main-menu');
  if (!toggle || !dialog || !menu) return;
  const close = () => { if (dialog.open) dialog.close(); };
  toggle.addEventListener('click', () => {
    if (dialog.open) return close();
    dialog.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sidebar-is-open');
    dialog.querySelector('.sidebar-close').focus({preventScroll:true});
  });
  dialog.querySelector('.sidebar-close').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-is-open');
    toggle.focus({preventScroll:true});
  });
  dialog.addEventListener('click', event => {
    if(event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if(event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  menu.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    close();
    if(link.hasAttribute('data-sidebar-route')) {
      event.preventDefault();
      window.GoullartCatalog?.clearSearch();
      history.pushState(null,'',link.hash);
      window.GoullartCatalog?.route();
    }
  });
  window.addEventListener('hashchange', close);
})();
(() => {
  const dock = document.querySelector('.mobile-dock');
  if (!dock) return;
  const links = [...dock.querySelectorAll('a')];
  const categoryNames = ['maquinas', 'pecas', 'implementos', 'locacao'];
  let category = categoryNames.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'maquinas';
  const markCurrent = value => links.forEach(link => {
    if (link.hash === '#' + value) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  const update = () => {
    const catalog = document.getElementById('maquinas');
    const end = document.getElementById('canal');
    const top = catalog.getBoundingClientRect().top;
    const bottom = end.getBoundingClientRect().top;
    markCurrent(top <= 180 && bottom > 100 ? category : window.scrollY < 120 ? 'inicio' : '');
  };
  document.addEventListener('goullart:filterchange', event => {
    category = event.detail.category;
    update();
  });
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  const editing = () => document.body.classList.toggle('is-editing-field',
    !!document.activeElement?.matches('input:not([type=button]):not([type=submit]),textarea,select'));
  document.addEventListener('focusin', editing);
  document.addEventListener('focusout', () => setTimeout(editing, 0));
  update();
})();
