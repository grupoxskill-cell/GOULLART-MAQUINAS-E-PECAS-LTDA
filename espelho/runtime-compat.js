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
