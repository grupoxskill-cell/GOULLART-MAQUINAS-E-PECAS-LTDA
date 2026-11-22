(async()=>{
  try{
    const r=await fetch("/api/interesse?vendidas=1",{cache:"no-store"});
    if(!r.ok)return;
    const itens=await r.json(),area=document.getElementById("entregues");
    for(const i of itens){
      const artigo=document.createElement("article"),selo=document.createElement("strong"),modelo=document.createElement("h2"),detalhes=document.createElement("p"),a=document.createElement("a");
      selo.textContent="Vendida";modelo.textContent=i.titulo;
      detalhes.textContent="Destino: "+i.destino+" · "+i.dias+" dia(s) entre o anúncio e a venda.";
      a.className="btn";a.textContent="Quero uma igual a essa";a.href="https://wa.me/5562999427276?text="+encodeURIComponent("Quero uma igual a essa: "+i.titulo);
      artigo.append(selo,modelo,detalhes,a);area.append(artigo);
    }
  }catch{/* O histórico estático continua disponível. */}
})();
