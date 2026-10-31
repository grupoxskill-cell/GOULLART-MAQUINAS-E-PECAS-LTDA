(() => {
  const video = document.getElementById('welcome-video');
  if (!video) return;
  const controls = document.getElementById('welcome-controls');
  const play = document.getElementById('welcome-play');
  const playLabel = document.getElementById('welcome-play-label');
  const playIcon = document.getElementById('welcome-play-icon');
  const sound = document.getElementById('welcome-sound');
  const soundLabel = document.getElementById('welcome-sound-label');
  const soundPath = document.getElementById('welcome-sound-path');
  const status = document.getElementById('welcome-status');
  let userPaused = false;
  let inView = true;
  let pendingPlay = null;
  let attempt = 0;
  let bannersActive = false;
  let bannerBreakShown = false;
  let catalogReady = !window.GoullartFeed;
  const canPlay = () => (!video.closest('details') || video.closest('details').open) && !userPaused && !bannersActive && inView && !document.hidden && catalogReady;
  const update = () => {
    playLabel.textContent = video.paused ? 'Reproduzir' : 'Pausar';
    playIcon.textContent = video.paused ? '▶' : 'Ⅱ';
    play.setAttribute('aria-label', video.paused ? 'Reproduzir vídeo' : 'Pausar vídeo');
    soundLabel.textContent = video.muted ? 'Ativar som' : 'Silenciar';
    sound.setAttribute('aria-pressed', String(!video.muted));
    soundPath.setAttribute('d', video.muted ? 'm16 9 5 6m0-6-5 6' : 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14');
  };
  const start = ({ gesture = false } = {}) => {
    if (!canPlay() || (pendingPlay && !gesture)) return;
    const current = ++attempt;
    // Keep play directly in the tap handler to retain browser user activation.
    const request = video.play();
    pendingPlay = Promise.resolve(request).catch(async error => {
      if (current !== attempt || !canPlay()) return;
      if (error.name !== 'NotAllowedError' || video.muted) throw error;
      // If audible autoplay is refused, play muted and expose the sound control.
      video.muted = true;
      update();
      await video.play();
    }).then(() => {
      if (current !== attempt) return;
      if (!canPlay()) video.pause();
      status.hidden = true;
    }).catch(error => {
      if (current !== attempt || error.name === 'AbortError') return;
      status.textContent = error.name === 'NotAllowedError'
        ? ''
        : 'Não foi possível carregar o vídeo. Tente reproduzir novamente.';
      status.hidden = error.name === 'NotAllowedError';
    }).finally(() => {
      if (current === attempt) pendingPlay = null;
      update();
    });
  };
  video.closest('details')?.addEventListener('toggle', () => { if(video.closest('details').open) start(); else video.pause(); });
  const togglePlay = () => {
    if (video.paused) { userPaused = false; start({ gesture: true }); }
    else { userPaused = true; video.pause(); update(); }
  };
  play.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  sound.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && !userPaused) start({ gesture: true });
    update();
  });
  video.addEventListener('play', update);
  video.addEventListener('pause', update);
  video.addEventListener('volumechange', update);
  const showBanners = () => {
    if (!document.getElementById('welcome-banners')) return;
    bannersActive = true;
    bannerBreakShown = true;
    userPaused = true;
    video.inert = true;
    controls.inert = true;
    video.pause();
    update();
    document.dispatchEvent(new Event('goullart:showbanners'));
  };
  video.addEventListener('timeupdate', () => {
    if (!bannerBreakShown && video.currentTime >= 20) showBanners();
  });
  video.addEventListener('ended', showBanners);
  document.addEventListener('goullart:requestbanners', showBanners);
  document.addEventListener('goullart:replaywelcome', () => {
    bannersActive = false;
    userPaused = false;
    video.inert = false;
    controls.inert = false;
    video.currentTime = 0;
    start({gesture:true});
  });
  video.addEventListener('error', () => {
    status.textContent = 'Não foi possível carregar o vídeo. Recarregue a página para tentar novamente.';
    status.hidden = false;
    update();
    showBanners();
  });
  // Native controls remain in the HTML if JavaScript is unavailable.
  controls.hidden = false;
  video.controls = false;
  video.defaultMuted = true;
  video.muted = true;
  video.playsInline = true;
  video.loop = false;
  update();
  // Let catalog data arrive before the video competes for mobile bandwidth.
  if (window.GoullartFeed) window.GoullartFeed.catch(() => {}).then(() => { catalogReady = true; start(); });
  else start();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (!inView) video.pause();
      else start();
    }, { threshold: 0.15 }).observe(video);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else start();
  });
  const floating = document.getElementById('floating-whatsapp');
  if (!floating) return;
  let stopMotion;
  window.addEventListener('scroll', () => {
    floating.classList.add('is-scrolling');
    clearTimeout(stopMotion);
    stopMotion = setTimeout(() => floating.classList.remove('is-scrolling'), 180);
  }, { passive: true });
})();
