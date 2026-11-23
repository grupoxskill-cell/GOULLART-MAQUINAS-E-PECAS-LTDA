(() => {
 const types=window.GoullartMachineTypes;if(!types)return;
 function update(){
  document.querySelectorAll('a[href^="/maquinas/"]').forEach(a=>{
   const id=a.getAttribute('href').split('/')[2]?.replace(/\.html$/,'');
   if(types.label(id))a.hidden=false;
  });
  document.querySelectorAll('.sidebar-group').forEach(group=>{group.hidden=false;});
 }
 document.addEventListener('goullart:catalogupdate',e=>update(e.detail));
 window.GoullartFeed?.then(update).catch(()=>{});
})();
