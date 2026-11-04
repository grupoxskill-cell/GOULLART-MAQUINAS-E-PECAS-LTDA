(() => {
  const details = document.getElementById('parts-expand');
  if (!details) return;
  const reveal = () => { details.open = true; };
  if (location.hash === '#pecas' || location.hash === '#quote') reveal();
  window.addEventListener('hashchange', () => {
    if (location.hash === '#pecas' || location.hash === '#quote') reveal();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('a[href="#pecas"],a[href="#quote"],[data-catalog-filter="pecas"]')) reveal();
  }, true);
})();
