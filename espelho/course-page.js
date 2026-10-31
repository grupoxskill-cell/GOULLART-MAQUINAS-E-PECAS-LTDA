(() => {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, {threshold: 0.08});
  document.documentElement.classList.add('js-motion');
  nodes.forEach(node => observer.observe(node));
})();
