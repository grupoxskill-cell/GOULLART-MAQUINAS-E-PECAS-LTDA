// ADM GOULLART: Radar (preço do site = origem + margem, publicação manual), Pátio, Encontros, CRM e Configurações.
// Todo texto vindo dos dados entra via textContent (função h), nunca como HTML.
const CATEGORIAS = ["Escavadeiras", "Pás-carregadeiras", "Retroescavadeiras", "Tratores", "Motoniveladoras", "Caminhões", "Outros"];
const conteudo = document.getElementById("conteudo");
let resumo = { margem: 20000 };

function h(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f instanceof Node ? f : String(f));
  return e;
}

const reais = (n) => (Number.isFinite(n) ? `R$ ${Math.round(n).toLocaleString("pt-BR")}` : "—");
const data = (s) => (s ? new Date(String(s).length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR") : "");
const whats = (tel) => `https://wa.me/${String(tel || "").replace(/\D/g, "").replace(/^(?!55)/, "55")}`;

function aviso(msg) {
  const a = document.getElementById("aviso");
  a.textContent = msg; a.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => (a.hidden = true), 3500);
}

async function api(caminho, opcoes = {}) {
  const r = await fetch(`/adm/api${caminho}`, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opcoes,
    body: opcoes.body && typeof opcoes.body !== "string" ? JSON.stringify(opcoes.body) : opcoes.body });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && caminho !== "/entrar") { mostrarLogin(); throw new Error("Faça login."); }
  if (!r.ok) throw new Error(d.erro || "Erro ao salvar.");
  return d;
}

async function acao(botao, fn, ok) {
  botao.disabled = true;
  try { await fn(); if (ok) aviso(ok); } catch (e) { aviso(e.message); } finally { botao.disabled = false; }
}

// Reduz a foto no celular antes de enviar (lado maior 1280 px, JPEG).
async function enviarFoto(arquivo) {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = h("canvas"); c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return (await api("/fotos", { method: "POST", body: { dados: c.toDataURL("image/jpeg", 0.8) } })).foto;
}

// ---------- Login ----------
function mostrarLogin() {
  document.getElementById("app").hidden = true;
  document.getElementById("tela-login").hidden = false;
  document.getElementById("senha").focus();
}
document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const erro = document.getElementById("login-erro");
  erro.textContent = "";
  try {
    await api("/entrar", { method: "POST", body: { senha: document.getElementById("senha").value } });
    document.getElementById("senha").value = "";
    iniciar();
  } catch (err) { erro.textContent = err.message; }
});

// ---------- Abas ----------
const telas = { inicio, radar: () => telaMaquinas("radar"), patio: () => telaMaquinas("patio"), encontros, crm, config };
document.getElementById("abas").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-aba]");
  if (b) abrir(b.dataset.aba);
});
async function abrir(aba) {
  for (const b of document.querySelectorAll("#abas button")) b.toggleAttribute("aria-current", b.dataset.aba === aba);
  document.querySelectorAll("#abas button[aria-current]").forEach((b) => b.setAttribute("aria-current", "page"));
  conteudo.replaceChildren(h("p", { class: "muted" }, "Carregando…"));
  try { await telas[aba](); } catch (e) { conteudo.replaceChildren(h("p", { class: "erro" }, e.message)); }
  scrollTo(0, 0);
}

async function iniciar() {
  try { resumo = await api("/resumo"); } catch { return; }
  document.getElementById("tela-login").hidden = true;
  document.getElementById("app").hidden = false;
  abrir("inicio");
}

