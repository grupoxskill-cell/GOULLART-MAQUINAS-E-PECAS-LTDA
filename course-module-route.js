(() => {
 const module=new URLSearchParams(location.search).get('modulo');
 if(module&&/^[2-5]$/.test(module))location.replace('/curso/modulo-'+module+'?modulo='+module);
})();
