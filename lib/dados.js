// Armazenamento privado em arquivos JSON fora da pasta pública (DATA_DIR).
// Nada daqui vai para o GitHub: a pasta padrão `dados-privados/` está no .gitignore.
import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = resolve(process.env.DATA_DIR || fileURLToPath(new URL("../dados-privados", import.meta.url)));
export const FOTOS_DIR = join(DATA_DIR, "fotos");

export async function prepararPastas() {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await mkdir(FOTOS_DIR, { recursive: true, mode: 0o700 });
  // mkdir não corrige diretórios já existentes. Negar leitura a outros usuários do host.
  await chmod(DATA_DIR, 0o700);
  await chmod(FOTOS_DIR, 0o700);
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
// As gravações de um mesmo arquivo entram em fila, uma de cada vez.
const filas = new Map();
function naFila(nome, tarefa) {
  const anterior = filas.get(nome) || Promise.resolve();
  const atual = anterior.catch(() => {}).then(tarefa);
  filas.set(nome, atual);
  atual.finally(() => { if (filas.get(nome) === atual) filas.delete(nome); }).catch(() => {});
  return atual;
}

async function gravarAgora(nome, valor) {
  await prepararPastas();
  const destino = join(DATA_DIR, `${nome}.json`);
  const tmp = `${destino}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(valor, null, 1), { mode: 0o600 });
  await rename(tmp, destino);
}

export function gravar(nome, valor) {
  return naFila(nome, () => gravarAgora(nome, valor));
}

// Lê, altera e grava sem perder mudança feita ao mesmo tempo por outro pedido.
// fn recebe o valor atual e devolve o novo (ou altera o objeto e devolve undefined).
export function atualizar(nome, padrao, fn) {
  return naFila(nome, async () => {
    const atual = await ler(nome, padrao);
    const novo = (await fn(atual)) ?? atual;
    await gravarAgora(nome, novo);
    return novo;
  });
}
