(() => {
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const definitions = [
 ['mini-carregadeira','Mini Carregadeira',/\bmini\s*[- ]?\s*carregadeira\b|\bbobcat\b/],
 ['retroescavadeira','Retroescavadeira',/\bretro(?:\s*[- ]?\s*escavadeira)?\b/],
 ['pa-carregadeira','Pá Carregadeira',/\b(?:pa\s*[- ]?\s*)?carregadeira\b/],
 ['escavadeira','Escavadeira',/\b(?:escavadeira|escavadora)\b/],
 ['motoniveladora','Motoniveladora',/\b(?:motoniveladora|moto\s+niveladora|patrol)\b/],
 ['trator-esteira','Trator de Esteira',/\btrator(?:es)?(?:\s+de)?\s+esteira\b/],
 ['trator-agricola','Trator Agrícola',/\btrator(?:es)?\b/],
 ['rolo-compactador','Rolo Compactador',/\b(?:rolo|compactador)\b/],
 ['tesoura','Plataforma Tesoura',/\btesoura\b/],
 ['articulada','Plataforma Articulada',/\b(?:plataforma\s+)?articulada\b/],
 ['telescopica','Plataforma Telescópica',/\b(?:plataforma\s+)?telescopica\b/],
 ['elevador-pessoal','Elevador Pessoal',/\b(?:elevador pessoal|plataforma individual)\b/],
 ['pipa','Caminhão Pipa',/\bpipa\b/],
 ['basculante','Caminhão Basculante',/\b(?:basculante|caminhao\s+cacamba)\b/],
 ['comboio','Caminhão Comboio',/\bcomboio\b/],
 ['munck','Caminhão Munck',/\b(?:munck|munk|guindauto)\b/],
 ['cavalo-mecanico','Cavalo Mecânico',/\bcavalo\s+mecanico\b/],
];
const modelRules = [
 ['pa-carregadeira',/\b(?:(?:volvo\s+)?l\s*(?:60|70|90|110|120|150|180|220)(?:[a-z])?|(?:komatsu\s+)?wa\s*\d{2,3}(?:[- ]\d)?|(?:hyundai\s+)?hl\s*\d{3}|(?:cat|caterpillar)\s*9(?:24|38|50|62|66|80)[a-z]?)\b/],
 ['retroescavadeira',/\b(?:(?:cat|caterpillar)\s*4(?:16|20)[a-z]?|jcb\s*3cx|case\s*580[a-z]?)\b/],
 ['escavadeira',/\b(?:(?:komatsu\s+)?pc\s*\d{3}(?:[- ]\d)?|(?:volvo\s+)?ec\s*\d{3}[a-z]*|(?:hyundai\s+)?r\s*2(?:10|20)[a-z0-9-]*)\b/],
];
const entries = definitions.map(([id,label])=>[id,label]);
const label = id => entries.find(([key])=>key===id)?.[1] || '';
function classify(item) {
 if(item.category && item.category!=='maquinas')return '';
 if(label(item.machineType))return item.machineType;
 const text=normalize(item.title);
 for(const [id,,pattern] of definitions){
  if(id==='trator-agricola'&&/\besteira|rodoviario\b/.test(text))continue;
  if(pattern.test(text))return id;
 }
 return modelRules.find(([,pattern])=>pattern.test(text))?.[0] || '';
}
const machineTypes = {
 entries,
 label,
 classify,
 matches(item,id){return !label(id)||classify(item)===id;},
 counts(items){const result=Object.fromEntries(entries.map(([id])=>[id,0]));for(const item of items){const id=classify(item);if(id)result[id]++;}return result;},
};

window.GoullartMachineTypes=machineTypes;
})();