// ---------- Início ----------
async function inicio() {
  const [r, interesse] = await Promise.all([api("/resumo"), api("/interesse").catch(() => [])]);
  resumo = r;
  const n = (titulo, valor, aba) => h("button", { class: "numero btn sec", onclick: () => abrir(aba) }, h("b", {}, valor), titulo);
  conteudo.replaceChildren(
    resumo.encontrosRadarNovo ? h("div", { class: "alerta" },
      h("strong", {}, `${resumo.encontrosRadarNovo} pedido(s) de clientes combinam com máquinas do Radar ainda não publicadas.`),
      " ", h("button", { class: "btn", onclick: () => abrir("encontros") }, "Ver encontros")) : null,
    h("div", { class: "numeros" },
      n("Novas no Radar (aguardando você)", resumo.radarNovos, "radar"),
      n("Publicadas do Radar", resumo.radarPublicados, "radar"),
      n("Máquinas no Pátio", `${resumo.patioPublicados}/${resumo.patio}`, "patio"),
      n("Encontros com pedidos", resumo.encontros, "encontros")),
    h("div", { class: "painel" },
      h("h2", {}, "Interesse no site"),
      h("p", { class: "muted" }, "Visitas à página de cada máquina e cliques em \"Tenho interesse\" (WhatsApp). Uma mesma pessoa conta uma vez a cada 30 minutos."),
      interesse.length ? h("div", { class: "rolar" }, h("table", { class: "tabela" },
        h("thead", {}, h("tr", {}, ["Máquina", "Cliques 7 dias", "Visitas 7 dias", "Cliques total", "Visitas total"].map((c) => h("th", {}, c)))),
        h("tbody", {}, interesse.slice(0, 15).map((m) => h("tr", {}, h("td", {}, m.titulo, h("br"), h("span", { class: "muted" }, m.ref)),
          h("td", {}, h("strong", {}, m.interesses7)), h("td", {}, m.visitas7), h("td", {}, m.interesses), h("td", {}, m.visitas))))))
        : h("p", {}, "Ainda sem visitas registradas. Os números aparecem assim que clientes abrirem as máquinas no site.")),
    h("div", { class: "painel" },
      h("h2", {}, "Como funciona"),
      h("p", {}, `Radar: cadastre a máquina com o preço de origem. O sistema soma ${reais(resumo.margem)} e mostra o preço do site. Ela só aparece no site quando você toca em Publicar.`),
      h("p", {}, "Pátio: máquinas que estão com a GOULLART. Publicadas, aparecem para o cliente na seção Pátio do site."),
      h("p", {}, resumo.crmImportadoEm ? `CRM importado em ${data(resumo.crmImportadoEm)}.` : "CRM ainda não importado: vá em CRM e envie o backup JSON.")));
}

// ---------- Radar e Pátio ----------
function formulario(tipo, item, aoSalvar) {
  const radar = tipo === "radar";
  const campos = {
    titulo: h("input", { required: true, value: item?.titulo || "", placeholder: "Ex.: Escavadeira Komatsu PC200" }),
    categoria: h("select", {}, CATEGORIAS.map((c) => h("option", { value: c, selected: item?.categoria === c }, c))),
    ano: h("input", { value: item?.ano || "", inputmode: "numeric", placeholder: "2018" }),
    horas: h("input", { value: item?.horas || "", placeholder: "14.170 h" }),
    local: h("input", { value: item?.local || "", placeholder: radar ? "Cidade/UF (fica só no ADM)" : "Pátio / cidade (aparece no site)" }),
    preco: h("input", { value: (radar ? item?.precoOrigem : item?.preco) ?? "", inputmode: "numeric", placeholder: radar ? "Preço de origem, ex.: 259000" : "Preço no site, ex.: 300000" }),
    fonte: radar ? h("input", { value: item?.fonte || "", placeholder: "Link ou contato de onde veio (fica só no ADM)" }) : null,
    obs: h("textarea", { placeholder: "Observações internas" }, item?.obs || ""),
  };
  let fotos = [...(item?.fotos || [])];
  const prev = h("div", { class: "fotos-prev" });
  const desenhar = () => prev.replaceChildren(...fotos.map((f) => h("img", { src: `/${f}`, alt: "" })));
  desenhar();
  const precoSite = h("p", { class: "preco" });
  const calc = () => { const v = Number(String(campos.preco.value).replace(/\D/g, "")); precoSite.textContent = radar && v ? `Preço no site: ${reais(v + resumo.margem)} (origem + ${reais(resumo.margem)})` : ""; };
  campos.preco.addEventListener("input", calc); calc();
  const arquivo = h("input", { type: "file", accept: "image/*", multiple: true });
  arquivo.addEventListener("change", async () => {
    for (const f of arquivo.files) { try { fotos.push(await enviarFoto(f)); desenhar(); } catch (e) { aviso(e.message); } }
    arquivo.value = "";
  });
  const salvar = h("button", { class: "btn" }, item ? "Salvar alterações" : radar ? "Adicionar ao Radar" : "Adicionar ao Pátio");
  const form = h("form", { class: "painel" },
    h("h2", {}, item ? "Editar máquina" : radar ? "Nova máquina do Radar" : "Nova máquina no Pátio"),
    h("label", {}, "Máquina", campos.titulo),
    h("div", { class: "grade" }, h("label", {}, "Tipo", campos.categoria), h("label", {}, "Ano", campos.ano), h("label", {}, "Horas / km", campos.horas)),
    h("div", { class: "grade" }, h("label", {}, radar ? "Preço de origem (R$)" : "Preço no site (R$)", campos.preco), h("label", {}, "Local", campos.local)),
    precoSite, campos.fonte && h("label", {}, "Fonte", campos.fonte), h("label", {}, "Observações", campos.obs),
    h("label", {}, "Fotos", arquivo), prev, salvar);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const corpo = { titulo: campos.titulo.value, categoria: campos.categoria.value, ano: campos.ano.value, horas: campos.horas.value,
      local: campos.local.value, obs: campos.obs.value, fotos, [radar ? "precoOrigem" : "preco"]: campos.preco.value };
    if (radar) corpo.fonte = campos.fonte.value;
    acao(salvar, async () => {
      await api(item ? `/${tipo}/${item.id}` : `/${tipo}`, { method: item ? "PUT" : "POST", body: corpo });
      aoSalvar();
    }, "Salvo.");
  });
  return form;
}

