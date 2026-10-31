(() => {
  const videos = [...document.querySelectorAll("video")];
  videos.forEach(video => {
    const playButton = document.querySelector('[data-video="' + video.id + '"]');
    const syncVideo = () => {
      if (!playButton) return;
      playButton.textContent = video.paused ? '▶ Assistir com música' : 'Ⅱ Pausar vídeo';
      playButton.setAttribute('aria-label', (video.paused ? 'Assistir com música: ' : 'Pausar vídeo: ') + video.getAttribute('aria-label'));
    };
    video.addEventListener('play', () => {
      videos.forEach(other => { if (other !== video) other.pause(); });
      syncVideo();
    });
    video.addEventListener('pause', syncVideo);
    video.addEventListener('ended', syncVideo);
    playButton?.addEventListener('click', async () => {
      if (!video.paused) { video.pause(); return; }
      video.muted = false;
      video.volume = 1;
      try { await video.play(); }
      catch { playButton.textContent = 'Toque no play do vídeo para assistir'; }
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { videos.forEach(video => video.pause()); }
  });
})();
