function dataCivil(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(valor + "T12:00:00Z");
  return Number.isFinite(+data) && data.toISOString().slice(0, 10) === valor;
}
export function seisMeses(dia) {
  const data = new Date(dia + "T12:00:00Z");
  const ultimoDia = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 7, 0)).getUTCDate();
  data.setUTCMonth(data.getUTCMonth() + 6, Math.min(data.getUTCDate(), ultimoDia));
  return data.toISOString().slice(0,10);
}
export function registroCompra(entrada, negocio, hoje) {
  const texto = (s, max) => typeof s === "string" ? s.trim().slice(0,max) : "";
  const maquina = texto(entrada.maquina,160), comprovante = texto(entrada.comprovante,160);
  const responsavel = texto(entrada.responsavel,100), estado = entrada.estado;
  if (!maquina || !comprovante || !responsavel || !dataCivil(entrada.dia) || entrada.dia > hoje ||
      !["Confirmada","Retorno realizado","Cancelada","Pausada"].includes(estado) ||
      (entrada.previsao && !dataCivil(entrada.previsao))) {
    throw Object.assign(new Error("Confira a máquina, a data da compra, o comprovante, o responsável e as datas informadas."), {status:400});
  }
  return { negocioId:String(negocio.id), contatoId:String(negocio.contactId), maquina, comprovante, responsavel, dia:entrada.dia,
    estado, previsao:entrada.previsao || "", revisarEm:seisMeses(entrada.dia), atualizadoEm:new Date().toISOString() };
}
