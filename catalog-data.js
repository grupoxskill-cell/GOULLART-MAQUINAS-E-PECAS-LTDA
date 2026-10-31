/* Public catalogue corrections approved by GOULLART on 31/10/2026. */
(() => {
 const corrections={
  'GOUL-291':{title:'ESCAVADEIRA • HYUNDAI R220 LC-9 • 2022',year:2022,hours:'8.753'},
  'GOUL-293':{title:'TRATOR DE ESTEIRA • KOMATSU D51 • 2019',year:2019,hours:'7.900'},
  'GOUL-331':{title:'CAVALO MECÂNICO • MERCEDES-BENZ 2035 S • 2009',year:2009,km:'241.220'},
  'GOUL-330':{title:'CAMINHÃO PIPA • VW 31.330 6X4 • 2022',year:2022,hours:'13.100',km:'61.498'},
  'GOUL-348':{title:'CAMINHÃO BASCULANTE • VW 31.280 • 2022',year:2022,km:'71.020'},
  'GOUL-341':{title:'RETROESCAVADEIRA • CAT 416E • 2015',year:2015},
  'GOUL-333':{title:'TRATOR DE ESTEIRA • KOMATSU D61 EX • 2014',year:2014,hours:'11.400'},
  'GOUL-334':{title:'ESCAVADEIRA • VOLVO EC220DL • 2022',year:2022,hours:'7.000'},
  'GOUL-328':{title:'MOTONIVELADORA • CASE 845B • 2021',year:2021,hours:'3.200'},
  'GOUL-404':{title:'ESCAVADEIRA • HYUNDAI 210 LC-7 • 2012',year:2012,hours:'14.600',publicText:'Hyundai 210 LC-7. Ano: 2012. Horímetro: 14.600 h. Localização: Goiás. Confirme disponibilidade e condições com a equipe.'}
 };
 const clean=value=>String(value||'').replace(/\*/g,'').replace(/horimetro/gi,'Horímetro').replace(/manutenções em dias/gi,'manutenções em dia').replace(/14 metros quadrados/gi,'14 m³').replace(/7:900/g,'7.900 horas').replace(/litros\.{2,}/gi,'litros.');
 function asset(value){if(typeof value!=='string')return value;try{const u=new URL(value,'https://www.goullartmaquinaspesadas.com.br');return /^\/assets\/(?:listings|publicacoes)\//.test(u.pathname)?u.pathname+u.search:value;}catch{return value;}}
 function normalize(item){
  const patch=corrections[item.publicCode]||{},copy={...item,...patch,title:clean(patch.title||item.title),publicText:clean(patch.publicText||item.publicText)};
  if(item.publicCode==='GOUL-293'&&item.price==null)copy.price=600000;
  copy.image=asset(item.image);if(Array.isArray(item.images))copy.images=item.images.map(asset);
  return copy;
 }
 function facts(item){
  const i=normalize(item),text=i.publicText||'';
  const year=i.year||text.match(/ano\s*:?\s*((?:19|20)\d{2})/i)?.[1]||i.title.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const hours=i.hours||text.match(/horímetro\s*:?\s*([\d.]+)/i)?.[1],km=i.km||text.match(/\bkm\s*:?\s*([\d.]+)/i)?.[1];
  return [year?'Ano '+year:'Ano a confirmar',km?km+' km':hours?hours+' h':'Horímetro a confirmar',i.location||i.state||'Localização a confirmar'].join(' · ');
 }
 function feed(data){return {...data,items:(data.items||[]).map(normalize),opportunities:(data.opportunities||[]).map(normalize)};}
 globalThis.GoullartCatalogData={normalize,feed,facts,asset,clean};
})();
