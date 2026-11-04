(() => {
  const grid = document.querySelector('.unified-category-grid');
  const button = document.querySelector('.category-motion-toggle');
  if (!grid || !button || grid.dataset.marqueeReady) return;
  grid.dataset.marqueeReady = 'true';
  const links = [...grid.children];
  const track = document.createElement('div');track.className = 'category-marquee-track';
  const group = document.createElement('div');group.className = 'category-marquee-set';
  links.forEach(link => group.append(link));
  const copy = group.cloneNode(true);copy.classList.add('category-marquee-copy');copy.setAttribute('aria-hidden','true');
  [...copy.children].forEach((link,index) => {
    link.removeAttribute('id');link.tabIndex=-1;
    link.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    link.addEventListener('click',event=>{event.preventDefault();links[index].click();});
  });
  track.append(group,copy);grid.append(track);grid.classList.add('category-marquee');
  grid.id ||= 'category-marquee';button.setAttribute('aria-controls',grid.id);
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused=reduceMotion.matches;
  const update=()=>{
    grid.classList.toggle('motion-paused',paused);
    button.setAttribute('aria-pressed',String(paused));
    button.textContent=paused?'Continuar categorias':'Pausar categorias';
    button.setAttribute('aria-label',paused?'Continuar movimento das categorias':'Pausar movimento das categorias');
  };
  const measure=()=>{
    const width=grid.clientWidth,gap=12;
    const tile=width<700?Math.min(160,Math.max(132,width*.38)):Math.max(160,(width-56)/4.3);
    grid.style.setProperty('--category-tile-width',tile+'px');
    grid.style.setProperty('--category-loop-duration',((tile+gap)*links.length/12)+'s');
  };
  button.addEventListener('click',()=>{paused=!paused;update();});
  reduceMotion.addEventListener('change',()=>{paused=reduceMotion.matches;update();});
  grid.addEventListener('pointerdown',()=>grid.classList.add('category-touching'));
  const release=()=>grid.classList.remove('category-touching');
  window.addEventListener('pointerup',release,{passive:true});
  window.addEventListener('pointercancel',release,{passive:true});
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(grid);
  else window.addEventListener('resize',measure,{passive:true});
  grid.addEventListener('focusin',event=>{
    const link=event.target.closest('.unified-category');
    if(!link)return;
    const offset=link.getBoundingClientRect().left-grid.getBoundingClientRect().left;
    if(offset<0||offset+link.offsetWidth>grid.clientWidth)grid.scrollLeft+=offset;
  });
  measure();update();
})();
