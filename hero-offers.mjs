import { selectCheapestMachines, machineName } from './hero-offers-model.mjs?v=twenty-2';

const root = document.getElementById('hero-offers');
const track = document.getElementById('hero-offers-track');
const viewport = document.getElementById('hero-offers-viewport');
const loading = document.getElementById('hero-offers-loading');
const pauseButton = document.getElementById('hero-offers-pause');
const positionLabel = document.getElementById('hero-offers-position');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
let listings = [], position = 1, paused = reduceMotion.matches, hovered = false, inView = true, moving = false, timer, settleTimer;

function slide(item, index, clone = false) {
  const name = machineName(item);
  const year = String(item.publicText || '').match(/\bano\s*:?\s*((?:19|20)\d{2})/i)?.[1];
  const unit = /\bcada\b/i.test(item.publicText || '');
  const link = location.origin + '/?item=' + encodeURIComponent(item.id) + '#maquinas';
  const message = 'Olá! Tenho interesse em ' + name + ', anunciado por R$ ' + money(item.price) + (unit ? ' cada' : '') + '. Pode confirmar disponibilidade e condições? ' + link;
  const contact = 'https://wa.me/5562999427276?text=' + encodeURIComponent(message);
  return `<article class="hero-offer" data-offer-id="${escape(item.id)}" role="group" aria-roledescription="anúncio" aria-label="${index + 1} de ${listings.length}"${clone ? ' data-clone="true"' : ''}><a href="${escape(contact)}" target="_blank" rel="noopener" tabindex="-1"><div class="hero-offer-photo"><img data-src="${escape(item.image)}" alt="${escape(name)}" width="600" height="450" decoding="async"></div><div class="hero-offer-details"><small>${year ? 'Ano ' + year + ' · ' : ''}GOULLART</small><h2>${escape(name)}</h2><p class="hero-offer-price"><span>R$</span><strong>${escape(money(item.price))}</strong>${unit ? '<span class="hero-offer-unit">cada máquina</span>' : ''}</p></div><span class="hero-offer-cta">Quero negociar esta máquina <span aria-hidden="true">↗</span></span></a></article>`;
}

function updateAccessibility() {
  const active = (position - 1 + listings.length) % listings.length;
  positionLabel.textContent = (active + 1) + ' / ' + listings.length + ' · Menores preços';
  [...track.children].forEach((card, index) => {
    const visible = index === position;
    // Fetch only the current photo and its neighbours, including loop clones.
    if (Math.abs(index - position) <= 1) {
      const photo = card.querySelector('img[data-src]');
      if (photo && !photo.getAttribute('src')) photo.src = photo.dataset.src;
    }
    card.setAttribute('aria-hidden', String(!visible));
    card.inert = !visible;
    card.querySelector('a').tabIndex = visible ? 0 : -1;
  });
}

function canRun() {
  return listings.length > 1 && !paused && !reduceMotion.matches && !document.hidden && inView && !viewport.matches(':focus-within');
}

function schedule() {
  clearTimeout(timer);
  if (canRun()) timer = setTimeout(() => advance(1), 3500);
}

function syncPause() {
  const stopped = paused || reduceMotion.matches;
  pauseButton.hidden = reduceMotion.matches;
  pauseButton.textContent = stopped ? '▶' : 'Ⅱ';
  pauseButton.setAttribute('aria-pressed', String(stopped));
  pauseButton.setAttribute('aria-label', stopped ? 'Continuar passagem dos anúncios' : 'Pausar passagem dos anúncios');
  schedule();
}

function settle() {
  if (!moving) return;
  clearTimeout(settleTimer);
  moving = false;
  if (position === 0 || position === listings.length + 1) {
    position = position === 0 ? listings.length : 1;
    track.classList.add('without-transition');
    track.style.transform = `translateX(-${position * 100}%)`;
    // Commit the invisible loop reset before the next slide movement.
    void track.offsetWidth;
    track.classList.remove('without-transition');
  }
  updateAccessibility();
  schedule();
}

function advance(direction, manual = false) {
  if (moving || listings.length < 2) return;
  // Manual navigation preserves the continuous loop; pause only on explicit request.
  clearTimeout(timer);
  position += direction;
  moving = true;
  track.style.transform = `translateX(-${position * 100}%)`;
  updateAccessibility();
  settleTimer = setTimeout(settle, reduceMotion.matches ? 0 : 400);
}

