// PDF 1.4 com fontes padrão WinAnsi. Offsets e comprimentos são medidos em bytes.
function literal(valor) {
  const texto = String(valor).replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[^\x20-\x7e\xa0-\xff]/g, " ");
  return texto.replace(/[\\()]/g, "\\$&");
}
function linhas(texto, largura) {
  const palavras = String(texto).split(/\s+/);
  const resultado = [""];
  for (const palavra of palavras) {
    let linha = resultado.length - 1;
    if (resultado[linha] && resultado[linha].length + palavra.length + 1 > largura) {
      resultado.push(""); linha++;
    }
    resultado[linha] += (resultado[linha] ? " " : "") + palavra;
  }
  return resultado;
}
export function catalogoPdf(maquinas, dia) {
  const objetos = [];
  const adicionar = valor => (objetos.push(valor), objetos.length);
  const raiz = adicionar(""), paginas = adicionar("");
  const normal = adicionar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const forte = adicionar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const folhas = [];
  let operacoes = [], anotacoes = [], y = 0;
  function texto(valor, x, altura, tamanho, negrito = false) {
    operacoes.push(`BT /${negrito ? "F2" : "F1"} ${tamanho} Tf 1 0 0 1 ${x} ${altura} Tm (${literal(valor)}) Tj ET`);
  }
  function cabecalho() {
    anotacoes = [];
    operacoes = ["0.04 0.13 0.24 rg", "0 735 595 107 re f", "1 0.77 0.06 rg", "38 763 4 44 re f", "1 1 1 rg"];
    texto("GOULLART PESADOS", 55, 800, 12, true);
    texto("Catálogo de máquinas", 55, 763, 27, true);
    operacoes.push("0.04 0.13 0.24 rg");
    texto("Emitido em " + dia + "  |  Disponibilidade conforme a última conferência de cada ficha.", 38, 710, 10);
    y = 675;
  }
  function concluir() {
    texto("Equipe Goullart Agro Brasil  |  goullartmaquinaspesadas.com.br", 38, 32, 9);
    texto(String(folhas.length + 1), 535, 32, 10, true);
    const comandos = operacoes.join("\n");
    const stream = adicionar(`<< /Length ${Buffer.byteLength(comandos,"latin1")} >>\nstream\n${comandos}\nendstream`);
    folhas.push(adicionar(`<< /Type /Page /Parent ${paginas} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${normal} 0 R /F2 ${forte} 0 R >> >> /Annots [${anotacoes.map(n => n+" 0 R").join(" ")}] /Contents ${stream} 0 R >>`));
  }
  cabecalho();
  if (!maquinas.length) texto("Sem máquinas no catálogo desta emissão.", 38, y, 13);
  for (const m of maquinas) {
    const titulo = linhas(m.titulo, 59);
    const detalhes = linhas([m.ano && "Ano " + m.ano, m.horas, m.local].filter(Boolean).join("  |  "), 88);
    const valores = linhas(m.preco + "  |  " + m.situacao, 85);
    const altura = 28 + 15 * titulo.length + 13 * (detalhes.length + valores.length) + 10;
    if (y - altura < 55) { concluir(); cabecalho(); }
    texto(m.codigoVitrine, 38, y, 9, true);
    if (m.url) {
      texto("Abrir ficha e fotos", 455, y, 10, true);
      anotacoes.push(adicionar(`<< /Type /Annot /Subtype /Link /Rect [451 ${y-3} 553 ${y+11}] /Border [0 0 0] /A << /S /URI /URI (${literal(m.url)}) >> >>`));
    }
    y -= 17;
    for (const linha of titulo) { texto(linha, 38, y, 13, true); y -= 15; }
    for (const linha of detalhes) { texto(linha, 38, y, 10); y -= 13; }
    for (const linha of valores) { texto(linha, 38, y, 11, true); y -= 13; }
    operacoes.push(`0.83 G 38 ${y-3} m 555 ${y-3} l S`); y -= 21;
  }
  concluir();
  objetos[raiz-1] = `<< /Type /Catalog /Pages ${paginas} 0 R >>`;
  objetos[paginas-1] = `<< /Type /Pages /Count ${folhas.length} /Kids [${folhas.map(p=>p+" 0 R").join(" ")}] >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objetos.forEach((obj,i) => { offsets.push(pdf.length); pdf += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const inicio = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(n => String(n).padStart(10,"0")+" 00000 n \n").join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${offsets.length} /Root ${raiz} 0 R >>\nstartxref\n${inicio}\n%%EOF\n`, "latin1");
}
export const diaEmissao = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
