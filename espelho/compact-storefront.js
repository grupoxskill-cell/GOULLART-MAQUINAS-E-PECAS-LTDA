(()=>{
 const parts=document.getElementById('pecas'),rentals=document.getElementById('locacao');
 function select(category){parts.hidden=category!=='pecas';rentals.hidden=category!=='locacao';if(category==='pecas'){const expand=document.getElementById('parts-expand');if(expand)expand.open=true;}}
 function route(){const hash=location.hash.slice(1);if(hash==='publicacoes'||hash.startsWith('publicacao-')){document.getElementById('publications-disclosure').open=true;}if(hash==='quote')select('pecas');if(hash==='inicio'||!hash)select('maquinas');}
 document.addEventListener('goullart:filterchange',e=>select(e.detail.category));
 window.addEventListener('hashchange',route);
 document.querySelectorAll('a[href="#publicacoes"]').forEach(a=>a.addEventListener('click',()=>{document.getElementById('publications-disclosure').open=true;}));
 select(location.hash.slice(1));route();
})();
