import { atualizar, ler } from "./dados.js";
import { negociacaoAberta } from "./encontros.js";
import { localValido } from "./radar.js";
import { FICHAS_DA_VITRINE } from "./paginas.js";

const diaBR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
export const diaLocal = (data = new Date()) => diaBR.format(data);
const diaMS = 86400000;
const norm = s => String(s ?? "").trim().toLocaleLowerCase("pt-BR");
const chavePeca = s => norm(s).replace(/[^a-z0-9]/g, "");
const referencia = s => { const ref = String(s || "").trim().toUpperCase(); return FICHAS_DA_VITRINE[ref] || ref; };
const falha = (texto, status = 400) => { throw Object.assign(new Error(texto), { status }); };
function campo(v, nome, max = 240) {
  if (typeof v !== "string" || !v.trim() || v.length > max) falha("Confira o campo " + nome + ".");
  return v.trim();
}
function dataCivil(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s + "T12:00Z")) ||
      new Date(s + "T12:00Z").toISOString().slice(0, 10) !== s) falha("Informe uma data válida.");
  return s;
}
function valor(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1e10) falha("Confira o valor em reais.");
  return Math.round(v * 100) / 100;
}
const novo = () => ({ eventos: [], ultimaConsulta: null });
export const lerOperacao = () => ler("operacao", novo());
const entregaveis = ["Máquina", "Documento", "Chave", "Manual", "Foto da entrega"];
export const FRASES = {
  preco: "Antes de falar em desconto, vamos conferir três pontos. Essa máquina atende o serviço que você vai fazer? Quer ver o horímetro e as fotos dela? Em qual cidade ela vai trabalhar, pra gente levantar o frete e comparar o custo entregue?",
  aniversario: "Já faz um ano que essa máquina chegou aí. Como ela está trabalhando? Está precisando de alguma peça ou de ajuda com manutenção?",
  duvida: "O que está pesando na decisão? Me fala o serviço que você quer fazer e onde a máquina vai trabalhar. Eu confiro a ficha com você e separo o que ainda precisa de confirmação."
};

