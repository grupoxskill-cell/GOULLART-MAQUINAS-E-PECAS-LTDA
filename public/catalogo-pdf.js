/* PDF A4 com uma página por unidade e foto original inteira. Cada JPEG é incorporado no próprio documento. */
window.baixarCatalogo = async function baixarCatalogo(itens) {
  const imagens=[];
  for (const i of itens) {
    const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=1414;
    const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,1000,1414);
    ctx.fillStyle="#0b294d";ctx.fillRect(0,0,1000,165);ctx.fillStyle="#fff";
    ctx.font="bold 46px sans-serif";ctx.fillText("GOULLART PESADOS",64,88);ctx.font="26px sans-serif";ctx.fillText("Catálogo selecionado",64,134);
    let foto=null;
    if(i.image)try {const url=new URL(i.image,location.href);if(url.origin===location.origin){const res=await fetch(url);if(res.ok)foto=await createImageBitmap(await res.blob());}}catch{}
    if(foto){const k=Math.min(872/foto.width,540/foto.height);ctx.drawImage(foto,(1000-foto.width*k)/2,186+(540-foto.height*k)/2,foto.width*k,foto.height*k);foto.close();}
    else {ctx.fillStyle="#475467";ctx.font="32px sans-serif";ctx.fillText("Foto pendente",64,420);}
    let y=805;ctx.fillStyle="#102b4c";
    function linha(txt,tamanho,negrito=false){
      ctx.font=(negrito?"bold ":"")+tamanho+"px sans-serif";
      let linha="";
      for(const palavra of String(txt).split(/\s+/)){
        const nova=(linha+" "+palavra).trim();
        if(linha && ctx.measureText(nova).width>864){ctx.fillText(linha,64,y);y+=tamanho*1.28;linha=palavra;}else linha=nova;
      }
      ctx.fillText(linha,64,y);y+=tamanho*1.45;
    }
    linha(i.title,38,true);linha(i.publicCode||i.id,24);
    linha(window.GoullartCatalogData.facts(i),27);
    linha(i.price>0?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(i.price):"Preço sob consulta",38,true);
    ctx.fillStyle="#0b294d";ctx.fillRect(0,1290,1000,124);ctx.fillStyle="#fff";ctx.font="25px sans-serif";
    ctx.fillText("Equipe Goullart Agro Brasil  ·  (62) 99942-7276",64,1342);
    ctx.fillText("Confirme preço e disponibilidade com a equipe.",64,1380);
    imagens.push(new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.86))).arrayBuffer()));
  }
  const partes=[], offsets=[0], enc=new TextEncoder();let tamanho=0;
  function inserir(v){const b=typeof v==="string"?enc.encode(v):v;partes.push(b);tamanho+=b.length;}
  function obj(n,...blocos){offsets[n]=tamanho;inserir(n+" 0 obj\n");blocos.forEach(inserir);inserir("\nendobj\n");}
  inserir("%PDF-1.4\n");obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  obj(2,"<< /Type /Pages /Count "+imagens.length+" /Kids ["+imagens.map((_,i)=>(3+3*i)+" 0 R").join(" ")+"] >>");
  imagens.forEach((img,i)=>{
    const n=3+3*i;obj(n,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Foto "+(n+1)+" 0 R >> >> /Contents "+(n+2)+" 0 R >>");
    obj(n+1,"<< /Type /XObject /Subtype /Image /Width 1000 /Height 1414 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+img.length+" >>\nstream\n",img,"\nendstream");
    const draw="q 595 0 0 842 0 0 cm /Foto Do Q\n";obj(n+2,"<< /Length "+draw.length+" >>\nstream\n"+draw+"endstream");
  });
  const xref=tamanho;inserir("xref\n0 "+offsets.length+"\n0000000000 65535 f \n");
  offsets.slice(1).forEach(b=>inserir(String(b).padStart(10,"0")+" 00000 n \n"));
  inserir("trailer\n<< /Size "+offsets.length+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
  const url=URL.createObjectURL(new Blob(partes,{type:"application/pdf"})),a=document.createElement("a");
  a.href=url;a.download="GOULLART-Catalogo-Selecionado.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
};
