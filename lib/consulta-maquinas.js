import { FICHAS_DA_VITRINE, SITE } from "./paginas.js";

export const situacoes = ["A confirmar", "Disponível", "Reservada", "Vendida"];
export const chaveFicha = codigo => FICHAS_DA_VITRINE[codigo] || codigo;

// As fichas do ADM têm um código de vitrine e outro na página própria.
export function chaveItem(item) {
  return /^[RP]-[A-F\d]{6}$/.test(item.id) ? item.id : chaveFicha(item.publicCode || item.id);
}

export function consultaPublica(maquinas, catalogo, fichas, registros = {}) {
  const porCodigo = new Map(fichas.map(m => [chaveFicha(m.referencia), m]));
  const porItem = new Map(catalogo.items.map(i => [i.id, i]));
  const resultado = new Map();
  for (const maquina of maquinas) {
    const item = porItem.get(maquina.id);
    const ref = item ? chaveItem(item) : chaveFicha(maquina.referencia);
    if (resultado.has(ref)) continue;
    const ficha = porCodigo.get(ref);
    const medicao = item?.km ? item.km + " km" : item?.hours ? String(item.hours).replace(/\s*h$/i, "") + " h" : "";
    const registro = registros[ref];
    resultado.set(ref, {
      referencia: ref, codigoVitrine: item?.publicCode || ref, titulo: maquina.titulo,
      url: ficha?.slug ? SITE + "/maquina/" + encodeURIComponent(ficha.slug) + ".html" : SITE + "/?area=maquinas&item=" + encodeURIComponent(item?.id || maquina.id || ref),
      ano: maquina.ano || ficha?.ano || "", horas: medicao || maquina.horas || ficha?.horas || "",
      local: maquina.local || ficha?.local || "", preco: maquina.preco || "Sob consulta",
      situacao: situacoes.includes(registro?.situacao) ? registro.situacao : "A confirmar",
      conferidaEm: registro?.conferidaEm || null,
    });
  }
  return [...resultado.values()].sort((a,b) => a.titulo.localeCompare(b.titulo,"pt-BR") || a.referencia.localeCompare(b.referencia));
}
