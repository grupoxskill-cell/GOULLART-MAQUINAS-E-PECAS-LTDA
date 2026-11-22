/* Funções h, api e acao são compartilhadas com o ADM. */
async function abrirOperacao() {
  const p = await api("/operacao");
  const sec = (titulo, ...filhos) => h("section", {class:"painel"}, h("h2",{},titulo), ...filhos);
  const lista = (itens, vazio) => itens.length ? h("ul",{},itens.map(i=>h("li",{},i))) : h("p",{class:"muted"},vazio);
  const nome = id => p.pedidos.find(x=>x.id===id)?.cliente || id;
  const texto = (tipo="text", props={})=>h("input",{type:tipo,required:true,...props});
  const rotulo = (nome, controle)=>h("label",{},nome,controle);
  const obs = ()=>h("textarea",{required:true,maxlength:240});
  const escolha = (itens, vazio)=>h("select",{required:true},h("option",{value:""},vazio),
    itens.map(([v,t])=>h("option",{value:v},t)));
  const pedido = (filtro=()=>true)=>escolha(p.pedidos.filter(filtro).map(x=>[x.id,x.cliente+" · "+x.titulo]),"Selecione o pedido do CRM");
  const enviar = async dados => api("/operacao",{method:"POST",body:{...dados,id:crypto.randomUUID()}});
  function form(titulo, campos, montar, botao="Registrar") {
    const b=h("button",{class:"btn",type:"submit"},botao);
    const f=h("form",{class:"op-form"},campos,b);
    f.addEventListener("submit",ev=>{
      ev.preventDefault();
      acao(b,async()=>{await enviar(await montar()); await abrirOperacao();},"Registro salvo.");
    });
    return h("details",{},h("summary",{},titulo),f);
  }
  const copiar = valor=>h("button",{class:"btn sec",onclick:e=>acao(e.currentTarget,()=>navigator.clipboard.writeText(valor),"Texto copiado.")},"Copiar");
  const pergunta=texto("text",{placeholder:"Ex.: Qual o menor preço?"}), sugestao=h("output",{});
  const pg=pedido(), ref=texto(), po=pedido(), motivo=obs(), proxima=obs(), pp=pedido(), pa=pedido();
  const pv=pedido(x=>x.confirmada), maquina=texto(), venda=texto("date",{max:p.hoje});
  const pj=pedido(x=>x.aberta), v=texto("number",{min:0.01,step:0.01}), dt=texto("date");
  const pd=pedido(x=>p.eventos.some(e=>e.pedido===x.id&&e.tipo==="venda"));
  const checks=p.entregaveis.map(label=>[label,h("input",{type:"checkbox"})]);
  const foto=texto("file",{accept:"image/*",required:false});
  function ultimaEntrega() {return p.eventos.filter(e=>e.tipo==="entrega"&&e.pedido===pd.value).at(-1);}
  pd.addEventListener("change",()=>{foto.value="";for(const [k,c] of checks)c.checked=!!ultimaEntrega()?.itens?.includes(k);});
  const vendaHistoria=pedido(x=>p.eventos.some(e=>e.pedido===x.id&&e.tipo==="venda")), modeloPublico=texto(), destino=texto(), inicio=texto("date",{max:p.hoje}), autorizada=h("input",{type:"checkbox",required:true});
  const frase=obs(), erro=obs(), correcao=obs(), regra=obs();
  const lado=escolha([["procura","Procura"],["oferta","Disponível em máquina doadora"]],"Tipo de registro"),codigo=texto(),origem=texto(),descricao=obs();
  const ra=escolha(p.ofertas.map(o=>[o.id,o.titulo]),"Escolha a máquina"),estado=obs(),vendedor=texto("text",{required:false}),vendaAnterior=texto("text",{required:false}), data=texto("date",{required:false,max:p.hoje});
  const comparaveis = Array.from({length:3},()=>[texto("url",{required:false}),texto("number",{min:1,step:0.01,required:false})]);
  ra.addEventListener("change",()=>{
    const a=p.ofertas.find(o=>o.id===ra.value)?.avaliacao;
    estado.value=a?.estado||""; vendedor.value=a?.vendedor||""; vendaAnterior.value=a?.vendaAnterior||""; data.value=a?.data||"";
    comparaveis.forEach(([u,n],i)=>{u.value=a?.comparaveis[i]?.link||"";n.value=a?.comparaveis[i]?.valor||"";});
  });
  const audi=texto("file",{accept:"audio/*"}), seccoes=[];
  seccoes.push(sec("Aprovações e retornos",
    h("p",{},p.retornoDeFerias ? "Última retomada após 48 horas sem abrir o ADM: "+new Date(p.retornoDeFerias).toLocaleString("pt-BR") : "As aprovações ficam na fila durante a ausência do Júnior. A equipe pode seguir registrando pedidos."),
    lista(p.pendentes.map(e=> h("div",{},h("strong",{},nome(e.pedido)||"Frase da equipe")," · "+({audio:"Áudio do Júnior",preco:"Resposta de preço",frase:"Nova frase",historia:"Publicar histórico de venda"}[e.tipo]),e.texto?h("p",{},e.texto):null,e.tipo==="historia"?h("p",{},e.titulo+" · "+e.destino+" · "+e.dias+" dias"):null,
      e.arquivo?h("audio",{controls:true,preload:"metadata",src:"/adm/api/operacao/voz/"+e.arquivo}):null,
      ...[["aprovar","Aprovar"],["recusar","Recusar"]].map(([tipo,t])=>h("button",{class:"btn sec",onclick:ev=>acao(ev.currentTarget,async()=>{await enviar({tipo,alvo:e.id});await abrirOperacao();})},t)))),"Nenhuma aprovação comercial pendente."),
    h("h3",{},"Aniversário da máquina"),lista(p.aniversarios.map(e=>h("div",{},nome(e.pedido)+" · "+e.ref+" · venda em "+e.data,h("p",{},p.frases.aniversario),copiar(p.frases.aniversario),
      h("button",{class:"btn sec",onclick:ev=>acao(ev.currentTarget,async()=>{await enviar({tipo:"aniversario",pedido:e.pedido});await abrirOperacao();})},"Marcar retorno tratado"))),"Nenhum aniversário em aberto.")));
  pergunta.oninput=()=>{
    const t=pergunta.value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const preco=/menor (?:preco|valor)|preco minimo|melhor (?:preco|valor)|desconto|faz por quanto/.test(t);
    pergunta.setCustomValidity(preco?"":"Informe uma pergunta sobre menor preço ou desconto.");
    sugestao.textContent=preco?p.frases.preco:"";
  };
  seccoes.push(sec("Vendas e atendimento",
    form("Registrar máquina vista",[rotulo("Negociação",pg),rotulo("Referência da unidade",ref)],()=>({tipo:"vista",pedido:pg.value,ref:ref.value})),
    form("Registrar “vou pensar”",[rotulo("Negociação",po),rotulo("Motivo nas palavras do cliente",motivo),rotulo("Próxima ação combinada",proxima)],()=>({tipo:"objecao",pedido:po.value,motivo:motivo.value,proxima:proxima.value})),
    form("Preparar resposta sobre menor preço",[rotulo("Negociação",pp),rotulo("Mensagem recebida do cliente",pergunta),sugestao],()=>({tipo:"preco",pedido:pp.value,pergunta:pergunta.value}),"Pedir aprovação"),
    form("Áudio do Júnior para cliente em dúvida",[rotulo("Negociação",pa),rotulo("Gravação original · até 30 segundos e 3 MB",audi),h("p",{class:"muted"},p.frases.duvida)],async()=>{
      const arquivo=audi.files[0];if(!arquivo || arquivo.size>3*1024*1024)throw Error("Selecione uma gravação de até 3 MB.");
      const url=URL.createObjectURL(arquivo);
      try {
        const audio=new Audio();const duracao=await new Promise((ok,erro)=>{audio.onloadedmetadata=()=>ok(audio.duration);audio.onerror=()=>erro(Error("Formato de áudio indisponível neste navegador."));audio.src=url;});
        if(!Number.isFinite(duracao)||duracao<=0||duracao>30.5)throw Error("A gravação deve ter até 30 segundos.");
      } finally {URL.revokeObjectURL(url);}
      const base64=await new Promise((ok,err)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=err;r.readAsDataURL(arquivo);});
      const arq=await api("/operacao/voz",{method:"POST",body:{base64}});
      return {tipo:"audio",pedido:pa.value,arquivo:arq.arquivo};
    },"Pedir aprovação"),
    h("h3",{},"Histórico por cliente"),lista(p.eventos.filter(e=>["vista","objecao"].includes(e.tipo)).slice().reverse().map(e=>nome(e.pedido)+" · "+(e.ref||e.motivo+" · "+e.proxima)),"Nenhuma máquina vista ou objeção registrada.")));
  seccoes.push(sec("Radar de compra",
    h("p",{},"Nota de 0 a 10. Cada 3% abaixo da mediana vale um ponto, com ao menos três anúncios de unidades distintas do mesmo modelo, ano e horas próximos."),
    form("Conferir anúncio e comparáveis",[rotulo("Máquina",ra),rotulo("Anúncio na origem desde",data),rotulo("Vendedor · identificador estável",vendedor),rotulo("Venda anterior confirmada · documento ou referência interna",vendaAnterior),rotulo("Estado físico observado e evidência do horímetro",estado),
      ...comparaveis.map(([u,n],i)=>h("fieldset",{},h("legend",{},"Comparável "+(i+1)),rotulo("Link original",u),rotulo("Preço em reais",n)))],
      ()=>({tipo:"avaliacao",radar:ra.value,data:data.value,vendedor:vendedor.value,vendaAnterior:vendaAnterior.value,estado:estado.value,comparaveis:comparaveis.filter(([u,n])=>u.value||n.value).map(([u,n])=>({link:u.value,valor:Number(n.value)}))})),
    h("h3",{},"Melhores ofertas por estado"),h("p",{class:"muted"},"Avaliações dos últimos sete dias · "+p.desde+" a "+p.hoje),mapaSemanal(p.melhores),
    h("h3",{},"Conferência de horas e anúncios antigos"),lista(p.ofertas.filter(o=>(o.alerta||o.dias>30)&&!["descartado","vendido"].includes(o.status)).map(o=>o.titulo+" · "+[o.dias>30?o.dias+" dias desde o anúncio original":"",o.alerta?"Conferir horímetro: menos de 250 h/ano em unidade com 3 anos ou mais":"",o.estado].filter(Boolean).join(" · ")),"Nenhuma unidade sinalizada."),
    h("h3",{},"Histórico de vendedores"),lista([...new Set(p.ofertas.map(o=>o.vendedor).filter(Boolean))].map(s=>s+" · "+p.ofertas.filter(o=>o.vendedor===s).map(o=>o.titulo+" ("+o.status+")"+(o.avaliacao?.vendaAnterior?" · venda anterior: "+o.avaliacao.vendaAnterior:"")).join(", ")),"Identificação do vendedor pendente."),
    form("Cadastrar pedido de peça ou máquina doadora",[rotulo("Tipo",lado),rotulo("Código da peça",codigo),rotulo("Máquina ou pedido",origem),rotulo("Descrição",descricao)],()=>({tipo:"peca",lado:lado.value,codigo:codigo.value,ref:origem.value,texto:descricao.value})),
    lista(p.pares.map(a=>a.codigo+" · pedido "+a.pedido+" · doadora "+a.doadora+" · conferir aplicação e custo"),"Nenhum cruzamento de peças com o mesmo código.")));
  seccoes.push(sec("Caixa e entrega",
    h("p",{},"Se fecharem as "+p.previsao.length+" negociações abertas com entrada prevista mais próxima: "+reais(p.totalPrevisto)+"."),
    lista(p.previsao.map(x=>x.data+" · "+x.cliente+" · "+reais(x.valor)),"Nenhuma previsão informada."),
    form("Informar entrada prevista",[rotulo("Negociação em aberto",pj),rotulo("Quanto entraria em caixa (R$)",v),rotulo("Data prevista",dt)],()=>({tipo:"projecao",pedido:pj.value,valor:Number(v.value),data:dt.value})),
    form("Registrar data de uma venda confirmada",[rotulo("Venda confirmada no CRM",pv),rotulo("Referência da máquina",maquina),rotulo("Data real da venda",venda)],()=>({tipo:"venda",pedido:pv.value,ref:maquina.value,data:venda.value})),
    form("Preparar cartão de VENDIDA",[rotulo("Venda registrada",vendaHistoria),rotulo("Marca e modelo para divulgação",modeloPublico),rotulo("Destino público · cidade/UF",destino),rotulo("Primeiro dia do anúncio",inicio),rotulo("Divulgação do modelo e destino autorizada",autorizada)],()=>({tipo:"historia",pedido:vendaHistoria.value,titulo:modeloPublico.value,destino:destino.value,inicio:inicio.value,autorizada:autorizada.checked}),"Enviar à fila de aprovação"),
    form("Atualizar checklist de entrega",[rotulo("Venda registrada",pd),...checks.map(([k,c])=>rotulo(k,c)),rotulo("Foto da entrega",foto)],async()=>{
      const arquivo=foto.files[0];const idFoto=arquivo?await enviarFoto(arquivo):ultimaEntrega()?.foto;
      return {tipo:"entrega",pedido:pd.value,itens:checks.filter(([,c])=>c.checked).map(([k])=>k),foto:idFoto};
    }),
    lista([...new Map(p.eventos.filter(e=>e.tipo==="entrega").map(e=>[e.pedido,e])).values()].map(e=>h("div",{},nome(e.pedido)+" · "+e.itens.length+"/5 · "+e.itens.join(", "),e.foto?h("a",{href:"/adm/"+e.foto,target:"_blank",rel:"noopener"},"Ver foto"):null)),"Nenhuma entrega conferida.")));
  const liberados=p.eventos.filter(e=>e.tipo!=="historia" && p.eventos.some(a=>a.tipo==="aprovar"&&a.alvo===e.id));
  seccoes.push(sec("Frases e melhoria semanal",
    form("Adicionar frase do Júnior",[rotulo("Texto original para aprovação",frase)],()=>({tipo:"frase",texto:frase.value})),
    lista(liberados.map(e=>h("div",{},e.pedido?nome(e.pedido)+" · ":"",e.texto||"Áudio aprovado",e.texto?copiar(e.texto):h("audio",{controls:true,src:"/adm/api/operacao/voz/"+e.arquivo}))),"Nenhum material aprovado."),
    form("Registrar erro, correção e nova regra",[rotulo("O que aconteceu",erro),rotulo("Como foi corrigido",correcao),rotulo("Regra para evitar repetição",regra)],()=>({tipo:"erro",erro:erro.value,correcao:correcao.value,regra:regra.value})),
    lista(p.eventos.filter(e=>e.tipo==="erro"&&new Date(e.em).toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})>=p.inicioSemana).map(e=>e.erro+" · "+e.correcao+" · "+e.regra),"Nenhum erro registrado nesta semana.")));
  conteudo.replaceChildren(h("h1",{},"Operação comercial"),...seccoes,await formularioEvidencias());
}
function mapaSemanal(melhores) {
  const linhas=[".. .. RR AP .. .. ..",".. AM PA .. MA CE RN","AC RO MT TO PI PE PB",".. .. GO DF BA AL SE",".. MS .. MG ES .. ..",".. .. PR SP RJ .. ..",".. .. SC .. .. .. ..",".. .. RS .. .. .. .."];
  return h("div",{},h("div",{class:"op-mapa","aria-label":"Mapa esquemático das ofertas por UF"},linhas.flatMap(l=>l.split(" ").map(uf=>uf===".." ? h("span") :
    h("span",{class:melhores[uf]?"op-com-oferta":"",title:melhores[uf]?.titulo||"Sem avaliação recente"},uf)))),
    h("ul",{},Object.entries(melhores).sort((a,b)=>b[1].nota-a[1].nota).map(([uf,o])=>h("li",{},uf+" · "+o.titulo+" · "+o.desconto.toFixed(1)+"% abaixo · nota "+o.nota))));
}

