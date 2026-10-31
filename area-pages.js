(() => {
 const entries=[['texas','TEXAS','Botas e informações da marca','horizontal-botas-texas'],['magazine','MAGAZINE','Notícias e informações do Radar','horizontal-magazine-canais'],['pecas','PEÇAS','Componentes e pedidos de orçamento','horizontal-pecas-motores'],['locacao','LOCAÇÃO','Equipamentos e oportunidades de locação','horizontal-protecoes'],['maquinas','VENDAS DE MÁQUINAS','Anúncios organizados por equipamento','horizontal-junior-catalogo']];
 const main=document.querySelector('main');if(!main)return;
 const hub=document.createElement('section');hub.className='business-cards';hub.setAttribute('aria-label','Áreas GOULLART');
 hub.innerHTML=entries.map(([id,title,desc,image])=>`<a href="${id==='texas'?'/texas.html':'/?area='+id}"><img src="/assets/banners/${image}.jpeg" alt="${title}" loading="lazy"><strong>${title}</strong><span>${desc}</span><b>ACESSAR</b></a>`).join('');
 const banner=document.getElementById('approved-banner');if(banner)banner.after(hub);else main.prepend(hub);
 const params=new URLSearchParams(location.search),route=window.GoullartRoutes.resolve(location.href),area=route.area;
 document.querySelectorAll('a[href="#inicio"]').forEach(a=>a.setAttribute('href','/'));
 document.querySelector('.skip-link')?.setAttribute('href','/?area=maquinas');
 if(!entries.some(e=>e[0]===area)&&!['ofertas','implementos'].includes(area))return;
 if(!params.get('area')){params.set('area',area);if(route.type)params.set('tipo',route.type);history.replaceState(null,'','/?'+params.toString()+location.hash);}
 document.body.classList.add('area-page');
 const page=document.createElement('div');page.className='area-page-content';main.prepend(page);
 const title=area==='ofertas'?'OFERTAS ABAIXO DO MERCADO':area==='implementos'?'IMPLEMENTOS / OUTROS':window.GoullartMachineTypes?.label(params.get('tipo'))||entries.find(e=>e[0]===area)[1];
 document.title=title.toUpperCase()+' | GOULLART';
 page.innerHTML='<a class="area-back" href="/">← VOLTAR AO INÍCIO</a><h1>'+title+'</h1>';
 if(area==='ofertas')page.insertAdjacentHTML('beforeend','<p class="offers-intro">MÁQUINAS COM PREÇO ABAIXO DO MERCADO E COMPARAÇÃO CONFERIDA PELA EQUIPE.</p>');
 if(area==='magazine'){const template=document.getElementById('magazine-news-template');if(template)page.append(template.content.cloneNode(true));}
 else if(area==='texas')page.insertAdjacentHTML('beforeend','<article class="texas-info"><img src="/assets/banners/horizontal-botas-texas.jpeg" alt="Botas GOULLART Texas — estudo de personalização"><h2>GOULLART TEXAS</h2><p>Estudo de personalização de botas GOULLART Texas.</p><p>Consulte modelos, tamanhos, valores e disponibilidade com a equipe.</p><a class="button" href="https://wa.me/5562999427276?text=Quero%20informa%C3%A7%C3%B5es%20sobre%20GOULLART%20Texas" target="_blank" rel="noopener">CONSULTAR TEXAS</a></article>');
 else {for(const selector of ['.search-area','#catalog-results']){const element=document.querySelector(selector);if(element)page.append(element);}if(area==='maquinas'&&!params.get('tipo')){const cats=document.querySelector('.machine-categories');if(cats)page.insertBefore(cats,page.children[2]||null);}if(area==='pecas'){const quote=document.getElementById('quote');if(quote)page.append(quote);}}
})();
