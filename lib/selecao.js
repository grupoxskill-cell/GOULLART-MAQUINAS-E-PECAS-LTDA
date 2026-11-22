import { readFile } from "node:fs/promises";
import "../espelho/listing-policy.js";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export async function faixa300(catalogo) {
  const modelo=await readFile(new URL("../public/selecao.html",import.meta.url),"utf8");
  const itens=catalogo.items.filter(i=>i.category==="maquinas" && i.price>0 && i.price<=300000 && globalThis.GoullartListingPolicy.eligibleListing(i));
  const cards=itens.map(i=>`<article><h2><a href="/?area=maquinas&amp;item=${encodeURIComponent(i.id)}">${esc(i.title)}</a></h2><p>${esc(i.location||i.state||"Localização a confirmar")}</p><strong>${esc(i.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}))}</strong></article>`).join("");
  return modelo.replace("Máquinas por preço e horas","Máquinas até R$ 300 mil").replace("<h1>Máquinas por orçamento</h1>","<h1>Máquinas até R$ 300 mil</h1>")
    .replace('id="limite"','value="300000" id="limite"').replace('<section id="lista" class="cards" aria-label="Máquinas"></section>',()=>'<section id="lista" class="cards" aria-label="Máquinas">'+cards+'</section>');
}
