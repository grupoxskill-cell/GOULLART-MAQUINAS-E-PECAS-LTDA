/* Shared fallbacks for older Safari and Android WebViews. */
(() => {
  const originalMatchMedia = window.matchMedia;
  if (originalMatchMedia) {
    window.matchMedia = function(query) {
      const media = originalMatchMedia.call(window, query);
      if (!media.addEventListener && media.addListener) {
        media.addEventListener = (type, listener) => { if (type === 'change') media.addListener(listener); };
        media.removeEventListener = (type, listener) => { if (type === 'change') media.removeListener(listener); };
      }
      return media;
    };
  }
  window.GoullartRuntime = {
    async fetchCatalog(options = {}) {
      async function attempt(url, signal) {
        const response = await fetch(url, {...options, signal});
        if (!response.ok) throw Error('Catálogo indisponível');
        const data = await response.clone().json();
        if (!data || !Array.isArray(data.items)) throw Error('Catálogo inválido');
        return response;
      }
      try {
        return await attempt('/adm/catalogo.json', options.signal);
      } catch {
        // O prazo da primeira tentativa pode ter terminado. A reserva precisa de um novo sinal.
        return attempt('/api/catalog.json', window.GoullartRuntime.timeout(15000));
      }
    },
    timeout(ms) {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
      if (typeof AbortController === 'undefined') return undefined;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      controller.signal.addEventListener('abort', () => clearTimeout(timer), {once:true});
      return controller.signal;
    }
  };
})();
