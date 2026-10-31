/* Catalogue photography by family; never presented as an exact SKU photo. */
window.GoullartPartsReference={photo(title){const t=String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const family=/^(?:aro motri[xz]|roda motriz|segmento aro motriz)/.test(t)?'motrizes':/^(?:par )?(?:corrente|esteira)/.test(t)&&!t.includes('gaxeta')?'correntes':/^sapata/.test(t)?'sapatas':/^rolete/.test(t)?'roletes':/^roda[- ]?guia/.test(t)?'rodas-guia':null;
 return family?'/assets/parts-real/'+family+'.webp':null;
}};
