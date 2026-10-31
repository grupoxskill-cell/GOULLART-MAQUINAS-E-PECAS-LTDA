import {readFile,writeFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import '../espelho/catalog-data.js';
const dataTools=globalThis.GoullartCatalogData;
const context={window:{}};vm.createContext(context);vm.runInContext(await readFile('espelho/catalog-types.js','utf8'),context);
const types=context.window.GoullartMachineTypes;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const empty='No momento sem unidades. Fale com a equipe que buscamos para você';
export async function prepareCatalogue(directory){
 const data=dataTools.feed(JSON.parse(await readFile(directory+'/api/catalog.json','utf8')));
 await writeFile(directory+'/api/catalog.json',JSON.stringify(data));
 const counts=types.counts(data.items);
 const files=['index.html','ofertas.html',...(await readdir(directory+'/maquinas')).filter(n=>n.endsWith('.html')).map(n=>'maquinas/'+n)];
 for(const filename of files){
  const path=directory+'/'+filename;let html=await readFile(path,'utf8');
  if(filename!=='index.html'){
   const type=filename.startsWith('maquinas/')?filename.slice(9,-5):'',offers=filename==='ofertas.html';
   const items=data.items.filter(i=>i.category==='maquinas'&&(!type||types.matches(i,type))&&(!offers||i.offer?.verified===true&&i.offer.price===i.price&&i.offer.discountPercent>=20)).sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
   const nav=types.entries.filter(([id])=>counts[id]>0).map(([id,label])=>`<a href="/maquinas/${id}"${id===type?' aria-current="page"':''}><span>${esc(label)}</span><strong>${counts[id]}</strong></a>`).join('');
   html=html.replace(/(<div id="catalog-page-categories">)[\s\S]*?(<\/div><\/nav>)/,'$1'+nav+'$2');
   html=html.replace(/(<p id="catalog-page-count">)[\s\S]*?(<\/p>)/,'$1'+items.length+' anúncios encontrados$2');
   const cards=items.map(i=>{
    const link='/?area=maquinas&item='+encodeURIComponent(i.id),contact='https://wa.me/5562999427276?text='+encodeURIComponent('Olá, tenho interesse no anúncio '+i.publicCode+': '+i.title+'. Pode confirmar preço e disponibilidade? https://www.goullartmaquinaspesadas.com.br'+link);
    return `<article class="catalog-page-card"><a href="${esc(link)}" aria-label="Ver ${esc(i.title)}"><img src="${esc(i.image)}" alt="${esc(i.title)}" width="640" height="440" loading="lazy"></a><div><p class="catalog-page-code">${esc(i.publicCode)} · ${esc(i.state||'Localização a confirmar')}</p><h2><a href="${esc(link)}">${esc(i.title)}</a></h2><p class="catalog-page-code">${esc(dataTools.facts(i))}</p><p class="catalog-page-price">${i.price==null?'Consulte':money(i.price)}</p><details><summary>Ver detalhes</summary><p>${esc(i.publicText)}</p></details><a class="catalog-page-contact" href="${esc(contact)}" target="_blank" rel="noopener noreferrer">Consultar máquina</a></div></article>`;
   }).join('');
   const fallback=`<div class="catalog-page-empty"><h2>${offers?'Nenhuma oferta confirmada no momento.':empty}</h2><a href="https://wa.me/5562999427276" target="_blank" rel="noopener noreferrer">Falar com a equipe pelo WhatsApp</a></div>`;
   html=html.replace(/(<section id="catalog-page-list"[^>]*>)[\s\S]*?(<\/section>)/,'$1'+(cards||fallback)+'$2');
  }
  html=html.replace(/<a\b[^>]*href="\/maquinas\/([a-z-]+)\/?"[^>]*>[\s\S]*?<\/a>/g,(tag,id)=>counts[id]===0?tag.replace('<a ','<a hidden '):tag);
  html=html.replace(/<details class="sidebar-group"[^>]*>[\s\S]*?<\/details>/g,tag=>/<a(?! hidden )/.test(tag)?tag:tag.replace('<details ','<details hidden '));
  await writeFile(path,html);
 }
 return data;
}
