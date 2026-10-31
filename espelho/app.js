const initialVisible=12;
const PHONE='5562999427276';
const contact=t=>'https://wa.me/'+PHONE+'?text='+encodeURIComponent(t);
function bind(){document.querySelectorAll('[data-contact]').forEach(a=>{a.href=contact(a.dataset.contact);a.target='_blank';a.rel='noopener';});}bind();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(n);
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const freshnessStamp=item=>Date.parse(item?.updatedAt||item?.publishedAt||item?.receivedAt||item?.date||'')||0;
const $=s=>document.querySelector(s);let items=[],filter=['maquinas','pecas','implementos','locacao'].includes(location.hash.slice(1))?location.hash.slice(1):'maquinas',visible=initialVisible;
let machineType='',offersMode=false,selectedItemId='';
const searchField=$('#search')||{value:''};
const categories={maquinas:'Pátio de máquinas',pecas:'Peças',implementos:'Implementos / Outros',locacao:'Editais e Locações'};
function photoStrip(i){const pictures=[...new Set([i.image,...(i.images||[])].filter(Boolean))];return pictures.length>1?`<div class="approved-thumbnails">${pictures.slice(1,3).map((src,index)=>`<a href="${esc(src)}" data-zoom data-gallery="${esc(JSON.stringify(pictures))}" aria-label="Ampliar foto ${index+2} de ${esc(i.title)}"><img src="${esc(src)}" alt="Outro ângulo de ${esc(i.title)}" loading="lazy" width="240" height="160"></a>`).join('')}</div>`:'';}
function partReferenceCard(i){const photo=window.GoullartPartsReference?.photo(i.title);return photo?`<div class="catalog-part-photo"><a href="${esc(photo)}" data-zoom aria-label="Ampliar foto de referência"><img src="${esc(photo)}" alt="Foto de referência da família de ${esc(i.title)}" loading="lazy" decoding="async" width="400" height="267"></a><small>Foto de referência da família. Confirme o modelo.</small></div>`:`<div class="catalog-part-reference"><span>GOULLART PEÇAS</span><strong>${esc(i.publicCode||i.id)}</strong><small>Solicite uma foto deste item à equipe.</small></div>`;}
function syncCatalogSelect(){
 const select=$('#sort'),parts=filter==='pecas',rentals=filter==='locacao';
 if(select.dataset.mode===(offersMode?'offers':parts?'parts':rentals?'rentals':'sort'))return;
 select.dataset.mode=offersMode?'offers':parts?'parts':rentals?'rentals':'sort';
 $('#catalog-select-label').textContent=parts?'Tipo de peça':'Ordenar';
 select.innerHTML=offersMode?'<option value="low">Menor preço</option>':parts?'<option value="all-parts">Todas as peças</option>'+window.GoullartPartsFamilies.map(([id,label])=>'<option value="'+id+'">'+esc(label)+'</option>').join(''):rentals?'<option value="recent">Últimas recebidas primeiro</option>':'<option value="recent">Mais recentes</option><option value="low">Menor preço</option><option value="high">Maior preço</option>';
}
function render(){syncCatalogSelect();if($('#catalog-reset'))$('#catalog-reset').hidden=!selectedItemId;$('#products').dataset.category=filter||'all';const emptyContact=$('#empty [data-contact]');if(emptyContact){emptyContact.href=contact(offersMode?'Olá, procuro máquinas em oferta, com preço abaixo do mercado. Quais oportunidades estão confirmadas?':filter==='implementos'?'Olá, procuro um implemento para minha máquina. Pode me ajudar com aplicação, preço e disponibilidade?':emptyContact.dataset.contact);}const emptyTitle=$('#empty h3');if(emptyTitle)emptyTitle.textContent=selectedItemId?'Este anúncio não está disponível. Consulte a equipe ou veja os outros anúncios.':offersMode?'Nenhuma oferta abaixo do mercado confirmada no momento. Consulte a equipe.':searchField.value||$('#catalog-budget')?.value||$('#catalog-favorites')?.getAttribute('aria-pressed')==='true'?'Nenhum anúncio com estes filtros. Ajuste a busca ou fale com a equipe.':filter==='implementos'?'Procura concha, rompedor, garra ou outro implemento? Fale com a equipe.':'Em breve novos anúncios. Fale com a equipe.';let list=items.filter(i=>window.GoullartRoutes.matchesItem(i,selectedItemId)&&GoullartListingPolicy.eligibleListing(i)&&(!filter||i.category===filter)&&(!machineType||window.GoullartMachineTypes.matches(i,machineType))&&(!$('#catalog-state')?.value||i.state===$('#catalog-state').value)&&(!window.GoullartRefine||window.GoullartRefine.matches(i))&&normalize(searchField.value).split(/\s+/).filter(Boolean).every(term=>normalize(i.title+' '+i.publicText+' '+i.id+' '+(i.state||'')+' '+(i.publicCode||'')).replace(/[^a-z0-9]/g,'').includes(term.replace(/[^a-z0-9]/g,''))));if(offersMode)list=list.filter(i=>i.category==='maquinas'&&i.offer?.verified===true&&i.offer.price===i.price&&i.offer.discountPercent>=20);const order=offersMode?'low':$('#sort').value;
 if(filter==='pecas'&&order!=='all-parts'){
  const family=window.GoullartPartsFamilies.find(([id])=>id===order);
  if(family)list=list.filter(i=>new RegExp(family[2]).test(normalize(i.title)));
 }
 list.sort((a,b)=>filter==='locacao'||filter==='pecas'||order==='recent'?freshnessStamp(b)-freshnessStamp(a):a.price==null?1:b.price==null?-1:order==='low'?a.price-b.price:b.price-a.price);$('#count').textContent=list.length+' anúncios encontrados';$('#empty').hidden=!!list.length;$('#catalog-title').textContent=window.GoullartMachineTypes.label(machineType)||(offersMode?'Ofertas de máquinas':categories[filter])||'Máquinas, peças, editais e locações';$('#products').innerHTML=list.slice(0,visible).map(i=>{if(i.opportunitySummary)return opportunityCard(i);const itemLink=window.GoullartRoutes.link(i,location.origin);const message='Olá, tenho interesse no anúncio '+i.publicCode+': '+i.title+'. Pode me passar valor e disponibilidade? '+itemLink;return `<article class="product" id="item-${esc(i.id)}">${i.image?`<a class="product-photo" href="${esc(i.image)}" data-zoom data-gallery="${esc(JSON.stringify(i.images||[i.image]))}" aria-label="Ampliar foto de ${esc(i.title)}"><img src="${esc(i.image)}" alt="${esc(i.title)}" loading="lazy" decoding="async" width="640" height="440"></a>`:`${partReferenceCard(i)}`}${photoStrip(i)}<div class="product-body"><span class="product-category">${esc(i.category==='maquinas'?(window.GoullartMachineTypes.label(window.GoullartMachineTypes.classify(i))||'Máquina'):(categories[i.category]||'Equipamento'))}</span><p class="note"><strong>${esc(i.publicCode)}</strong> · ${esc(i.state||'Estado a confirmar')}</p><h3>${esc(i.title)}</h3>${i.category==='maquinas'?`<p class="note">${esc(window.GoullartCatalogData.facts(i))}</p>`:''}<p class="price">${i.price==null?'Consulte':money(i.price)}</p>${offersMode?`<p class="offer-badge">${esc(i.offer.discountPercent)}% ABAIXO DA REFERÊNCIA</p><p class="note">Referência de mercado: ${money(i.offer.referencePrice)} · Comparação conferida em ${esc(i.offer.reviewedAt.split('-').reverse().join('/'))}</p>`:''}<details><summary>Ver detalhes</summary><p class="item-description">${esc(i.publicText)}</p></details><p class="note">Confirme preço, disponibilidade e frete com a equipe.</p><a class="button" href="${esc(contact(message))}" target="_blank" rel="noopener">Pedir no WhatsApp</a></div></article>`}).join('');$('#more').hidden=list.length<=visible;}
