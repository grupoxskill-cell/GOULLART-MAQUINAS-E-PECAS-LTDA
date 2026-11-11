import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
export async function indexar(dir) {
  const nomes = await readdir(dir);
  const registros = [];
  for (const nome of nomes.filter(n => /^RADAR-[A-Za-z0-9-]+\.json$/.test(n)).sort()) {
    const d = JSON.parse(await readFile(join(dir, nome), "utf8"));
    const arte = nome.replace(/\.json$/, ".png");
    if (!(await stat(join(dir, arte))).size) throw new Error("Arte vazia: " + arte);
    const fotos = nomes.filter(n => n.startsWith(d.codigo + "-foto") && /\.(jpg|jpeg|png|webp)$/.test(n));
    if (!fotos.length) throw new Error("Sem fotografia: " + d.codigo);
    registros.push({ ...d, arte, fotos });
  }
  await writeFile(join(dir, "index.json"), JSON.stringify({ oportunidades: registros }, null, 2));
  return registros;
}
if (process.argv[1]?.endsWith("indexar.mjs")) await indexar(process.argv[2]);
