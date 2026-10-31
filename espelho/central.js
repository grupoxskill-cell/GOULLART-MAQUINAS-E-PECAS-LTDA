(() => {
 const button=document.querySelector('[data-copy-central]');
 button?.addEventListener('click',async()=>{
  const value=location.origin+'/central';
  try{await navigator.clipboard.writeText(value);document.querySelector('#copy-status').textContent='Link copiado.';}
  catch{document.querySelector('#copy-status').textContent='Copie este link: '+value;}
 });
 const search=document.querySelector('#module-search');
 const normal=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 search?.addEventListener('input',()=>{
  const term=normal(search.value.trim());let count=0;
  document.querySelectorAll('[data-module]').forEach(card=>{card.hidden=!normal(card.dataset.search).includes(term);if(!card.hidden)count++;});
  document.querySelector('#module-count').textContent=count+' '+(count===1?'área encontrada':'áreas encontradas');
  document.querySelector('#no-modules').hidden=count!==0;
 });
})();
