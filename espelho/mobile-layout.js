(() => {
  const header = document.querySelector('body > header');
  const dock = document.querySelector('.mobile-dock');
  if (!header) return;
  const root = document.documentElement;
  let frame;
  function measure() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const headerHeight = getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height : 0;
      root.style.setProperty('--goullart-header-height', Math.ceil(headerHeight) + 'px');
      if (dock && getComputedStyle(dock).display !== 'none') {
        root.style.setProperty('--goullart-dock-height', Math.ceil(dock.getBoundingClientRect().height) + 'px');
      }
      // A pinch zoom must not collapse the navigation's available height.
      const viewport = window.visualViewport;
      if (!viewport || Math.abs(viewport.scale - 1) < 0.01) {
        root.style.setProperty('--goullart-viewport-height', Math.round(viewport?.height || window.innerHeight) + 'px');
      }
    });
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (dock) observer.observe(dock);
  }
  window.addEventListener('resize', measure, {passive:true});
  window.visualViewport?.addEventListener('resize', measure, {passive:true});
  document.fonts?.ready.then(measure);
  measure();
})();