async function telaMaquinas(tipo) {
  const radar = tipo === "radar";
  resumo = await api("/resumo");
  const [lista, encontrosLista] = await Promise.all([api(`/${tipo}`), resumo.crmImportadoEm ? api("/encontros") : []]);
  const pedidosPorId = new Map();
  for (const e of encontrosLista) for (const a of e.achados) if (a.maquina.id) pedidosPorId.set(a.maquina.id, [...(pedidosPorId.get(a.maquina.id) || []), e]);
  const recarregar = () => telaMaquinas(tipo);
  const filtro = h("select", {}, ["Todas", ...(radar ? ["novo", "publicado", "descartado"] : ["publicadas", "não publicadas"])].map((s) => h("option", { value: s }, s)));
  const caixa = h("div", { class: "lista" });

  function cartao(m) {
    const estado = radar ? m.status : m.publicado ? "publicado" : "novo";
    const rotulo = radar ? { novo: "Aguardando você", publicado: "No site", descartado: "Descartada" }[estado] : m.publicado ? "No site" : "Não publicada";
    const pedidos = pedidosPorId.get(m.id) || [];
    const botoes = [];
    if (radar) {
      if (m.status !== "publicado") botoes.push(h("button", { class: "btn ok", onclick: (e) => acao(e.target, async () => { await api(`/radar/${m.id}/publicar`, { method: "POST" }); recarregar(); }, "Publicado no site.") }, "Publicar"));
      else botoes.push(h("button", { class: "btn sec", onclick: (e) => acao(e.target, async () => { await api(`/radar/${m.id}/despublicar`, { method: "POST" }); recarregar(); }, "Retirada do site.") }, "Tirar do site"));
      if (m.status !== "descartado") botoes.push(h("button", { class: "btn sec", onclick: (e) => acao(e.target, async () => { await api(`/radar/${m.id}/descartar`, { method: "POST" }); recarregar(); }, "Descartada.") }, "Descartar"));
      botoes.push(h("button", { class: "btn sec", onclick: (e) => {
        const v = prompt("Preço no site (deixe vazio para usar origem + margem):", m.precoSite ?? "");
        if (v !== null) acao(e.target, async () => { await api(`/radar/${m.id}`, { method: "PUT", body: { precoSite: v } }); recarregar(); }, "Preço do site ajustado.");
      } }, "Ajustar preço"));
    } else {
      botoes.push(h("button", { class: m.publicado ? "btn sec" : "btn ok", onclick: (e) => acao(e.target, async () => { await api(`/patio/${m.id}/${m.publicado ? "despublicar" : "publicar"}`, { method: "POST" }); recarregar(); }, m.publicado ? "Retirada do site." : "Publicada no site.") }, m.publicado ? "Tirar do site" : "Publicar"));
    }
    botoes.push(h("button", { class: "btn sec", onclick: () => conteudo.replaceChildren(formulario(tipo, m, recarregar), h("button", { class: "btn sec", onclick: recarregar }, "Voltar")) }, "Editar"));
    botoes.push(h("button", { class: "btn perigo", onclick: (e) => confirm(`Excluir "${m.titulo}"?`) && acao(e.target, async () => { await api(`/${tipo}/${m.id}`, { method: "DELETE" }); recarregar(); }, "Excluída.") }, "Excluir"));
    return h("article", { class: "item" },
      m.fotos?.[0] ? h("img", { src: `/${m.fotos[0]}`, alt: "" }) : h("div", { class: "semfoto" }, "Sem foto"),
      h("div", { class: "corpo" },
        h("div", {}, h("span", { class: `selo ${estado}` }, rotulo), " ", h("span", { class: "muted" }, m.categoria)),
        h("strong", {}, m.titulo),
        h("span", { class: "muted" }, [m.ano && `Ano ${m.ano}`, m.horas, m.local].filter(Boolean).join(" · ")),
        radar ? h("span", {}, `Origem ${reais(m.precoOrigem)} → `, h("span", { class: "preco" }, `site ${reais(m.precoSiteCalculado)}`))
              : h("span", { class: "preco" }, reais(m.preco)),
        pedidos.length ? h("span", { class: "selo novo" }, `${pedidos.length} pedido(s) de clientes combinam`) : null,
        m.fonte ? h("span", { class: "muted" }, `Fonte: ${m.fonte}`) : null,
        h("div", { class: "acoes" }, botoes)));
  }
  function desenhar() {
    const f = filtro.value;
    const itens = lista.filter((m) => f === "Todas" || (radar ? m.status === f : (f === "publicadas") === Boolean(m.publicado)));
    caixa.replaceChildren(...(itens.length ? itens.map(cartao) : [h("p", { class: "muted" }, "Nenhuma máquina aqui ainda.")]));
  }
  filtro.addEventListener("change", desenhar);
  let aberto = false;
  const novo = h("button", { class: "btn" }, radar ? "+ Adicionar do Radar" : "+ Adicionar ao Pátio");
  const area = h("div");
  novo.addEventListener("click", () => { aberto = !aberto; area.replaceChildren(aberto ? formulario(tipo, null, recarregar) : ""); });
  conteudo.replaceChildren(
    h("div", { class: "painel" }, h("h2", {}, radar ? "Radar" : "Pátio"),
      h("p", { class: "muted" }, radar ? `Só você vê. Preço do site = origem + ${reais(resumo.margem)}. Nada vai para o site sem você tocar em Publicar.`
                                        : "Máquinas que estão com a GOULLART. As publicadas aparecem na seção Pátio do site, com o local informado."),
      h("div", { class: "acoes" }, novo, h("label", {}, "Mostrar", filtro))),
    area, caixa);
  desenhar();
}

