(() => {
  const strip = document.getElementById('brand-marquee');
  const button = document.querySelector('.brand-motion-toggle');
  if (!strip || !button) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  const update = () => {
    strip.classList.toggle('is-paused', paused);
    button.hidden = reduceMotion.matches;
    button.setAttribute('aria-pressed', String(paused));
    const label = paused ? 'Continuar movimento das logos' : 'Pausar movimento das logos';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.firstElementChild.textContent = paused ? '▶' : 'Ⅱ';
  };
  button.addEventListener('click', () => { paused = !paused; update(); });
  reduceMotion.addEventListener('change', update);
  strip.classList.add('is-ready');
  update();
})();
