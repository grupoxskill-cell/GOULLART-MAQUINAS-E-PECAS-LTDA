(() => {
 const types=window.GoullartMachineTypes;if(!types)return;
 function update(data){
  const items=(data.items||[]).filter(i=>!window.GoullartListingPolicy||window.GoullartListingPolicy.eligibleListing(i));
  const counts=types.counts(items);
  document.querySelectorAll('a[href^="/maquinas/"]').forEach(a=>{
   const id=a.getAttribute('href').split('/')[2]?.replace(/\.html$/,'');
   if(types.label(id))a.hidden=!counts[id];
  });
  document.querySelectorAll('.sidebar-group').forEach(group=>{group.hidden=![...group.querySelectorAll('a')].some(a=>!a.hidden);});
 }
 document.addEventListener('goullart:catalogupdate',e=>update(e.detail));
 window.GoullartFeed?.then(update).catch(()=>{});
})();
