(() => {
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const phone='5562999427276',wa=text=>'https://wa.me/'+phone+'?text='+encodeURIComponent(text);
 const favorites=new Set(),selected=new Set();let favoritesOnly=false,timer;
 try{const ids=JSON.parse(sessionStorage.getItem('goullart-favorites')||'[]');if(Array.isArray(ids))ids.filter(x=>typeof x==='string').forEach(x=>favorites.add(x));}catch{}
 function toast(message){$('unified-toast').textContent=message;$('unified-toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('unified-toast').hidden=true,4000);}
 function rerender(){window.GoullartCatalog?.render();}
 window.GoullartRefine={matches(item){const limit=Number($('catalog-budget')?.value);return (!limit||(Number.isFinite(item.price)&&item.price<=limit))&&(!favoritesOnly||favorites.has(item.id));}};
 function syncActions(){
  if($('favorite-count'))$('favorite-count').textContent=favorites.size;
  document.querySelectorAll('#products .product').forEach(card=>{
   const id=card.id.slice(5),item=window.GoullartCatalog?.getItems().find(i=>i.id===id);if(!item||item.opportunitySummary)return;
   let actions=card.querySelector('.product-actions');if(!actions){actions=document.createElement('div');actions.className='product-actions';card.querySelector('.product-body').append(actions);}
   const desired=`<button type="button" data-favorite="${esc(id)}" aria-label="Favoritar ${esc(item.title)}" aria-pressed="${favorites.has(id)}">${favorites.has(id)?'♥ Salvo':'♡ Favoritar'}</button>${item.category==='maquinas'?`<button type="button" data-compare="${esc(id)}" aria-pressed="${selected.has(id)}">${selected.has(id)?'✓ Selecionada':'+ Comparar'}</button>`:''}`;
   if(actions.innerHTML!==desired)actions.innerHTML=desired;
  });
  $('compare-tray').hidden=selected.size===0;$('compare-count').textContent=selected.size+' de 3 máquinas';$('open-comparison').disabled=selected.size<2;
 }
 document.getElementById('products').addEventListener('click',e=>{
  const favorite=e.target.closest('[data-favorite]'),compare=e.target.closest('[data-compare]');
  if(favorite){const id=favorite.dataset.favorite;if(favorites.has(id))favorites.delete(id);else favorites.add(id);try{sessionStorage.setItem('goullart-favorites',JSON.stringify([...favorites]));}catch{}rerender();syncActions();}
  if(compare){const id=compare.dataset.compare;if(selected.has(id))selected.delete(id);else if(selected.size<3)selected.add(id);else toast('Compare até 3 máquinas por vez. Remova uma para escolher outra.');syncActions();}
 });
 new MutationObserver(()=>syncActions()).observe($('products'),{childList:true});
 $('catalog-budget')?.addEventListener('input',()=>{$('budget-note').hidden=!Number($('catalog-budget')?.value);rerender();});
 if($('catalog-favorites'))$('catalog-favorites').onclick=()=>{favoritesOnly=!favoritesOnly;$('catalog-favorites').setAttribute('aria-pressed',String(favoritesOnly));rerender();};
 $('clear-comparison').onclick=()=>{selected.clear();syncActions();};
 const dialog=$('comparison-dialog');
 $('open-comparison').onclick=()=>{
  const items=window.GoullartCatalog.getItems().filter(i=>selected.has(i.id));if(items.length<2){toast('Escolha pelo menos 2 máquinas.');return;}
  $('comparison-content').innerHTML=`<div class="comparison-grid" style="--compare-columns:${items.length}">${items.map(i=>`<article class="comparison-card">${i.image?`<img src="${esc(i.image)}" alt="${esc(i.title)}">`:''}<h3>${esc(i.title)}</h3><p class="compare-price">${i.price==null?'Consulte':money(i.price)}</p><p>${esc(i.publicCode)} · ${esc(i.state||'Estado a confirmar')}</p><p>${esc(i.publicText)}</p><a class="button" href="${esc(wa('Olá! Quero consultar '+i.publicCode+': '+i.title+'. Pode confirmar preço e disponibilidade?'))}" target="_blank" rel="noopener noreferrer">Consultar esta máquina ↗</a></article>`).join('')}</div>`;
  dialog.showModal();
 };
 $('close-comparison').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
 // Deep links from the former Pátio and B2B experiences remain in this origin.
 function route(){if(['b2b','negocios'].includes(location.hash.slice(1))){$('b2b').scrollIntoView({block:'start'});}}
 window.addEventListener('hashchange',route);
 window.GoullartFeed?.then(()=>{rerender();syncActions();route();}).catch(()=>{});
 syncActions();
})();