function setFilter(value,options={}){filter=value;machineType=options.type||'';offersMode=!!options.offers;if($('#catalog-category'))$('#catalog-category').value=value;visible=initialVisible;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===value)));document.querySelectorAll('.category-banner').forEach(a=>{if(a.dataset.catalogFilter===value)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});document.querySelectorAll('[data-machine-type]').forEach(a=>{if(value==='maquinas'&&a.dataset.machineType===machineType)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});render();document.dispatchEvent(new CustomEvent('goullart:filterchange',{detail:{category:value}}));}
function opportunityCard(i){
 const edital=i.kind==='edital',demanda=i.kind!=='oferta',date=i.deadline?new Date(i.deadline+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):null;
 const message='Olá, tenho interesse na oportunidade '+i.publicCode+': '+i.title+'. Pode me informar os detalhes e as condições?';
 return `<article class="product opportunity-card" id="item-${esc(i.id)}"><div class="opportunity-heading"><span>${edital?'EDITAL DE LOCAÇÃO':demanda?'SOLICITAÇÃO DE LOCAÇÃO':'OFERTA DE LOCAÇÃO'}</span><strong>${esc(i.publicCode||i.id)}</strong><small>${demanda?'Pedido de contratação':'Equipamento para alugar'}</small></div><div class="product-body"><p class="opportunity-status">${esc(i.status)}</p><h3>${esc(i.title)}</h3><p class="opportunity-city">${esc(i.state||'Estado a confirmar')}</p><p class="item-description">${esc(i.publicText)}</p>${date?`<p class="note">Prazo informado: ${esc(date)}</p>`:''}<p class="note">${demanda?'Confirme prazo, requisitos e condições com a equipe.':'Confirme disponibilidade, preço e frete com a equipe.'}</p><a class="button" href="${esc(contact(message))}" target="_blank" rel="noopener">Consultar a equipe</a></div></article>`;
}
window.GoullartCatalog={setFilter,render,route:routeCategory,getItems:()=>items,clearSearch(){searchField.value='';clearSelectedItem();},clearType(){machineType='';offersMode=false;history.replaceState(null,'','#'+filter);render();}};
let catalogFingerprint='',refreshing=false,initialCatalog=true;
async function refreshCatalog(){
 if(refreshing)return;refreshing=true;
 try{
  const response=await fetch('/api/catalog',{cache:'no-store',signal:window.GoullartRuntime.timeout(15000)});
  if(!response.ok)throw Error('Catálogo indisponível');
  const d=window.GoullartCatalogData.feed(await response.json());const fingerprint=JSON.stringify(d);
  if(fingerprint!==catalogFingerprint){
   catalogFingerprint=fingerprint;
   items=[...(d.items||[]),...(d.opportunities||[])].map(i=>i.category==='pecas'?{...i,title:window.GoullartPartsOrder.title(i.title)}:i);
   const typeCounts=window.GoullartMachineTypes.counts(items);
   document.querySelectorAll('[data-machine-count]').forEach(el=>{const n=typeCounts[el.dataset.machineCount]||0;el.textContent=n+' anúncio'+(n===1?'':'s');});
   const stateSelect=$('#catalog-state');if(stateSelect){const selected=stateSelect.value;stateSelect.innerHTML='<option value="">Todos os estados</option>'+[...new Set(items.map(i=>i.state).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>'<option>'+esc(v)+'</option>').join('');stateSelect.value=selected;}
   if(initialCatalog){
    const target=new URLSearchParams(location.search).get('item');selectedItemId=target||'';
    const item=target?items.find(i=>window.GoullartRoutes.matchesItem(i,target)):null;
    if(item){
     filter=item.category;
     const url=new URL(location.href);
     if(url.searchParams.get('area')!==item.category){url.searchParams.set('area',item.category);url.hash='';location.replace(url.href);return d;}
    }
    setFilter(filter);
   }
   else render();
   document.dispatchEvent(new CustomEvent('goullart:catalogupdate',{detail:d}));
  }
  initialCatalog=false;return d;
 }finally{refreshing=false;}
}
const feed=refreshCatalog();
setInterval(()=>{if(!document.hidden)refreshCatalog().catch(()=>{});},2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCatalog().catch(()=>{});});
window.addEventListener('online',()=>refreshCatalog().catch(()=>{}));
window.GoullartFeed=feed;
feed.catch(()=>{$('#count').textContent='Não foi possível carregar os anúncios. Isso não significa que o catálogo está vazio.';$('#empty').hidden=true;$('#more').hidden=true;$('#products').innerHTML='<p>Confira sua conexão e <button type="button" class="button outline" id="retry-catalog">Tentar novamente</button></p>';document.getElementById('retry-catalog').onclick=()=>location.reload();});
function clearSelectedItem(){selectedItemId='';const url=new URL(location.href);if(url.searchParams.has('item')){url.searchParams.delete('item');history.replaceState(null,'',url);}}
searchField.oninput=()=>{clearSelectedItem();visible=initialVisible;render()};
if($('#catalog-reset'))$('#catalog-reset').onclick=()=>{window.GoullartCatalog.clearSearch();visible=initialVisible;render();};$('#sort').onchange=()=>{visible=initialVisible;render()};if($('#search-button'))$('#search-button').onclick=()=>{render();$('#products').scrollIntoView({behavior:'smooth',block:'start'})};$('#more').onclick=()=>{visible+=6;render()};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{searchField.value='';setFilter(b.dataset.filter);history.pushState(null,'','#'+(b.dataset.filter||'maquinas'));});
document.querySelectorAll('[data-catalog-filter]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.assign('/?area='+encodeURIComponent(a.dataset.catalogFilter));}));
document.querySelectorAll('[data-machine-type]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.assign('/?area=maquinas&tipo='+encodeURIComponent(a.dataset.machineType));}));
document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-part]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#need').value=b.dataset.part;$('#quote').scrollIntoView({behavior:'smooth',block:'center'});$('#need').focus({preventScroll:true});});
$('#quote').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const lines=['Olá, tenho interesse em '+f.get('need')+'. Pode me passar valor e disponibilidade?'];if(f.get('name'))lines.push('Nome: '+f.get('name'));if(f.get('city'))lines.push('Cidade: '+f.get('city'));if(f.get('model'))lines.push('Marca e modelo: '+f.get('model'));const u=contact(lines.join('\n'));$('#quote-handoff').href=u;$('#quote-handoff').hidden=false;location.assign(u);};

function routeCategory(){
 const pageParams=new URLSearchParams(location.search), area=pageParams.get('area');
 const c=area||location.hash.slice(1)||'',type=c==='maquinas'?pageParams.get('tipo')||'':c.startsWith('tipo-')?c.slice(5):'';
 if(type&&window.GoullartMachineTypes.label(type))setFilter('maquinas',{type});
 else if(c==='ofertas'){setFilter('maquinas',{offers:true});$('#sort').value='low';render();}
 else if(['maquinas','pecas','implementos','locacao'].includes(c))setFilter(c);
 else return;
 if(!area)$('#catalog-results').scrollIntoView({block:'start'});
}
window.addEventListener('hashchange',routeCategory);feed.then(routeCategory).catch(()=>{});

searchField.addEventListener?.('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchField.blur();$('#search-button').click();}});

$('#catalog-category')?.addEventListener('change',e=>{setFilter(e.target.value);});
$('#catalog-state')?.addEventListener('change',()=>{visible=initialVisible;render();});
