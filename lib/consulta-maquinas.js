import { FICHAS_DA_VITRINE, SITE } from "./paginas.js";

export const situacoes = ["A confirmar", "Disponível", "Reservada", "Vendida"];
export const chaveFicha = codigo => FICHAS_DA_VITRINE[codigo] || codigo;

// Preservar registros salvos antes de vincular a vitrine a uma ficha histórica.
const historicas = { "GOUL-405": "GOUL-281", "GOUL-334": "GOUL-316", "GOUL-294": "GOUL-348" };
export function registroDaFicha(registros, codigo) {
  const chave = chaveFicha(codigo);
  return registros[chave] || registros[historicas[chave]];
}
export function camposComerciais(maquina, registro) {
  const situacao = registro?.situacao || maquina.situacao ||
    situacoes.find(s => s.toLowerCase() === maquina.status) || "A confirmar";
  return {
    ...maquina,
    situacao,
    status: situacao === "A confirmar" ? null : situacao.toLowerCase(),
    confirmado_em: registro ? (registro.confirmado_em || null) : (maquina.confirmado_em || null),
    video: registro?.video ?? maquina.video ?? null,
  };
}

export const ofertaConfirmada = maquina => maquina.status === "disponível" &&
  Number.isFinite(Date.parse(maquina.confirmado_em));

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
    const registro = registroDaFicha(registros, ref);
    const comercial = camposComerciais(ficha || item || maquina, registro);
    resultado.set(ref, {
      referencia: ref, codigoVitrine: item?.publicCode || ref, titulo: maquina.titulo,
      url: ficha?.slug ? SITE + "/maquina/" + encodeURIComponent(ficha.slug) + ".html" : SITE + "/?area=maquinas&item=" + encodeURIComponent(item?.id || maquina.id || ref),
      ano: maquina.ano || ficha?.ano || "", horas: medicao || maquina.horas || ficha?.horas || "",
      local: maquina.local || ficha?.local || "", preco: maquina.preco || "Sob consulta",
      situacao: comercial.situacao, status: comercial.status, confirmado_em: comercial.confirmado_em,
      conferidaEm: registro?.conferidaEm || null, video: comercial.video,
    });
  }
  return [...resultado.values()].sort((a,b) => a.titulo.localeCompare(b.titulo,"pt-BR") || a.referencia.localeCompare(b.referencia));
}
