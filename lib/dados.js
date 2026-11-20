// Armazenamento privado em arquivos JSON fora da pasta pública (DATA_DIR).
// Nada daqui vai para o GitHub: a pasta padrão `dados-privados/` está no .gitignore.
import { randomBytes } from "node:crypto";
import { chmod, copyFile, mkdir, open, readFile, rename } from "node:fs/promises";
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

// Se o arquivo estiver corrompido (queda de energia, edição à mão), usa a cópia da gravação anterior
// em vez de travar o ADM e o site inteiro com erro 500. O problema fica registrado no log do serviço.
export async function ler(nome, padrao) {
  const arquivo = join(DATA_DIR, `${nome}.json`);
  try {
    return JSON.parse(await readFile(arquivo, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return padrao;
    if (!(err instanceof SyntaxError)) throw err;
    try {
      const anterior = JSON.parse(await readFile(`${arquivo}.anterior`, "utf-8"));
      console.error(`dados: ${nome}.json corrompido; usando a cópia anterior (${nome}.json.anterior).`);
      return anterior;
    } catch {
      throw err;
    }
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
  // fsync antes de renomear: numa queda da máquina o arquivo novo nunca fica vazio pela metade.
  const arq = await open(tmp, "w", 0o600);
  try { await arq.writeFile(JSON.stringify(valor, null, 1)); await arq.sync(); }
  finally { await arq.close(); }
  // Guarda a versão anterior (válida) para o ler() ter de onde voltar se o arquivo principal estragar.
  try {
    JSON.parse(await readFile(destino, "utf-8"));
    await copyFile(destino, `${destino}.anterior`);
    await chmod(`${destino}.anterior`, 0o600);
  } catch { /* sem versão anterior válida: mantém a cópia que já existe */ }
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
