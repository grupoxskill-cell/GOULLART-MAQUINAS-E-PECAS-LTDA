(() => {
 const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const types = {
  'pa-carregadeira':['Pá Carregadeira', /\b(pa\s*[- ]?\s*carregadeira|carregadeira)\b/, /mini/],
  retroescavadeira:['Retroescavadeira', /\bretro(?:escavadeira)?\b/],
  escavadeira:['Escavadeira', /\b(escavadeira|escavadora)\b/, /retro/],
  motoniveladora:['Motoniveladora', /\b(motoniveladora|patrol)\b/],
  'trator-agricola':['Trator Agrícola', /\btrator\b/, /esteira|rodoviario/],
  'rolo-compactador':['Rolo Compactador', /\b(rolo|compactador)\b/],
  'mini-carregadeira':['Mini Carregadeira', /mini\s*[- ]?\s*carregadeira|\bbobcat\b/],
  tesoura:['Plataforma Tesoura', /\btesoura\b/],
  articulada:['Plataforma Articulada', /\barticulada\b/],
  telescopica:['Plataforma Telescópica', /\btelescopica\b/],
  'elevador-pessoal':['Elevador Pessoal', /\b(elevador pessoal|plataforma individual)\b/],
  pipa:['Caminhão Pipa', /\bpipa\b/],
  basculante:['Caminhão Basculante', /\bbasculante\b/],
  comboio:['Caminhão Comboio', /\bcomboio\b/],
  munck:['Caminhão Munck', /\b(munck|munk|guindauto)\b/],
 };
 window.GoullartMachineTypes = {
  label: id => types[id]?.[0] || '',
  matches(item,id) {const type=types[id];if(!type)return true;const text=normalize(item.title);return type[1].test(text)&&(!type[2]||!type[2].test(text));}
 };
})();