async function formularioEvidencias() {
  const d=await api("/operacao/evidencias");
  const selecionar=h("select",{required:true},h("option",{value:""},"Escolha a ficha pública"),d.referencias.map(([id,t])=>h("option",{value:id},id+" · "+t)));
  const verificada=h("input",{type:"checkbox"}), base=h("textarea",{maxlength:500});
  const video=h("input",{type:"file",accept:"video/mp4"}),remover=h("input",{type:"checkbox"});
  const b=h("button",{class:"btn",type:"submit"},"Aprovar atualização da ficha");
  const label=(t,e)=>h("label",{},t,e);
  const f=h("form",{class:"op-form"},label("Máquina",selecionar),label("Preço, procedência, disponibilidade e horímetro conferidos",verificada),label("Evidência interna da conferência",base),label("MP4 autorizado do horímetro · 15 s · até 8 MB",video),label("Retirar vídeo atual",remover),b);
  selecionar.onchange=()=>{const e=d.evidencias[selecionar.value];verificada.checked=e?.verificada===true;base.value=e?.base||"";video.value="";remover.checked=false;};
  f.onsubmit=ev=>{ev.preventDefault();acao(b,async()=>{
    const arq=video.files[0];let filme="";
    if(arq){if(arq.size>8*1024*1024)throw Error("O MP4 precisa ter até 8 MB.");
      filme=await new Promise((ok,err)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=err;r.readAsDataURL(arq);});}
    await api("/operacao/evidencias",{method:"POST",body:{ref:selecionar.value,verificada:verificada.checked,base:base.value,video:filme,removerVideo:remover.checked}});
    await abrirOperacao();
  },"Ficha atualizada.");};
  return h("details",{class:"painel"},h("summary",{},"Selo do Radar e vídeo do horímetro nas fichas públicas"),f);
}