function render() {
  clearTimeout(timer); clearTimeout(settleTimer);
  if (!listings.length) {
    root.hidden = true; loading.hidden = false;
    loading.textContent = 'Veja as máquinas disponíveis no catálogo.';
    return;
  }
  position = 1; moving = false;
  track.classList.add('without-transition');
  track.innerHTML = slide(listings[listings.length - 1], listings.length - 1, true) + listings.map((item, index) => slide(item, index)).join('') + slide(listings[0], 0, true);
  track.style.transform = 'translateX(-100%)';
  root.hidden = false; loading.hidden = true;
  void track.offsetWidth;
  track.classList.remove('without-transition');
  updateAccessibility();
  root.querySelector('.hero-offers-buttons').hidden = listings.length < 2;
  syncPause();
}

// Skip an item everywhere in the carousel if its actual photo cannot load.
track.addEventListener('error', event => {
  if (!(event.target instanceof HTMLImageElement)) return;
  const id = event.target.closest('[data-offer-id]')?.dataset.offerId;
  if (!id) return;
  listings = listings.filter(item => String(item.id) !== id);
  render();
}, true);
track.addEventListener('transitionend', event => { if (event.target === track) settle(); });
document.getElementById('hero-offers-prev').addEventListener('click', () => advance(-1, true));
document.getElementById('hero-offers-next').addEventListener('click', () => advance(1, true));
pauseButton.addEventListener('click', () => { paused = !paused; syncPause(); });
root.addEventListener('mouseenter', () => { hovered = window.matchMedia('(hover: hover)').matches; schedule(); });
root.addEventListener('mouseleave', () => { hovered = false; schedule(); });
root.addEventListener('focusin', schedule);
root.addEventListener('focusout', () => setTimeout(schedule, 0));
document.addEventListener('visibilitychange', schedule);
reduceMotion.addEventListener('change', () => { paused = reduceMotion.matches; syncPause(); });
if ('IntersectionObserver' in window) new IntersectionObserver(entries => { inView = entries[0].isIntersecting; schedule(); }, { threshold: 0.15 }).observe(root);
let touch = null, lastSwipe = 0;
viewport.addEventListener('touchstart', event => { const p = event.touches[0]; touch = {x:p.clientX,y:p.clientY}; clearTimeout(timer); }, {passive:true});
viewport.addEventListener('touchend', event => {
  if (!touch) return;
  const p = event.changedTouches[0], dx = p.clientX - touch.x, dy = p.clientY - touch.y;
  if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) { lastSwipe = Date.now(); advance(dx < 0 ? 1 : -1, true); }
  else schedule();
  touch = null;
}, {passive:true});
viewport.addEventListener('click', event => { if (Date.now() - lastSwipe < 600) { event.preventDefault(); event.stopPropagation(); } }, true);
document.getElementById('hero-view-cheapest').addEventListener('click', event => {
  if (!window.GoullartCatalog) return;
  event.preventDefault();
  document.getElementById('search').value = '';
  window.GoullartCatalog.setFilter('maquinas');
  document.getElementById('sort').value = 'low';
  document.getElementById('sort').dispatchEvent(new Event('change'));
  history.pushState(null, '', '#maquinas');
  document.getElementById('maquinas').scrollIntoView({block:'start',behavior:reduceMotion.matches ? 'auto' : 'smooth'});
});

(window.GoullartFeed || ((o)=>fetch('/adm/catalogo.json',o).then((r)=>r.ok?r:Promise.reject(r)).catch(()=>fetch('/api/catalog.json',o)))( {signal:window.GoullartRuntime.timeout(25000)}).then(response => { if (!response.ok) throw Error(); return response.json(); }))
  .then(data => { listings = selectCheapestMachines(data.items, window.GoullartListingPolicy.eligibleListing); render(); })
  .catch(() => { root.hidden = true; loading.textContent = 'Abra o catálogo para consultar as máquinas.'; });

document.addEventListener('goullart:catalogupdate',event=>{listings=selectCheapestMachines(event.detail.items,window.GoullartListingPolicy.eligibleListing);render();});
