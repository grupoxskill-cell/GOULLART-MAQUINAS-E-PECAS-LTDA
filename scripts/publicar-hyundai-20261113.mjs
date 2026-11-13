// Publicação pontual autorizada por Júnior. Nunca executa no servidor nem no build.
// Reutiliza a Hyundai 2018 já cadastrada e acrescenta somente as unidades de 2020 e 2021.
import { readFile, writeFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';

const publicPath = 'public/maquinas.json';
const catalogPath = 'espelho/api/catalog.json';
const machines = JSON.parse(await readFile(publicPath, 'utf8'));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
assert(Array.isArray(machines) && Array.isArray(catalog.items), 'Formato inesperado do catálogo');
const existing2018 = catalog.items.find(i => i.publicCode === 'H-2018-9895');
assert(existing2018, 'A unidade 2018 precisa ser conferida antes da publicação');
assert.equal(Number(existing2018.price), 360000);
assert.equal(Number(String(existing2018.hours).replace(/\D/g, '')), 9895);
assert.match(existing2018.publicText, /trincado/i);

const additions = [
  { code: 'GOUL-HY-2021-10000', year: 2021, hours: '10.000', price: 380000, image: '/assets/listings/h-2021-10000.jpg' },
  { code: 'GOUL-HY-2020-12000', year: 2020, hours: '12.000', price: 350000, image: '/assets/listings/h-2020-12000.jpg' }
];
const digits = value => Number(String(value ?? '').replace(/\D/g, ''));
const prepared = [];
for (const item of additions) {
  for (const root of ['public', 'espelho']) await access(root + item.image);
  const sameUnit = catalog.items.filter(i => /hyundai/i.test(i.title || '') && /220/.test(i.title || '') && Number(i.year) === item.year && digits(i.hours) === digits(item.hours));
  assert(sameUnit.every(i => i.publicCode === item.code), `Possível duplicata da Hyundai ${item.year}; revisar antes de publicar`);
  const oldSameUnit = machines.filter(m => /hyundai/i.test(m.titulo || '') && /220/.test(m.titulo || '') && Number(m.ano) === item.year && digits(m.horas) === digits(item.hours));
  assert(oldSameUnit.every(m => m.referencia === item.code), `Possível duplicata na ficha da Hyundai ${item.year}`);
  const text = `Escavadeira Hyundai R220LC-9, ano ${item.year}, ${item.hours} horas informadas. Belo Horizonte/MG. Máquina informada como revisada, com manutenção em dia e NF de origem. Documentação, estado e disponibilidade sujeitos à conferência antes da negociação.`;
  const listing = {
    id: item.code, publicCode: item.code,
    title: `ESCAVADEIRA • HYUNDAI R220LC-9 • ${item.year}`,
    category: 'maquinas', machineType: 'escavadeira', year: item.year,
    hours: item.hours, state: 'MG', location: 'Belo Horizonte/MG', price: item.price,
    catalogItem: false, publicText: text, image: item.image, images: [item.image],
    publishedAt: '2026-11-12', retentionPolicy: 'owner_confirmation', artwork: true
  };
  const machine = {
    ficha: 'arte-2026-11-12', referencia: item.code,
    titulo: 'Escavadeira Hyundai R220LC-9', categoria: 'Escavadeiras',
    ano: String(item.year), horas: item.hours + ' h',
    preco: 'R$ ' + item.price.toLocaleString('pt-BR'), local: 'Belo Horizonte/MG',
    fotos: [item.image.slice(1)], textoSite: text, artwork: true
  };
  prepared.push({ listing, machine });
}
for (const { listing, machine } of prepared) {
  const ci = catalog.items.findIndex(i => i.publicCode === listing.publicCode);
  if (ci < 0) catalog.items.unshift(listing); else catalog.items[ci] = { ...catalog.items[ci], ...listing };
  const mi = machines.findIndex(m => m.referencia === machine.referencia);
  if (mi < 0) machines.push(machine); else machines[mi] = { ...machines[mi], ...machine };
}
assert.equal(catalog.items.filter(i => i.publicCode === 'H-2018-9895').length, 1);
for (const { code } of additions) {
  assert.equal(catalog.items.filter(i => i.publicCode === code).length, 1);
  assert.equal(machines.filter(m => m.referencia === code).length, 1);
}
await writeFile(publicPath, JSON.stringify(machines, null, 1) + '\n');
await writeFile(catalogPath, JSON.stringify(catalog));
console.log(JSON.stringify({ status: 'catalogos_atualizados', preservada: 'H-2018-9895', publicadas: additions.map(({code, year, hours, price}) => ({code, year, hours, price})), totalFichas: machines.length }, null, 2));