function mesmoPedido(a, b) { return a.pedido === b.pedido; }
const podeDivulgar = d => d.autorizada===true;
export function jaVista(eventos, cliente, ref) {
  return !!cliente && !!ref && eventos.some(e => e.tipo === "vista" && e.cliente === String(cliente) && referencia(e.ref) === referencia(ref));
}
export function validarRegistro(d, crm, radar, eventos, agora = new Date()) {
  const tipo = d.tipo, base = { tipo };
  const porPedido = ["vista","objecao","venda","projecao","entrega","aniversario","audio","preco","historia"];
  if (porPedido.includes(tipo)) {
    const p = crm?.deals?.find(p => String(p.id) === String(d.pedido));
    if (!p) falha("Escolha uma negociação do CRM.");
    base.pedido = String(p.id);
    base.cliente = p.contactId == null ? "" : String(p.contactId);
    if (tipo === "venda" && !p.saleConfirmed) falha("Confirme a venda no CRM antes de registrar a entrega.");
    if (tipo === "projecao" && !negociacaoAberta(p)) falha("Selecione uma negociação em aberto.");
  }
  switch (tipo) {
    case "vista":
      if (!base.cliente) falha("Falta vincular o cliente no CRM.");
      base.ref = referencia(campo(d.ref, "referência", 80));
      if (jaVista(eventos, base.cliente, base.ref)) falha("Esse cliente já viu essa unidade.", 409);
      break;
    case "objecao":
      base.motivo = campo(d.motivo, "motivo informado pelo cliente");
      base.proxima = campo(d.proxima, "próxima ação");
      break;
    case "venda":
      base.data = dataCivil(d.data);
      if (base.data > diaLocal(agora)) falha("A venda precisa ter ocorrido.");
      base.ref = campo(d.ref, "máquina", 80);
      if (eventos.some(e => e.tipo === tipo && mesmoPedido(e, base))) falha("Venda já registrada.", 409);
      break;
    case "historia": {
      const venda=eventos.find(e=>e.tipo==="venda" && mesmoPedido(e,base));
      if(!venda || !podeDivulgar(d)) falha("Confirme autorização para divulgar o modelo e a cidade desta venda.");
      base.titulo=campo(d.titulo,"modelo público",100);
      base.destino=localValido(d.destino);
      if(!base.destino)falha("Informe cidade e UF de destino.");
      base.inicio=dataCivil(d.inicio);
      if(base.inicio>venda.data)falha("O anúncio deve ser anterior à venda.");
      base.dias=Math.round((Date.parse(venda.data)-Date.parse(base.inicio))/diaMS);
      break;
    }
    case "entrega":
      if (!eventos.some(e => e.tipo === "venda" && mesmoPedido(e, base))) falha("Registre a venda primeiro.");
      if (!Array.isArray(d.itens) || d.itens.some(i => !entregaveis.includes(i))) falha("Checklist inválido.");
      base.itens = [...new Set(d.itens)];
      if (base.itens.includes("Foto da entrega")) {
        base.foto = campo(d.foto, "evidência da entrega", 60);
        if (!/^fotos\/[a-f0-9]{24}\.jpg$/.test(base.foto)) falha("Anexe a foto da entrega.");
      }
      break;
    case "aniversario": {
      const venda = eventos.find(e => e.tipo === "venda" && mesmoPedido(e, base));
      if (!venda || aniversario(venda.data) > diaLocal(agora)) falha("O aniversário ainda não venceu.");
      if (eventos.some(e => e.tipo === tipo && mesmoPedido(e, base))) falha("Retorno já tratado.", 409);
      break;
    }
    case "projecao":
      base.valor = valor(d.valor);
      base.data = dataCivil(d.data);
      break;
    case "audio":
      base.arquivo = campo(d.arquivo, "gravação", 100);
      if (!/^voz-[a-f0-9]{32}\.(mp3|m4a|webm|ogg|wav)$/.test(base.arquivo)) falha("Gravação inválida.");
      break;
    case "preco":
      if(d.pergunta)base.pergunta=campo(d.pergunta,"pergunta recebida");
      base.texto = FRASES.preco;
      break;
    case "aprovar": case "recusar": {
      const alvo = eventos.find(e => e.id === d.alvo && ["audio","preco","frase","historia"].includes(e.tipo));
      if (!alvo || eventos.some(e => e.alvo === d.alvo)) falha("Essa aprovação não está pendente.", 409);
      base.alvo = alvo.id;
      break;
    }
    case "frase": base.texto = campo(d.texto, "frase", 700); break;
    case "erro":
      base.erro = campo(d.erro, "erro");
      base.correcao = campo(d.correcao, "correção");
      base.regra = campo(d.regra, "regra");
      break;
    case "peca":
      if (!["procura","oferta"].includes(d.lado)) falha("Informe procura ou oferta.");
      base.lado = d.lado;
      base.codigo = campo(d.codigo, "código da peça", 70);
      if (chavePeca(base.codigo).length < 3) falha("Informe o código completo.");
      base.ref = campo(d.ref, "máquina ou pedido de origem", 90);
      base.texto = campo(d.texto, "descrição da peça");
      break;
    case "avaliacao": {
      const r = radar.find(r => r.id === d.radar);
      if (!r) falha("Escolha uma máquina do Radar.");
      base.radar = r.id;
      base.estado = campo(d.estado, "estado observado", 250);
      base.vendaAnterior = d.vendaAnterior ? campo(d.vendaAnterior, "referência de venda anterior", 120) : "";
      base.vendedor = d.vendedor ? campo(d.vendedor, "identificador do vendedor", 100) : "";
      base.data = d.data ? dataCivil(d.data) : null;
      if (base.data > diaLocal(agora)) falha("Confira a data do anúncio.");
      if (!Array.isArray(d.comparaveis) || d.comparaveis.length > 8) falha("Comparáveis inválidos.");
      base.comparaveis = d.comparaveis.map(c => {
        let u;
        try { u = new URL(c.link); } catch { falha("Confira o link de cada comparável."); }
        if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) falha("Link inválido.");
        u.hash = "";
        return { link: u.href, valor: valor(c.valor) };
      });
      if (new Set(base.comparaveis.map(c => c.link)).size !== base.comparaveis.length) falha("Comparável repetido.");
      break;
    }
    default: falha("Tipo de registro inválido.");
  }
  return base;
}
export async function registrarOperacao(d, crm, radar) {
  if (!/^[a-f0-9-]{36}$/i.test(d.id || "")) falha("Identificador do registro inválido.");
  await atualizar("operacao", novo(), op => {
    if (op.eventos.some(e => e.id === d.id)) return;
    const registro = validarRegistro(d, crm, radar, op.eventos);
    op.eventos.push({ ...registro, id: d.id, em: new Date().toISOString() });
  });
}
export async function registrarConsulta(agora = new Date()) {
  await atualizar("operacao", novo(), op => {
    if (op.ultimaConsulta && agora - Date.parse(op.ultimaConsulta) >= 2 * diaMS) op.retornoDeFerias = agora.toISOString();
    op.ultimaConsulta = agora.toISOString();
  });
}
function aniversario(data) {
  const ano = Number(data.slice(0, 4)) + 1;
  const alvo = ano + data.slice(4);
  return alvo.endsWith("-02-29") ? ano + "-02-28" : alvo;
}
function leituraHoras(h) {
  const m = String(h ?? "").trim().match(/^(\d+(?:\.\d{3})*)\s*(?:h|horas?)?$/i);
  return m ? Number(m[1].replaceAll(".", "")) : null;
}
export function painelOperacao(op, crm, radar, agora = new Date()) {
  const eventos = op.eventos, hoje = diaLocal(agora);
  const ultimos = tipo => new Map(eventos.filter(e => e.tipo === tipo).map(e => [e.pedido || e.radar, e]));
  const avaliacoes = ultimos("avaliacao");
  const ano = Number(hoje.slice(0, 4));
  const ofertas = radar.map(r => {
    const a = avaliacoes.get(r.id), refs = a?.comparaveis || [];
    const valores = refs.map(c => c.valor).sort((x,y) => x-y);
    const meio = Math.floor(valores.length / 2);
    const mediana = valores.length < 3 ? null : (valores[meio] + valores[Math.floor((valores.length - 1) / 2)]) / 2;
    const desconto = r.precoOrigem > 0 && mediana ? 100 * (1 - r.precoOrigem / mediana) : null;
    const h = leituraHoras(r.horas), idade = ano - Number(r.ano);
    const alerta = h != null && /^\d{4}$/.test(r.ano) && idade >= 3 && h / idade < 250;
    const dias = a?.data ? Math.floor((Date.parse(hoje) - Date.parse(a.data)) / diaMS) : null;
    const identificador = norm(a?.vendedor || r.contato);
    const vendedor = /^[+()0-9.\s-]+$/.test(identificador) ? identificador.replace(/\D/g,"") : identificador;
    return { id: r.id, titulo: r.titulo, uf: localValido(r.local)?.slice(-2) || null, dias, alerta, estado: a?.estado,
      vendedor, status: r.status, desconto, nota: desconto == null ? null : Math.max(0, Math.min(10, Math.round(desconto / 3 * 10) / 10)),
      avaliadoEm: a?.em, avaliacao: a, cadastradoEm: Number.isFinite(Date.parse(r.criadoEm)) ? r.criadoEm : null };
  });
  const ativos = ofertas.filter(o => !["descartado","vendido"].includes(o.status));
  const pedidos = (crm?.deals || []).map(p => ({ id: String(p.id), titulo: p.title, cliente: (crm.contacts || []).find(c=>c.id === p.contactId)?.name || "Cliente sem vínculo", aberta: !!negociacaoAberta(p), confirmada: !!p.saleConfirmed }));
  const proj = ultimos("projecao");
  const previsao = pedidos.filter(p => p.aberta && proj.has(p.id)).map(p => ({ ...p, ...proj.get(p.id) }))
    .sort((a,b) => a.data.localeCompare(b.data) || a.pedido.localeCompare(b.pedido)).slice(0,5);
  const vendas = eventos.filter(e => e.tipo === "venda");
  const pendentes = eventos.filter(e => ["audio","preco","frase","historia"].includes(e.tipo) && !eventos.some(x => x.alvo === e.id));
  const pecas = eventos.filter(e => e.tipo === "peca");
  const pares = pecas.filter(e=>e.lado==="procura").flatMap(p=>pecas.filter(o=>o.lado==="oferta" && chavePeca(o.codigo)===chavePeca(p.codigo) && norm(o.ref)!==norm(p.ref)).map(o=>({codigo:p.codigo, pedido:p.ref, doadora:o.ref})));
  const semana = new Date(hoje + "T12:00Z");
  semana.setUTCDate(semana.getUTCDate() - (semana.getUTCDay()+6)%7);
  const inicioSemana = semana.toISOString().slice(0,10);
  const desde = new Date(Date.parse(hoje+"T12:00Z")-6*diaMS).toISOString().slice(0,10);
  const melhores = {};
  for (const o of ativos.filter(o=>o.uf && o.nota!=null && o.desconto>0 && o.avaliadoEm && diaLocal(new Date(o.avaliadoEm))>=desde)) {
    if (!melhores[o.uf] || melhores[o.uf].desconto < o.desconto) melhores[o.uf] = o;
  }
  return { hoje, inicioSemana, desde, pedidos, ofertas, melhores, previsao, pares, pendentes, eventos, entregaveis, frases:FRASES,
    totalPrevisto: previsao.reduce((s,e)=>s+e.valor,0), radarHoje: ofertas.filter(o=>o.cadastradoEm && diaLocal(new Date(o.cadastradoEm))===hoje).length,
    vendasHoje: vendas.filter(v=>v.data===hoje).length, radarPendente: ativos.filter(o=>o.status==="novo").length,
    ferias: !!op.ultimaConsulta && agora-Date.parse(op.ultimaConsulta)>=2*diaMS, retornoDeFerias: op.retornoDeFerias,
    aniversarios: vendas.filter(v=>aniversario(v.data)<=hoje && !eventos.some(e=>e.tipo==="aniversario" && mesmoPedido(e,v))) };
}

export function historiasPublicas(op) {
  const aprovadas=new Set(op.eventos.filter(e=>e.tipo==="aprovar").map(e=>e.alvo));
  const historias=new Map();
  for(const e of op.eventos)if(e.tipo==="historia"&&aprovadas.has(e.id))historias.set(e.pedido,{titulo:e.titulo,destino:e.destino,dias:e.dias});
  return [...historias.values()];
}
