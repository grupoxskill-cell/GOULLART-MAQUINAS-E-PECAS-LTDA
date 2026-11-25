/* Public catalogue corrections approved by GOULLART on 31/10/2026. */
(() => {
 const corrections={
  'GOUL-293':{title:'TRATOR DE ESTEIRA • KOMATSU D51 • 2019',year:2019,hours:'7.900'},
  'GOUL-331':{title:'CAVALO MECÂNICO • MERCEDES-BENZ 2035 S • 2009',year:2009,km:'241.220'},
  'GOUL-330':{title:'CAMINHÃO PIPA • VW 31.330 6X4 • 2022',year:2022,hours:'13.100',km:'61.498'},
  'GOUL-348':{title:'CAMINHÃO BASCULANTE • VW 31.280 • 2022',year:2022,km:'71.020'},
  'GOUL-341':{title:'RETROESCAVADEIRA • CAT 416E • 2015',year:2015},
  'GOUL-333':{title:'TRATOR DE ESTEIRA • KOMATSU D61 EX • 2014',year:2014,hours:'11.400'},
  'GOUL-334':{title:'ESCAVADEIRA • VOLVO EC220DL • 2022',year:2022,hours:'7.000',publicText:'Volvo EC220DL. Ano: 2022. Horímetro: 7.000 h. Confirme localização, disponibilidade e condições com a equipe.'},
  'GOUL-328':{title:'MOTONIVELADORA • CASE 845B • 2021',year:2021,hours:'3.200'},
  'GOUL-404':{title:'ESCAVADEIRA • HYUNDAI 210 LC-7 • 2012',year:2012,hours:'14.600',publicText:'Hyundai 210 LC-7. Ano: 2012. Horímetro: 14.600 h. Localização: Goiás. Confirme disponibilidade e condições com a equipe.'}
 };
 const clean=value=>String(value||'').replace(/\*/g,'').replace(/horimetro/gi,'Horímetro').replace(/manutenções em dias/gi,'manutenções em dia').replace(/14 metros quadrados/gi,'14 m³').replace(/7:900/g,'7.900 horas').replace(/litros\.{2,}/gi,'litros.');
 function asset(value){if(typeof value!=='string')return value;try{const u=new URL(value,'https://www.goullartmaquinaspesadas.com.br');return /^\/assets\/(?:listings|publicacoes)\//.test(u.pathname)?u.pathname+u.search:value;}catch{return value;}}
 // Valores pendentes de comprovação, revisão comercial de 22/11.
 const retidas=new Set(['GOUL-345','GOUL-ART-261105-06']);
 const cidadeUf=valor=>/^[\p{L}][\p{L} .’'-]{1,70}\s*[,/–-]\s*(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/iu.test(String(valor||'').trim());
 function locationText(value){
  const text=String(value||'').trim();
  const key=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
  return /^(?:(?:localizacao|estado|cidade|local)\s*:?\s*)?(?:a confirmar|sob consulta)$/.test(key)?'':text;
 }
 function cardDescription(item){
  const text=String(item.publicText||'');
  if(item.category!=='maquinas')return text;
  return text.replace(/(^|[.!?]\s+|\n[ \t]*)(?:localiza[çc][aã]o|estado)\s*:?\s*(?:a confirmar|sob consulta)(?:[.!?](?=\s|$)|(?=\n|$))[ \t]*/gi,'$1').trim();
 }
 function publicavel(item){
  // Anúncios autorizados continuam visíveis; localização pendente fica sem texto nos cards.
  const temImagem = temFoto(item) || item.fotos?.some(f => typeof f === 'string' && f.trim());
  return !retidas.has(item.publicCode || item.referencia) && !vendida(item) &&
   !item.archived && !item.privateOnly && item.published !== false &&
   ![item.status, item.situacao].some(s => /^(cancelad[ao]|bloquead[ao])$/i.test(s || '')) &&
   Boolean(temImagem);
 }
 function mensagem(item){return 'Tenho interesse na máquina '+item.title+' (ref. '+item.publicCode+'). Ainda está disponível?';}
 function normalize(item){
  const patch=corrections[item.publicCode]||{},copy={...item,...patch,title:clean(patch.title||item.title),publicText:clean(patch.publicText||item.publicText)};
  if(item.publicCode==='GOUL-293'&&item.price==null)copy.price=600000;
  copy.image=asset(copy.image);if(Array.isArray(copy.images))copy.images=copy.images.map(asset);
  if(item.publicCode==='GOUL-ART-261105-01'){
   const photo=value=>typeof value==='string'&&value.split('?')[0]==='/assets/listings/goul-art-261105-01.jpg'?'/assets/listings/john-deere-524k-ii-americana-f1530876.jpg':value;
   copy.image=photo(copy.image);
   if(Array.isArray(copy.images))copy.images=copy.images.map(photo);
   if(copy.image==='/assets/listings/john-deere-524k-ii-americana-f1530876.jpg')copy.artwork=false;
  }
  if(item.publicCode==='GOUL-405'){
   // Repair the missing imported photograph without replacing later photos chosen in the ADM.
   const photo='/assets/listings/maquina-pub149.webp',legacy='/assets/publicacoes/00003434-PHOTO-2026-09-15-15-13-34.webp';
   const repair=value=>value===legacy?photo:value;
   copy.image=repair(copy.image);if(Array.isArray(copy.images))copy.images=copy.images.map(repair);
   if(!String(copy.image||'').trim())copy.image=copy.images?.find(value=>typeof value==='string'&&value.trim())||photo;
   if(!copy.images?.some(value=>typeof value==='string'&&value.trim()))copy.images=[copy.image];
   if(copy.title==='2 RETROESCAVADEIRA • JCB 3CX')copy.title='RETROESCAVADEIRA • JCB 3CX • 2025';
  }
  return copy;
 }
 const moeda = new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'});
 function machinePriceIsPerUnit(price, publicText = '') {
  if (price == null) return false;
  // "Disponibilidade por unidade" ou "horas de cada máquina" não definem o preço.
  const frases = String(publicText || '').toLowerCase().split(/[.;!](?=\s|$)|\n/);
  return frases.some(texto => {
   const frase = texto.trim();
   if (/^(?:preço|valor) por unidade$/.test(frase)) return true;
   const quantia = frase.match(/^(?:preço|valor) por unidade:\s*r\$\s*([\d.,]+)$/)
    || frase.match(/^r\$\s*([\d.,]+)\s+cada(?: máquina)?$/);
   if (!quantia) return false;
   return Number(quantia[1].replace(/\./g, '').replace(',', '.')) === Number(price);
  });
 }
 function formatMachinePrice(price, publicText) {
  if (price == null) return 'Preço sob consulta';
  return moeda.format(price) + (machinePriceIsPerUnit(price, publicText) ? ' por unidade' : '');
 }
 function facts(item){
  const i=normalize(item),text=i.publicText||'';
  const year=i.year||text.match(/ano\s*:?\s*((?:19|20)\d{2})/i)?.[1]||i.title.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const hours=i.hours||text.match(/horímetro\s*:?\s*([\d.]+)/i)?.[1],km=i.km||text.match(/\bkm\s*:?\s*([\d.]+)/i)?.[1];
  return [year?'Ano '+year:'Ano a confirmar',km?km+' km':hours?hours+' h':'Horímetro a confirmar',locationText(i.location)||locationText(i.state)].filter(Boolean).join(' · ');
 }
 // Peças só aparecem no site com foto (pedido de Júnior em 04/11/2026). As demais seguem no ADM e voltam sozinhas quando ganharem foto.
 const temFoto=item=>Boolean((typeof item.image==='string'&&item.image.trim())||(Array.isArray(item.images)&&item.images.some(x=>typeof x==='string'&&x.trim())));
 // Máquinas que Júnior marcou como vendidas saem do site inteiro (home, ofertas, categorias e /adm/catalogo.json),
 // mesmo que o ADM ainda as tenha como "no site". GOUL-291: Hyundai R220 LC-9 2022, vendida (Trello, 04/11/2026).
 const vendidas=new Set(['GOUL-291','PUB-158']);
 function vendida(item){
  return String(item.status||item.situacao||'').toLowerCase()==='vendida'||vendidas.has(item.referencia)||vendidas.has(item.publicCode)||vendidas.has(item.id)||
   (item.publicationId!=null&&vendidas.has('PUB-'+item.publicationId));
 }
 const visivel=item=>!vendida(item)&&(item.category!=='pecas'||temFoto(item));
 function vitrine(data){const normalized=feed(data);return {...normalized,items:normalized.items.filter(i=>i.category!=='maquinas'||publicavel(i))};}
 function feed(data){return {...data,items:(data.items||[]).map(normalize).filter(visivel),opportunities:(data.opportunities||[]).map(normalize).filter(i=>!vendida(i))};}
 globalThis.GoullartCatalogData={normalize,feed,vitrine,facts,publicavel,mensagem,cidadeUf,locationText,cardDescription,machinePriceIsPerUnit,formatMachinePrice,asset,clean,visivel};
})();