// ---------- Encontros ----------
async function encontros() {
  const lista = await api("/encontros");
  if (!resumo.crmImportadoEm && !lista.length) {
    conteudo.replaceChildren(h("div", { class: "painel" }, h("h2", {}, "Encontros"), h("p", {}, "Importe o CRM primeiro (aba CRM) para cruzar os pedidos dos clientes com o Radar, o Pátio e o site.")));
    return;
  }
  conteudo.replaceChildren(
    h("div", { class: "painel" }, h("h2", {}, `Encontros (${lista.length})`),
      h("p", { class: "muted" }, "Pedidos abertos do CRM que combinam com máquinas do Radar, do Pátio ou do site. É uma sugestão: confira antes de oferecer.")),
    ...lista.map((e) => h("article", { class: "painel encontro" },
      h("div", {}, h("strong", {}, e.cliente || "Cliente sem nome"), " ",
        e.telefone ? h("a", { href: whats(e.telefone), target: "_blank", rel: "noopener" }, e.telefone) : null, " ",
        h("span", { class: "selo" }, e.etapa || ""), " ", e.prioridade ? h("span", { class: "selo" }, e.prioridade) : null),
      h("p", {}, e.pedido),
      ...e.achados.map((a) => h("div", { class: "achado" },
        h("span", { class: `selo ${a.maquina.publicado ? "publicado" : "novo"}` }, `${a.maquina.origem}${a.maquina.publicado ? " · no site" : " · não publicada"}`),
        h("strong", {}, a.maquina.titulo), h("span", { class: "preco" }, a.maquina.preco || ""),
        h("span", { class: "muted" }, a.motivos.join(", ")),
        a.maquina.origem === "Radar" && !a.maquina.publicado
          ? h("button", { class: "btn ok", onclick: (ev) => acao(ev.target, async () => { await api(`/radar/${a.maquina.id}/publicar`, { method: "POST" }); encontros(); }, "Publicado no site.") }, "Publicar")
          : null)))));
}

