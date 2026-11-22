(() => {
  const normal = s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const numero = (s,unidade)=>Number(s.replaceAll(".","").replace(",","."))*(unidade==="mil"?1000:1);
  function corresponde(item,entrada){
    let q=normal(entrada);
    const expressao=/\b(ate|maximo(?: de)?|menos de|com)?\s*(\d+(?:\.\d{3})*(?:,\d+)?)\s*(mil)?\s*(?:horas?\b|h\b)/;
    const m=expressao.exec(q);
    if(m){
      const leitura=String(item.hours ?? "").trim().match(/^(\d+(?:\.\d{3})*(?:,\d+)?)\s*(?:h|horas?)?$/i);
      if(!leitura)return false;
      const h=numero(leitura[1]), alvo=numero(m[2],m[3]);
      if(m[1]==="menos de"?h>=alvo:m[1]&&m[1]!=="com"?h>alvo:h!==alvo)return false;
      q=q.replace(m[0]," ");
    }
    const base=normal([item.title,item.machineType,item.id,item.publicCode,item.publicText,item.location,item.state,item.year,item.hours].join(" ")).replace(/[^a-z0-9]/g,"");
    return q.split(/[^a-z0-9]+/).filter(s=>s&&!["em","de","do","da","no","na","com","e"].includes(s)).every(s=>base.includes(s));
  }
  globalThis.GoullartBusca={corresponde};
})();
