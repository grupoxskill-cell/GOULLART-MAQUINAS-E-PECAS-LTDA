(() => {
  const $=id=>document.getElementById(id), q=$("termo"), max=$("limite"), area=$("lista"), pdf=$("pdf");
  const params=new URLSearchParams(location.search);q.value=params.get("q")||"";max.value=params.get("ate")||(/maquinas-ate-300-mil/.test(location.pathname)?"300000":"");
  const escolhidas=new Set();let itens=[],baixando=false;
  const el=(tag,t)=>Object.assign(document.createElement(tag),{textContent:t||""});
  const preco=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
  function render(){
    const encontrados=itens.filter(i=>(!max.value||(i.price>0&&i.price<=Number(max.value)))&&GoullartBusca.corresponde(i,q.value));
    area.replaceChildren(...encontrados.map(i=>{
      const card=el("article"),img=el("img");if(i.image){img.src=i.image;img.alt=i.title;img.loading="lazy";card.append(img);}
      const a=el("a",i.title);a.href="/?area=maquinas&item="+encodeURIComponent(i.id);const titulo=el("h2");titulo.append(a);
      const b=el("button",escolhidas.has(i.id)?"Remover da seleção":"Selecionar");
      b.setAttribute("aria-pressed",String(escolhidas.has(i.id)));b.disabled=baixando||(!escolhidas.has(i.id)&&escolhidas.size===3);
      b.onclick=()=>{if(escolhidas.has(i.id))escolhidas.delete(i.id);else if(escolhidas.size<3)escolhidas.add(i.id);render();};
      card.append(titulo,el("p",GoullartCatalogData.facts(i)),el("strong",i.price>0?preco(i.price):"Preço sob consulta"),el("br"),b);return card;
    }));
    $("resultado").textContent=encontrados.length?encontrados.length+" máquina(s) encontrada(s).":"Nenhuma máquina com esses critérios.";
    $("escolhas").textContent=escolhidas.size?Array.from(escolhidas,id=>itens.find(i=>i.id===id)?.title).join(" · "):"Selecione três máquinas para baixar o PDF.";
    pdf.disabled=baixando||escolhidas.size!==3;
  }
  $("filtros").onsubmit=e=>{e.preventDefault();const u=new URL(location.href);u.pathname="/selecao.html";u.search=new URLSearchParams({q:q.value,ate:max.value});history.replaceState(null,"",u);render();};
  async function carregar(){const r=await GoullartRuntime.fetchCatalog({cache:"no-store",signal:GoullartRuntime.timeout(8000)});
    itens=GoullartCatalogData.feed(await r.json()).items.filter(i=>i.category==="maquinas"&&GoullartListingPolicy.eligibleListing(i));
    for(const id of escolhidas)if(!itens.some(i=>i.id===id))escolhidas.delete(id);
  }
  pdf.onclick=async()=>{baixando=true;pdf.disabled=true;try{await carregar();if(escolhidas.size!==3)throw Error("O catálogo mudou. Confira a seleção.");
    await baixarCatalogo(itens.filter(i=>escolhidas.has(i.id)));}catch(e){alert(e.message||"Não foi possível gerar o PDF.");}finally{baixando=false;render();}};
  carregar().then(render).catch(()=>{$("resultado").textContent="Consulta online indisponível. Confira a seleção com a equipe.";});
})();