// ---------- CRM ----------
async function crm() {
  const dados = await api("/crm");
  const arquivo = h("input", { type: "file", accept: "application/json,.json" });
  const importar = h("div", { class: "painel" }, h("h2", {}, "CRM"),
    h("p", { class: "muted" }, dados ? `Base importada em ${data(dados.importadoEm)} (backup de ${data(dados.exportadoEm)}). Enviar outro backup substitui a base.` : "Envie o backup JSON exportado do painel do CRM (GOULLART_CRM_backup_….json)."),
    h("label", {}, "Backup do CRM", arquivo));
  arquivo.addEventListener("change", async () => {
    const f = arquivo.files[0]; if (!f) return;
    try {
      const r = await api("/crm", { method: "POST", body: await f.text() });
      aviso(`CRM importado: ${r.contatos} contatos, ${r.negociacoes} negociações.`); crm();
    } catch (e) { aviso(e.message); }
  });
  if (!dados) { conteudo.replaceChildren(importar); return; }
  const hoje = new Date().toISOString().slice(0, 10);
  const busca = h("input", { type: "search", placeholder: "Buscar cliente, pedido ou telefone" });
  const vista = h("select", {}, ["Negociações", "Retornos em aberto", "Contatos"].map((v) => h("option", {}, v)));
  const tabela = h("div", { class: "rolar" });
  const linhas = {
    "Negociações": [["Cliente", "Pedido", "Etapa", "Prioridade", "Próxima ação"], dados.negociacoes, (n) => [
      h("td", {}, n.cliente, h("br"), n.telefone ? h("a", { href: whats(n.telefone), target: "_blank", rel: "noopener" }, n.telefone) : ""),
      h("td", {}, n.pedido), h("td", {}, n.etapa), h("td", {}, n.prioridade), h("td", {}, n.proxima || n.pendencia || "")]],
    "Retornos em aberto": [["Prazo", "Cliente", "O que fazer", "Prioridade"], dados.retornos, (r) => [
      h("td", {}, r.prazo && r.prazo < hoje ? h("span", { class: "selo atrasado" }, data(r.prazo)) : data(r.prazo)),
      h("td", {}, r.cliente), h("td", {}, r.acao), h("td", {}, r.prioridade)]],
    "Contatos": [["Nome", "Telefone", "Classificação", "Cidade"], dados.contatos, (c) => [
      h("td", {}, c.nome), h("td", {}, c.telefone ? h("a", { href: whats(c.telefone), target: "_blank", rel: "noopener" }, c.telefone) : ""),
      h("td", {}, c.classificacao || ""), h("td", {}, c.cidade || "")]],
  };
  function desenhar() {
    const [cab, itens, linha] = linhas[vista.value];
    const t = busca.value.trim().toLowerCase();
    const filtrados = itens.filter((x) => !t || JSON.stringify(x).toLowerCase().includes(t));
    tabela.replaceChildren(h("p", { class: "muted" }, `${filtrados.length} registro(s)`),
      h("table", { class: "tabela" }, h("thead", {}, h("tr", {}, cab.map((c) => h("th", {}, c)))),
        h("tbody", {}, filtrados.slice(0, 300).map((x) => h("tr", {}, linha(x))))));
  }
  busca.addEventListener("input", desenhar); vista.addEventListener("change", desenhar);
  conteudo.replaceChildren(importar, h("div", { class: "painel" }, h("div", { class: "grade" }, h("label", {}, "Ver", vista), h("label", {}, "Buscar", busca)), tabela));
  desenhar();
}

// ---------- Configurações ----------
async function config() {
  resumo = await api("/resumo");
  const margem = h("input", { value: resumo.margem, inputmode: "numeric" });
  const salvarMargem = h("button", { class: "btn" }, "Salvar margem");
  salvarMargem.addEventListener("click", () => acao(salvarMargem, async () => { resumo.margem = (await api("/config", { method: "PUT", body: { margem: margem.value } })).margem; }, "Margem salva."));
  const atual = h("input", { type: "password", autocomplete: "current-password" });
  const nova = h("input", { type: "password", autocomplete: "new-password", minlength: 8 });
  const trocar = h("button", { class: "btn" }, "Trocar senha");
  trocar.addEventListener("click", () => acao(trocar, async () => { await api("/senha", { method: "POST", body: { atual: atual.value, nova: nova.value } }); atual.value = nova.value = ""; }, "Senha trocada."));
  const sair = h("button", { class: "btn perigo" }, "Sair do ADM");
  sair.addEventListener("click", async () => { await api("/sair", { method: "POST" }).catch(() => {}); mostrarLogin(); });
  conteudo.replaceChildren(
    h("div", { class: "painel" }, h("h2", {}, "Margem do Radar"),
      h("p", { class: "muted" }, "Valor somado ao preço de origem para calcular o preço do site. Vale para as próximas publicações; as já publicadas mantêm o preço."),
      h("label", {}, "Margem (R$)", margem), salvarMargem),
    h("div", { class: "painel" }, h("h2", {}, "Trocar senha"), h("label", {}, "Senha atual", atual), h("label", {}, "Nova senha (8+ caracteres)", nova), trocar),
    h("div", { class: "painel" }, sair));
}

iniciar();
