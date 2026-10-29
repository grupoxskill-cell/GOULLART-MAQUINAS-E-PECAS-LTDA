// Armazenamento privado em arquivos JSON fora da pasta pública (DATA_DIR).
// Nada daqui vai para o GitHub: a pasta padrão `dados-privados/` está no .gitignore.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = resolve(process.env.DATA_DIR || fileURLToPath(new URL("../dados-privados", import.meta.url)));
export const FOTOS_DIR = join(DATA_DIR, "fotos");

export async function prepararPastas() {
  await mkdir(FOTOS_DIR, { recursive: true, mode: 0o700 });
}

export async function ler(nome, padrao) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, `${nome}.json`), "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return padrao;
    throw err;
  }
}

// Grava em arquivo temporário e renomeia, para nunca deixar um JSON pela metade.
export async function gravar(nome, valor) {
  await prepararPastas();
  const destino = join(DATA_DIR, `${nome}.json`);
  const tmp = `${destino}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(valor, null, 1), { mode: 0o600 });
  await rename(tmp, destino);
}
