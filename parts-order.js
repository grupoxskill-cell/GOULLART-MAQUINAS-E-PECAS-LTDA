// Commercial display order, applied only to the default parts catalogue view.
window.GoullartPartsOrder={
 title(value){return String(value||'').replace(/\bMOTRIX\b/gi,m=>m===m.toUpperCase()?'MOTRIZ':'motriz');},
 rank(value){const t=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/^(?:aro motri[xz]|roda motriz)/.test(t))return 0;
  if(/^(?:par )?(?:corrente|esteira)/.test(t))return 1;
  if(/^rolete/.test(t))return 2;
  if(/motor.*(?:translacao|tracao)|(?:translacao|tracao).*motor/.test(t))return 3;
  if(/bomba.*hidraulica|hidraulica.*bomba/.test(t))return 4;
  return 5;
 }
};
