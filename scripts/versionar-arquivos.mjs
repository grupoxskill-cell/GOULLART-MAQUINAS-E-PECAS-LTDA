// Troca o ?v=... de cada CSS/JS do site pelo resumo (hash) do conteúdo do arquivo.
// Quando um arquivo muda, o endereço muda junto: a Cloudflare e o navegador buscam a versão nova na hora,
// em vez de mostrar a cópia antiga guardada por até 12 horas. Arquivo igual mantém o mesmo endereço.
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

const ATRIBUTO = /\b(href|src)=(["'])((?!https?:|\/\/|data:|#)[^"'?#<>\s]+\.(?:css|js|mjs))(?:\?[^"'#<>\s]*)?\2/gi;
const IMPORTACAO = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"'?]+\.(?:js|mjs))(?:\?[^"']*)?\2/g;

export async function versionarArquivos(raiz) {
  const cache = new Map();
  const resumo = async (caminho) => {
    if (!cache.has(caminho)) {
      cache.set(caminho, readFile(caminho).then((b) => createHash("sha256").update(b).digest("hex").slice(0, 10), () => null));
    }
    return cache.get(caminho);
  };
  // Endereço com "/" vale a partir da raiz do site; sem "/", a partir da página (ou da raiz, se ela usa <base href="/">).
  const localizar = (endereco, pasta, comBase) => {
    const alvo = endereco.startsWith("/") || comBase ? join(raiz, endereco) : join(pasta, endereco);
    const caminho = normalize(alvo);
    return caminho.startsWith(normalize(raiz)) ? caminho : null;
  };
  const trocar = async (texto, regex, montar, pasta, comBase) => {
    const partes = [];
    let ultimo = 0;
    for (const m of texto.matchAll(regex)) {
      const caminho = localizar(m[3], pasta, comBase);
      const h = caminho && (await resumo(caminho));
      partes.push(texto.slice(ultimo, m.index), h ? montar(m, h) : m[0]);
      ultimo = m.index + m[0].length;
    }
    return partes.join("") + texto.slice(ultimo);
  };

  let alterados = 0;
  const arquivos = (await readdir(raiz, { recursive: true })).filter((n) => /\.(?:html|js|mjs)$/.test(n));
  // JS primeiro: o resumo de um módulo já inclui o endereço versionado dos módulos que ele importa.
  arquivos.sort((a, b) => Number(a.endsWith(".html")) - Number(b.endsWith(".html")));
  for (const rel of arquivos) {
    const arquivo = join(raiz, rel), pasta = dirname(arquivo);
    const original = await readFile(arquivo, "utf8");
    const texto = rel.endsWith(".html")
      ? await trocar(original, ATRIBUTO, (m, h) => `${m[1]}=${m[2]}${m[3]}?v=${h}${m[2]}`, pasta, /<base\s+href=["']\/["']/i.test(original))
      : await trocar(original, IMPORTACAO, (m, h) => `${m[1]}${m[2]}${m[3]}?v=${h}${m[2]}`, pasta, false);
    if (texto !== original) {
      await writeFile(arquivo, texto);
      cache.delete(arquivo);
      alterados++;
    }
  }
  return alterados;
}
