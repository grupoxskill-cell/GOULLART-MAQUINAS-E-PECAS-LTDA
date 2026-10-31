(() => {
 const params=new URLSearchParams(location.search),area=params.get('area');
 const legacy=location.hash.slice(1);
 if(!area&&['pecas','locacao','implementos','ofertas'].includes(legacy)){
  params.set('area',legacy);location.replace('/?'+params.toString());return;
 }
 if(area!=='pecas')return;
 const page=document.querySelector('.area-page-content'),catalog=document.getElementById('catalog-results');
 if(!page||!catalog)return;
 const section=document.createElement('section');section.className='parts-family-browser';section.setAttribute('aria-label','Escolha a peça');
 section.innerHTML='<h2>Qual peça você procura?</h2><p>Escolha a família para ver os anúncios. Fotos reais de referência; confirme modelo e aplicação com a equipe.</p><div class="parts-family-grid"></div>';
 const grid=section.querySelector('.parts-family-grid');
 window.GoullartPartsFamilies.forEach(([id,label])=>{
  const button=document.createElement('button');button.type='button';button.className='parts-family-tile';button.dataset.family=id;button.setAttribute('aria-pressed','false');
  const img=document.createElement('img');img.src=window.GoullartPartsReference.family(id);img.alt='Foto real de referência: '+label;img.width=400;img.height=280;img.loading='lazy';img.decoding='async';
  const strong=document.createElement('strong');strong.textContent=label;
  const action=document.createElement('span');action.textContent='Ver peças →';button.append(img,strong,action);grid.append(button);
  button.addEventListener('click',()=>{
   window.GoullartCatalog.clearSearch();window.GoullartCatalog.setFilter('pecas');
   const select=document.getElementById('sort');select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));
   grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   catalog.scrollIntoView({behavior:'smooth',block:'start'});
  });
 });
 page.insertBefore(section,catalog);
 const reviews=catalog.querySelector('.g-reviews');if(reviews)catalog.append(reviews);
})();
