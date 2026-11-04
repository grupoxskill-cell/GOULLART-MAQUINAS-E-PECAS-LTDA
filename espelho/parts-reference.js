/* Real product photographs used as family references, never exact-SKU stock claims. */
(() => {
 const files={coroa:'coroa-giro.jpg',dentes:'dentes.jpg',correntes:'correntes.webp',bombas:'bomba-principal-escavadeira-k3v-k5v-v2.jpg',pinhao:'pinhao.jpg',cabine:'cabine.jpg',lanca:'lanca.jpg','concha-original':'concha.jpg','concha-trapezoidal':'concha-trapezoidal.jpg',pistao:'pistao.jpg',painel:'painel.jpg',motores:'motor-diesel.webp',translacao:'translacao.jpg',motriz:'motrizes.webp',roletes:'roletes.webp',sapatas:'sapatas.webp','rodas-guia':'rodas-guia.webp'};
 const normalize=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const family=id=>files[id]?'/assets/parts-real/'+files[id]:null;
 window.GoullartPartsReference={family,photo(title){
  const t=normalize(title);
  const rules=[['motriz',/^(?:aro motri[xz]|roda motriz|segmento aro motriz)/],['correntes',/^(?:par )?(?:corrente|esteira)(?!.*gaxeta)/],['sapatas',/^sapata/],['roletes',/^rolete/],['rodas-guia',/^roda[- ]?guia/],['coroa',/^(?:coroa.*giro|rolamento.*giro)/],['dentes',/^(?:dente|ponta.*concha|adaptador.*dente)/],['bombas',/^bomba.*hidraulica/],['pinhao',/^pinhao/],['cabine',/^cabine/],['lanca',/^lanca/],['concha-trapezoidal',/^(?:concha|cacamba).*trapez/],['concha-original',/^(?:concha|cacamba)/],['pistao',/^(?:pistao|cilindro (?:hidraulico|da lanca|da concha|do braco))/],['painel',/^(?:painel|monitor)/],['translacao',/^motor.*(?:translacao|tracao)/],['motores',/^motor(?: diesel| completo| de escavadeira| de trator|\s*\d)/]];
  const id=rules.find(([,pattern])=>pattern.test(t))?.[0];return family(id);
 }};
})();
