(() => {
 const button=document.getElementById('copy-pix'),code=document.getElementById('pix-code'),status=document.getElementById('pix-status');
 if(!button||!code)return;
 button.addEventListener('click',async()=>{
  try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(code.value);status.textContent='Código copiado. Cole na opção Pix copia e cola do seu banco.';}
  catch{code.focus();code.select();code.setSelectionRange(0,code.value.length);status.textContent='Toque e segure no código selecionado e escolha Copiar.';}
 });
})();
