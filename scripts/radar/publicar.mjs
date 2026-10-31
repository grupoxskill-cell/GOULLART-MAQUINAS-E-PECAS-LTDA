// Publica no site uma máquina do Radar aprovada pelo Júnior ("SIM RADAR-AAMMDD-NN" no WhatsApp).
// Uso: node scripts/radar/publicar.mjs dados.json
// dados.json: { codigo, titulo, categoria, ano, horas, precoSite (número), foto (caminho local, opcional) }
// Só grava dados públicos em public/maquinas.json. Não aceita fonte, contato ou preço de origem.
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { CATEGORIAS, entradaPublica } from "../../lib/radar.js";
import { slugify } from "../../lib/paginas.js";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: node scripts/radar/publicar.mjs dados.json");
  process.exit(1);
}
const d = JSON.parse(await readFile(arquivo, "utf8"));
const proibidos = ["fonte", "contato", "telefone", "vendedor", "precoOrigem", "link", "url"].filter((k) => k in d);
if (proibidos.length) throw new Error(`Dados privados não vão para o site: ${proibidos.join(", ")}`);
if (!CATEGORIAS.includes(d.categoria)) throw new Error(`Categoria fora da lista: ${d.categoria}`);
if (!(Number(d.precoSite) > 0)) throw new Error("precoSite precisa ser um número");

const catalogo = JSON.parse(await readFile("public/maquinas.json", "utf8"));
if (catalogo.some((m) => m.referencia === d.codigo)) {
  console.log(`${d.codigo} já está no site. Nada a fazer.`);
  process.exit(0);
}
const fotos = [];
if (d.foto) {
  const destino = `maquinas/${slugify(`radar ${d.titulo} ${d.ano ?? ""} ${d.codigo}`)}-1${extname(d.foto).toLowerCase() || ".jpg"}`;
  await copyFile(d.foto, `public/${destino}`);
  fotos.push(destino);
}
catalogo.push(entradaPublica({ ...d, fotos }));
await writeFile("public/maquinas.json", JSON.stringify(catalogo, null, 1));
console.log(`${d.codigo} publicado em public/maquinas.json${fotos.length ? ` com foto ${fotos[0]}` : " sem foto"}.`);