function abrirProposta0006(m, interna, voltar) {
  const preco = m.precoSiteCalculado;
  const foto = (m.fotos || []).find(f => /^fotos\/[a-f0-9]{24}\.jpg$/.test(f) && f !== m.arte && !(m.fotosMarca || []).includes(f));
  if (!interna) {
    if (["descartado", "vendido"].includes(m.status) || ["Reservada","Vendida"].includes(m.situacaoComercial)) {
      aviso("Unidade retirada, reservada ou vendida. Selecione outra máquina para a proposta.");
      return;
    }
    if (!foto || !Number.isFinite(preco) || preco <= 0) {
      aviso("A via do cliente precisa de preço de venda e foto original da unidade.");
      return;
    }
  }
  const emitida = new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Sao_Paulo"}).format(new Date());
  const codigo = m.codigo || "R-" + m.id.slice(0,6).toUpperCase();
  const cidade = String(m.local || "").trim();
  const local = /^[\p{L}][\p{L} .'-]{1,64} *[\/,-] *(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/iu.test(cidade) ? cidade : "";
  const imprimir = h("button", {class:"btn", type:"button", disabled:!interna, onclick:()=>window.print()}, "Imprimir ou salvar PDF");
  const estadoFoto = h("span", {role:"status", class:"muted"}, foto ? "Carregando foto…" : "");
  const imagem = foto ? h("img", {
    src:"/adm/"+foto, alt:"Foto da unidade "+m.titulo,
    onload:()=>{imprimir.disabled=false; estadoFoto.textContent="";},
    onerror:()=>{imprimir.disabled=!interna; estadoFoto.textContent="Foto indisponível. Reabra a ficha e confira o arquivo.";}
  }) : null;
  const emissao = h("div",{class:"prop-emissao"},h("strong",{},"Modelo 0006"),h("span",{},"Emissão em "+emitida));
  const cabecalho = h("header",{class:"prop-topo"},h("img",{src:"/assets/brands/goullart-pesados-original.svg",alt:"GOULLART Pesados"}),emissao);
  const fatos = [["Referência",codigo],["Ano",m.ano],["Horas / km",m.horas],["Localização",local]].filter(([,v])=>v);
  const ficha = h("dl",{class:"prop-fatos"},fatos.map(([rotulo,valor])=>h("div",{},h("dt",{},rotulo),h("dd",{},valor))));
  const documento = h("article",{class:"proposta-impressa"},cabecalho,
    h("div",{class:"prop-corpo"},h("p",{class:"prop-tipo"},interna ? "Uso interno · análise de negociação" : "Proposta comercial"),
      h("h1",{},m.titulo),ficha,imagem ? h("figure",{},imagem) : h("p",{},"Foto pendente"),
      h("div",{class:"prop-preco"},h("span",{},"Valor da máquina"),h("strong",{},reais(preco)))));
  const corpo = documento.querySelector(".prop-corpo");
  if (interna) {
    const diferenca = Number.isFinite(preco) && Number.isFinite(m.precoOrigem) ? preco-m.precoOrigem : null;
    corpo.append(h("h2",{},"Conta da operação"),h("dl",{class:"prop-conta"},
      h("div",{},h("dt",{},"Preço de origem"),h("dd",{},reais(m.precoOrigem))),
      h("div",{},h("dt",{},"Diferença antes dos custos"),h("dd",{},reais(diferenca))),
      h("div",{},h("dt",{},"Percentual sobre a venda"),h("dd",{},diferenca!=null && preco>0 ? (diferenca*100/preco).toFixed(1).replace(".",",")+"%" : "Pendente"))),
      h("h2",{},"Conferência da equipe"),h("p",{},[...(m.avisos||[]),m.obs].filter(Boolean).join(" · ") || "Conferir documentação, disponibilidade, frete e custos da operação."));
  } else {
    corpo.append(h("h2",{},"Próximo passo"),h("p",{},"Informe a cidade de entrega para a equipe confirmar a disponibilidade e cotar o frete."),
      h("p",{class:"prop-condicoes"},"Condições de pagamento e eventual troca serão definidas na negociação."));
  }
  documento.append(h("footer",{class:"prop-rodape"},h("strong",{},"Equipe Goullart Agro Brasil"),h("a",{href:"https://wa.me/5562999427276"},"WhatsApp (62) 99942-7276")));
  conteudo.replaceChildren(documento,h("div",{class:"op-acoes"},estadoFoto,imprimir,
    h("button",{class:"btn sec",type:"button",onclick:voltar},"Voltar ao Radar")));
}
