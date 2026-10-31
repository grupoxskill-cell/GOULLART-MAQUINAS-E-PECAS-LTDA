(() => {
 const types=window.GoullartMachineTypes,root=document.querySelector('[data-catalog-page]');
 if(!types||!root)return;
 const type=root.dataset.catalogType,offers=root.dataset.catalogOffers==='true',grid=document.getElementById('catalog-page-list'),count=document.getElementById('catalog-page-count'),nav=document.getElementById('catalog-page-categories'),form=document.getElementById('catalog-page-sort'),select=document.getElementById('page-order');
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);
 let items=null,fingerprint='',busy=false;
 function render(){
  if(!items)return;
  const counts=types.counts(items);
  nav.innerHTML=types.entries.filter(([id])=>counts[id]>0||id===type).map(([id,label])=>'<a href="/maquinas/'+id+'"'+(id===type?' aria-current="page"':'')+'><span>'+esc(label)+'</span><strong>'+counts[id]+'</strong></a>').join('');
  const list=items.filter(i=>i.category==='maquinas'&&(!type||types.matches(i,type))&&(!offers||i.offer?.verified===true&&i.offer.price===i.price&&i.offer.discountPercent>=20));
  const order=select.value;
  list.sort((a,b)=>order==='recent'?String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')):a.price==null?b.price==null?0:1:b.price==null?-1:order==='high'?b.price-a.price:a.price-b.price);
  count.textContent=list.length+' anúncio'+(list.length===1?' encontrado':'s encontrados');
  const html=list.map(i=>{
   const link='/?item='+encodeURIComponent(i.id)+'#maquinas',url=new URL(link,location.origin).href;
   const contact='https://wa.me/5562999427276?text='+encodeURIComponent('Olá, tenho interesse no anúncio '+i.publicCode+': '+i.title+'. Pode confirmar preço e disponibilidade? '+url);
   return '<article class="catalog-page-card"><a href="'+esc(link)+'" aria-label="Ver '+esc(i.title)+'"><img src="'+esc(i.image)+'" alt="'+esc(i.title)+'" width="640" height="440" loading="lazy"></a><div><p class="catalog-page-code">'+esc(i.publicCode)+' · '+esc(i.state||'Estado a confirmar')+'</p><h2><a href="'+esc(link)+'">'+esc(i.title)+'</a></h2><p class="catalog-page-price">'+(i.price==null?'Consulte':money(i.price))+'</p><details><summary>Ver detalhes</summary><p>'+esc(i.publicText)+'</p></details><a class="catalog-page-contact" href="'+esc(contact)+'" target="_blank" rel="noopener noreferrer">Consultar máquina</a></div></article>';
  }).join('');
  const next=html||'<div class="catalog-page-empty"><h2>'+(offers?'Nenhuma oferta confirmada no momento.':'Nenhum anúncio publicado nesta categoria.')+'</h2><p>Consulte as outras categorias acima ou fale com a equipe.</p><a href="https://wa.me/5562999427276" target="_blank" rel="noopener noreferrer">Consultar a GOULLART</a></div>';
  if(grid.dataset.rendered!==next){grid.innerHTML=next;grid.dataset.rendered=next;}
 }
 async function refresh(){
  if(busy)return;busy=true;
  try{
   const r=await ((o)=>fetch('/adm/catalogo.json',o).then((r)=>r.ok?r:Promise.reject(r)).catch(()=>fetch('/api/catalog.json',o)))({cache:'no-store',signal:window.GoullartRuntime.timeout(15000)});
   if(!r.ok)throw Error('Catálogo indisponível');
   const data=await r.json();if(!Array.isArray(data.items))throw Error('Resposta inválida');
   const next=JSON.stringify(data.items);
   if(next!==fingerprint){items=data.items;fingerprint=next;render();}
  }catch{/* Retain the server-rendered snapshot on a network failure. */}
  finally{busy=false;}
 }
 form.addEventListener('submit',event=>{if(!items)return;event.preventDefault();const url=new URL(location.href);url.searchParams.set('ordem',select.value);history.replaceState(null,'',url);render();});
 const order=new URLSearchParams(location.search).get('ordem');if(['low','high','recent'].includes(order))select.value=order;
 refresh();setInterval(()=>{if(!document.hidden)refresh();},2000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();