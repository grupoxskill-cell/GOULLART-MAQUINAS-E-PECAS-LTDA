(() => {
  const panel = document.getElementById('welcome-banners');
  if (!panel) return;
  const slides = [...panel.querySelectorAll('.welcome-banner')];
  const pause = document.getElementById('welcome-banner-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, paused = reduced.matches, inView = true, timer;
  function schedule() {
    clearTimeout(timer);
    if (!panel.hidden && !paused && !document.hidden && inView && !panel.matches(':focus-within')) {
      timer = setTimeout(() => { index = (index + 1) % slides.length; render(); }, 5000);
    }
  }
  function render() {
    slides.forEach((slide, i) => { slide.hidden = i !== index; });
    document.getElementById('welcome-banner-count').textContent = `${index + 1} / ${slides.length}`;
    pause.textContent = paused ? '▶' : 'Ⅱ';
    pause.setAttribute('aria-label', paused ? 'Continuar banners' : 'Pausar banners');
    pause.setAttribute('aria-pressed', String(paused));
    schedule();
  }
  document.addEventListener('goullart:showbanners', () => { panel.hidden = false; render(); });
  document.getElementById('welcome-banner-prev').addEventListener('click', () => { index = (index + slides.length - 1) % slides.length; render(); });
  document.getElementById('welcome-banner-next').addEventListener('click', () => { index = (index + 1) % slides.length; render(); });
  pause.addEventListener('click', () => { paused = !paused; render(); });
  document.getElementById('welcome-banner-replay').addEventListener('click', () => {
    panel.hidden = true; clearTimeout(timer);
    document.dispatchEvent(new Event('goullart:replaywelcome'));
    document.getElementById('welcome-play')?.focus({preventScroll:true});
  });
  panel.addEventListener('focusin', schedule);
  panel.addEventListener('focusout', () => setTimeout(schedule, 0));
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { paused = reduced.matches; render(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; schedule();
  }, {threshold:0.15}).observe(panel.parentElement);
  const corner = document.getElementById('course-corner');
  document.getElementById('course-corner-close')?.addEventListener('click', () => { corner.hidden = true; });
  // Recover if the presentation fails before this script finishes loading.
  if (document.getElementById('welcome-video')?.error) {
    document.dispatchEvent(new Event('goullart:requestbanners'));
  }
})();
