(() => {
  const metrica = async (ref, tipo) => {
    let navegador;
    if(tipo==="visita"){
      try {
        const dia=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
        const salvo=JSON.parse(localStorage.getItem("goullart-visita")||"null");
        navegador=salvo?.dia===dia?salvo.id:crypto.randomUUID();
        if(salvo?.dia!==dia)localStorage.setItem("goullart-visita",JSON.stringify({dia,id:navegador}));
      } catch { /* A página continua disponível sem armazenamento. */ }
    }
    return fetch("/api/interesse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ref,tipo,navegador}),keepalive:true});
  };
  const vistas=new Set();
  async function mostrar(ref,area){
    if(!ref||!area)return;
    try {
      if(!vistas.has(ref)){vistas.add(ref);await metrica(ref,"visita");}
      const r=await fetch("/api/interesse?ref="+encodeURIComponent(ref),{cache:"no-store"});if(!r.ok)return;
      const d=await r.json();if(!area.isConnected)return;
      const elementos=[];
      if(d.verificada===true){const selo=document.createElement("strong");selo.className="machine-cat";selo.textContent="Verificada pelo Radar · "+d.conferidaEm.split("-").reverse().join("/");elementos.push(selo);}
      if(d.navegadores>0){const p=document.createElement("p");p.textContent=d.navegadores+" navegador"+(d.navegadores===1?" distinto":"es distintos")+" nesta ficha hoje";elementos.push(p);}
      if(d.video){const video=document.createElement("video");video.src=d.video;video.controls=true;video.playsInline=true;video.preload="metadata";video.style.maxWidth="100%";video.setAttribute("aria-label","Vídeo de 15 segundos do horímetro");elementos.push(video);}
      area.replaceChildren(...elementos);
    }catch{/* A ficha funciona também na hospedagem estática. */}
  }
  window.GoullartProva={mostrar};
  mostrar(document.body.dataset.ref,document.querySelector("[data-prova-publica]"));
  document.addEventListener("click",e=>{const a=e.target.closest("a[data-interesse]");const ref=a?.dataset.ref||document.body.dataset.ref;if(a&&ref)metrica(ref,"interesse").catch(()=>{});});
})();
