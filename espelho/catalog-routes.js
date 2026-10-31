(() => {
 const areas=new Set(['maquinas','pecas','implementos','locacao','ofertas','magazine','texas']);
 function resolve(href){
  const url=new URL(href,'https://goullart.invalid'),hash=url.hash.slice(1),requested=url.searchParams.get('area');
  const area=areas.has(requested)?requested:areas.has(hash)?hash:hash.startsWith('tipo-')||url.searchParams.has('item')?'maquinas':hash==='quote'?'pecas':'';
  return {area,type:url.searchParams.get('tipo')||(hash.startsWith('tipo-')?hash.slice(5):''),item:url.searchParams.get('item')||''};
 }
 function link(item,origin=''){
  const area=areas.has(item.category)?item.category:'maquinas';
  return origin+'/?'+new URLSearchParams({area,item:item.id}).toString();
 }
 function matchesItem(item,target){return !target||item.id===target||item.publicCode===target;}
 window.GoullartRoutes={resolve,link,matchesItem};
})();
