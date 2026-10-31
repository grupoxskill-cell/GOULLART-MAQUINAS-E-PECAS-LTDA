(() => {
 const root=document.getElementById('approved-banner');if(!root)return;
 const slides=[...root.querySelectorAll('[data-slide]')],dots=[...root.querySelectorAll('[data-banner-to]')],pause=root.querySelector('[data-banner-pause]');
 if(!slides.length||!pause)return;
 const interval=Number(root.dataset.bannerInterval)||2000;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let current=0,paused=reduced.matches,timer,inView=true;
 function schedule(){clearTimeout(timer);if(slides.length>1&&!paused&&!reduced.matches&&!document.hidden&&inView&&!root.matches(':focus-within'))timer=setTimeout(()=>show(current+1),interval);}
 function preloadNext(){const image=slides[(current+1)%slides.length]?.querySelector('img');if(image)image.loading='eager';}
 function show(index){current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=i!==current;slide.inert=i!==current;});dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current)));preloadNext();schedule();}
 function sync(){pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',paused?'Continuar banners':'Pausar banners');schedule();}
 root.querySelector('[data-banner-next]').onclick=()=>show(current+1);root.querySelector('[data-banner-prev]').onclick=()=>show(current-1);
 dots.forEach((dot,i)=>dot.onclick=()=>show(i));pause.onclick=()=>{paused=!paused;sync();};
 root.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();show(current+1);}if(e.key==='ArrowLeft'){e.preventDefault();show(current-1);}});
 root.addEventListener('focusin',schedule);root.addEventListener('focusout',()=>setTimeout(schedule,0));
 document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',()=>{paused=reduced.matches;sync();});
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;schedule();}).observe(root);
 let touch;root.addEventListener('touchstart',e=>{touch={x:e.touches[0].clientX,y:e.touches[0].clientY};clearTimeout(timer);},{passive:true});
 root.addEventListener('touchend',e=>{if(!touch)return;const x=e.changedTouches[0].clientX-touch.x,y=e.changedTouches[0].clientY-touch.y;if(Math.abs(x)>45&&Math.abs(x)>Math.abs(y))show(current+(x<0?1:-1));else schedule();touch=null;},{passive:true});
 root.addEventListener('touchcancel',()=>{touch=null;schedule();});
 document.querySelector('.approved-presentation')?.addEventListener('toggle',()=>window.dispatchEvent(new Event('resize')));
 preloadNext();sync();
})();
