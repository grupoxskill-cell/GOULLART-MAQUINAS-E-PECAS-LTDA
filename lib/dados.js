// Armazenamento privado em arquivos JSON fora da pasta pública (DATA_DIR).
// Nada daqui vai para o GitHub: a pasta padrão `dados-privados/` está no .gitignore.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readdir, readFile, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = resolve(process.env.DATA_DIR || fileURLToPath(new URL("../dados-privados", import.meta.url)));
export const FOTOS_DIR = join(DATA_DIR, "fotos");

const chaveHex = process.env.DATA_ENCRYPTION_KEY;
if (chaveHex !== undefined && !/^[a-f0-9]{64}$/i.test(chaveHex)) {
  throw new Error("DATA_ENCRYPTION_KEY deve ter 64 caracteres hexadecimais.");
}
const chave = chaveHex && Buffer.from(chaveHex, "hex");
const formato = "GOULLART-DADOS-V1";

function codificar(nome, valor) {
  const json = JSON.stringify(valor, null, 1);
  if (!chave) return json;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave, iv);
  cipher.setAAD(Buffer.from(nome));
  const cifrado = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  return [formato, iv.toString("hex"), cipher.getAuthTag().toString("hex"), cifrado.toString("base64")].join(":");
}

function decodificar(nome, texto) {
  if (!texto.startsWith("GOULLART-DADOS-")) return JSON.parse(texto);
  const [versao, iv, tag, cifrado, ...extra] = texto.split(":");
  if (versao !== formato || !chave || !/^[a-f0-9]{24}$/.test(iv) ||
      !/^[a-f0-9]{32}$/.test(tag) || !cifrado || extra.length) {
    throw new Error("Formato de dados cifrados inválido ou chave indisponível.");
  }
  const decipher = createDecipheriv("aes-256-gcm", chave, Buffer.from(iv, "hex"));
  decipher.setAAD(Buffer.from(nome));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  const json = Buffer.concat([decipher.update(Buffer.from(cifrado, "base64")), decipher.final()]);
  return JSON.parse(json.toString("utf8"));
}

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
    return decodificar(nome, await readFile(arquivo, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return padrao;
    if (!(err instanceof SyntaxError)) throw err;
    try {
      const anterior = decodificar(nome, await readFile(`${arquivo}.anterior`, "utf-8"));
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

async function substituir(destino, conteudo) {
  const tmp = `${destino}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  const arq = await open(tmp, "wx", 0o600);
  try {
    try {
      await arq.writeFile(conteudo);
      await arq.sync();
    } finally {
      await arq.close();
    }
    await rename(tmp, destino);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

async function gravarAgora(nome, valor) {
  await prepararPastas();
  const destino = join(DATA_DIR, `${nome}.json`);
  const conteudo = codificar(nome, valor);
  let anterior;
  try {
    anterior = decodificar(nome, await readFile(destino, "utf-8"));
  } catch (err) {
    if (err.code !== "ENOENT" && !(err instanceof SyntaxError)) throw err;
  }
  if (anterior !== undefined) {
    await substituir(`${destino}.anterior`, codificar(nome, anterior));
  }
  await substituir(destino, conteudo);
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

// Executar com o serviço parado, usando o mesmo usuário, diretório e chave do serviço.
export async function migrarDadosPrivados() {
  if (!chave) throw new Error("Configure DATA_ENCRYPTION_KEY antes de migrar.");
  const arquivos = await readdir(DATA_DIR, { withFileTypes: true });
  let migrados = 0;
  for (const item of arquivos) {
    if (!item.isFile()) continue;
    const match = /^([a-z0-9_-]+)\.json(?:\.anterior)?$/i.exec(item.name);
    if (!match) continue;
    const arquivo = join(DATA_DIR, item.name);
    const texto = await readFile(arquivo, "utf-8");
    const valor = decodificar(match[1], texto);
    if (texto.startsWith(`${formato}:`)) continue;
    await substituir(arquivo, codificar(match[1], valor));
    migrados += 1;
  }
  return migrados;
}
