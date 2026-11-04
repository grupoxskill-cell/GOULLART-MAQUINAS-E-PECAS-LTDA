(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousels = [];
  document.querySelectorAll('[data-testimonials]').forEach(root => {
    const viewport = root.querySelector('.g-reviews-viewport');
    const track = root.querySelector('.g-reviews-track');
    const group = root.querySelector('.g-reviews-set');
    const controls = root.querySelector('.g-reviews-controls');
    const toggle = root.querySelector('[data-review-toggle]');
    const clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    track.append(clone);
    const state = {root, viewport, paused:motion.matches, hover:false, focused:false, touching:false, visible:false, cycle:0, position:0, last:null, until:0};
    const updateToggle = () => {
      toggle.textContent = state.paused ? 'Reproduzir' : 'Pausar';
      toggle.setAttribute('aria-label', state.paused ? 'Reproduzir movimento dos depoimentos' : 'Pausar movimento dos depoimentos');
      toggle.setAttribute('aria-pressed', String(state.paused));
    };
    const measure = () => {
      root.style.setProperty('--review-width', Math.min(330,Math.max(1,viewport.clientWidth))+'px');
      state.cycle = clone.offsetLeft-group.offsetLeft;
      state.position = viewport.scrollLeft;
      state.last = null;
    };
    toggle.addEventListener('click', () => {state.paused=!state.paused;updateToggle();});
    const move = direction => {
      state.paused=true;updateToggle();
      const step=group.children[1].offsetLeft-group.children[0].offsetLeft;
      let next=viewport.scrollLeft+direction*step;
      if(next<0)next=state.cycle-step;
      if(next>=state.cycle)next=0;
      viewport.scrollTo({left:next,behavior:motion.matches?'auto':'smooth'});
    };
    root.querySelector('[data-review-prev]').addEventListener('click',()=>move(-1));
    root.querySelector('[data-review-next]').addEventListener('click',()=>move(1));
    viewport.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')state.hover=true;});
    viewport.addEventListener('pointerleave',()=>{state.hover=false;});
    viewport.addEventListener('pointerdown',()=>{state.touching=true;});
    const release=()=>{if(state.touching){state.touching=false;state.until=performance.now()+8000;}};
    window.addEventListener('pointerup',release,{passive:true});
    window.addEventListener('pointercancel',release,{passive:true});
    viewport.addEventListener('wheel',()=>{state.until=performance.now()+8000;},{passive:true});
    viewport.addEventListener('focusin',()=>{state.focused=true;});
    viewport.addEventListener('focusout',()=>{state.focused=false;});
    viewport.addEventListener('scroll',()=>{state.position=viewport.scrollLeft;},{passive:true});
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(viewport);
    else window.addEventListener('resize',measure,{passive:true});
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting;state.last=null;},{threshold:.05});
      observer.observe(root);
    } else state.visible=true;
    motion.addEventListener('change',()=>{state.paused=motion.matches;updateToggle();});
    controls.hidden=false;measure();updateToggle();carousels.push(state);
  });
  function frame(now) {
    carousels.forEach(s=>{
      const dt=s.last===null?0:Math.min(now-s.last,50);s.last=now;
      if(document.hidden||!s.visible||s.paused||s.hover||s.focused||s.touching||now<s.until||!s.cycle)return;
      s.position=(s.position+dt*.045)%s.cycle;
      s.viewport.scrollLeft=s.position;
    });
    requestAnimationFrame(frame);
  }
  if(carousels.length)requestAnimationFrame(frame);
})();
