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
const telas = { inicio, publicacoes, radares, radar: () => telaMaquinas("radar"), patio: () => telaMaquinas("patio"), encontros, crm, config };
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
  abrir(location.hash === "#radar" ? "radar" : "inicio");
}
// Link do aviso de nova oferta (/adm/#radar) também funciona com o ADM já aberto.
addEventListener("hashchange", () => { if (location.hash === "#radar" && !document.getElementById("app").hidden) abrir("radar"); });

// ---------- Início ----------
async function inicio() {
  const [r, interesse] = await Promise.all([api("/resumo"), api("/interesse").catch(() => [])]);
  resumo = r;
  const n = (titulo, valor, aba) => h("button", { class: "numero btn sec", onclick: () => abrir(aba) }, h("b", {}, valor), titulo);
  conteudo.replaceChildren(
    resumo.encontrosRadarNovo ? h("div", { class: "alerta" },
      h("strong", {}, `${resumo.encontrosRadarNovo} pedido(s) de clientes combinam com máquinas do Radar ainda não publicadas.`),
      " ", h("button", { class: "btn", onclick: () => abrir("encontros") }, "Ver encontros")) : "",
    resumo.envelhecidas?.length ? h("div", { class: "alerta" },
      h("strong", {}, `${resumo.envelhecidas.length} máquina(s) há mais de 30 dias no site sem vender.`),
      h("p", { class: "muted" }, "Vale decidir: baixar o preço, trocar a foto ou tirar do site."),
      h("ul", {}, resumo.envelhecidas.slice(0, 12).map((m) => h("li", {}, h("b", {}, m.codigo), ` ${m.titulo} — ${m.dias} dias (desde ${m.publicadoEm.split("-").reverse().join("/")})`)))) : "",
    h("div", { class: "painel" },
      h("h2", {}, "Últimos acessos ao ADM"),
      h("p", { class: "muted" }, "Só você deveria aparecer aqui. Entrada de um endereço estranho: troque a senha em Config. (um login de IP novo também gera aviso pela automação configurada)."),
      resumo.acessos?.length ? h("ul", {}, resumo.acessos.map((a) => h("li", {}, `${new Date(a.em).toLocaleString("pt-BR")} — ${({ login: "entrou", login_falhou: "senha errada", sair: "saiu", senha_trocada: "trocou a senha", token_gerado: "gerou token do Radar" })[a.tipo] || a.tipo}${a.ip ? ` — IP ${a.ip}` : ""}`)))
        : h("p", {}, "Nenhum acesso registrado ainda.")),
    h("div", { class: "numeros" },
      n("Publicações no site", resumo.publicacoesImportadasEm ? resumo.publicacoesNoSite : "—", "publicacoes"),
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
    textoSite: h("textarea", { placeholder: "Ex.: Revisada, material rodante 70%, ar-condicionado, pronta para trabalhar." }, item?.textoSite || ""),
  };
  let fotos = [...(item?.fotos || [])];
  const prev = h("div", { class: "fotos-prev" });
  const desenhar = () => prev.replaceChildren(...fotos.map((f) => h("img", { src: `/adm/${f}`, alt: "" })));
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
    precoSite, h("label", {}, "Texto para o cliente (aparece no site)", campos.textoSite),
    campos.fonte && h("label", {}, "Fonte (só no ADM)", campos.fonte), h("label", {}, "Observações internas (só no ADM)", campos.obs),
    h("label", {}, "Fotos", arquivo), prev, salvar);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const corpo = { titulo: campos.titulo.value, categoria: campos.categoria.value, ano: campos.ano.value, horas: campos.horas.value,
      local: campos.local.value, obs: campos.obs.value, textoSite: campos.textoSite.value, fotos, [radar ? "precoOrigem" : "preco"]: campos.preco.value };
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
    if (m.fotos?.length) botoes.push(h("button", { class: "btn sec", onclick: () => telaArte(tipo, m, recarregar) }, m.arte ? "Refazer arte" : "Fazer arte"));
    botoes.push(h("button", { class: "btn sec", onclick: () => conteudo.replaceChildren(formulario(tipo, m, recarregar), h("button", { class: "btn sec", onclick: recarregar }, "Voltar")) }, "Editar"));
    botoes.push(h("button", { class: "btn perigo", onclick: (e) => confirm(`Excluir "${m.titulo}"?`) && acao(e.target, async () => { await api(`/${tipo}/${m.id}`, { method: "DELETE" }); recarregar(); }, "Excluída.") }, "Excluir"));
    return h("article", { class: "item" },
      m.arte || m.fotos?.[0] ? h("img", { src: `/adm/${m.arte || m.fotos[0]}`, alt: "" }) : h("div", { class: "semfoto" }, "Sem foto"),
      h("div", { class: "corpo" },
        h("div", {}, h("span", { class: `selo ${estado}` }, rotulo), " ", h("span", { class: "muted" }, m.categoria)),
        h("strong", {}, m.titulo),
        h("span", { class: "muted" }, [m.ano && `Ano ${m.ano}`, m.horas, m.local].filter(Boolean).join(" · ")),
        radar ? h("span", {}, `Origem ${reais(m.precoOrigem)} → `, h("span", { class: "preco" }, `site ${reais(m.precoSiteCalculado)}`))
              : h("span", { class: "preco" }, reais(m.preco)),
        pedidos.length ? h("span", { class: "selo novo" }, `${pedidos.length} pedido(s) de clientes combinam`) : null,
        radar ? fichaInterna(m, recarregar) : null,
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
  const colar = radar ? h("button", { class: "btn sec" }, "Colar do ChatGPT") : null;
  const area = h("div");
  colar?.addEventListener("click", () => { aberto = false; area.replaceChildren(painelColar(recarregar)); });
  novo.addEventListener("click", () => { aberto = !aberto; area.replaceChildren(aberto ? formulario(tipo, null, recarregar) : ""); });
  conteudo.replaceChildren(
    h("div", { class: "painel" }, h("h2", {}, radar ? "Radar" : "Pátio"),
      h("p", { class: "muted" }, radar ? `Só você vê. Preço do site = origem + ${reais(resumo.margem)}. Nada vai para o site sem você tocar em Publicar.`
                                        : "Máquinas que estão com a GOULLART. As publicadas aparecem na seção Pátio do site, com o local informado."),
      h("div", { class: "acoes" }, novo, colar, h("label", {}, "Mostrar", filtro))),
    area, caixa);
  desenhar();
}

// ---------- Arte da máquina (site, WhatsApp e Instagram) ----------
// Desenha no navegador uma arte 1080x1350 com a foto, a marca GOULLART e só o que o cliente precisa.
// Refazer a imagem no canvas também apaga os dados escondidos da foto original (EXIF, GPS, aparelho).
function carregarImagem(src) {
  return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Não consegui abrir a imagem.")); i.src = src; });
}
function quebrarTexto(ctx, texto, largura, maxLinhas) {
  const palavras = String(texto).split(/\s+/); const linhas = []; let atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > largura && atual) { linhas.push(atual); atual = p; } else atual = teste;
  }
  if (atual) linhas.push(atual);
  if (linhas.length > maxLinhas) { linhas.length = maxLinhas; linhas[maxLinhas - 1] = linhas[maxLinhas - 1].replace(/\s*\S*$/, "…"); }
  return linhas;
}
// Arte no padrão aprovado por Júnior (docs/RADAR-REGRAS.md): fundo branco, curvas azul/amarelo nos cantos,
// MARCA em azul, MODELO em amarelo, foto, dados, caixa "PREÇO GOULLART" e faixa do WhatsApp.
const MARCAS_ARTE = ["Caterpillar", "CAT", "Komatsu", "Volvo", "Hyundai", "John Deere", "Case", "JCB", "Doosan", "Develon", "LiuGong",
  "XCMG", "Sany", "New Holland", "Scania", "Mercedes-Benz", "Volkswagen", "VW", "Ford", "Valtra", "Randon", "Bobcat", "Link-Belt", "Fiat"];
function separarTitulo(m) {
  const t = String(m.titulo || "").replace(/\s+/g, " ").trim();
  let achado = null;
  for (const marca of MARCAS_ARTE) {
    const r = new RegExp(`(^|\\s)(${marca.replace(/[-]/g, "\\-")})(?=\\s|$)`, "i").exec(t);
    if (r && (!achado || r.index < achado.index)) achado = { index: r.index + r[1].length, texto: r[2] };
  }
  if (!achado) { const p = t.split(" "); return { tipo: m.categoria || "", marca: p.slice(0, -1).join(" ") || t, modelo: p.length > 1 ? p.at(-1) : "" }; }
  return { tipo: t.slice(0, achado.index).trim() || m.categoria || "", marca: achado.texto, modelo: t.slice(achado.index + achado.texto.length).trim() };
}
let fontesArte;
function carregarFontesArte() {
  fontesArte ||= Promise.all([["Black", 900], ["ExtraBold", 800], ["SemiBold", 600]].map(async ([nome, peso]) => {
    const f = new FontFace("ArteGoullart", `url(/adm/fontes/InterDisplay-${nome}.otf)`, { weight: String(peso) });
    document.fonts.add(await f.load());
  })).catch(() => {});
  return fontesArte;
}
function caixa(ctx, x, y, w, h, r, cor) { ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function caberTexto(ctx, txt, peso, tamanho, largura) {
  let px = tamanho;
  do { ctx.font = `${peso} ${px}px ArteGoullart, Inter, Arial, sans-serif`; px -= 4; } while (ctx.measureText(txt).width > largura && px > 20);
}
async function desenharArte(m, preco, fotoIdx, enquadre, formato = "feed") {
  await carregarFontesArte();
  const story = formato === "story";
  const W = 1080, H = story ? 1920 : 1350, k = story ? 1 : 0.72, M = story ? 80 : 72;
  const c = h("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  // Curvas dos cantos (mesmo desenho da arte aprovada).
  const curvas = (escala) => {
    ctx.save(); ctx.scale(escala, escala);
    ctx.fillStyle = "#061e42"; ctx.fill(new Path2D("M0 0H330C190 40 70 150 0 330Z"));
    ctx.fillStyle = "#f5b301"; ctx.fill(new Path2D("M0 372C66 190 200 70 380 0H404C222 74 92 196 22 380L0 430Z"));
    ctx.restore();
  };
  curvas(1);
  ctx.save(); ctx.translate(W, H); ctx.rotate(Math.PI); curvas(340 / 520); ctx.restore();
  const centro = (txt, y) => { ctx.textAlign = "center"; ctx.fillText(txt, W / 2, y); };
  let y = story ? 110 : 64;
  try {
    const logo = await carregarImagem("/adm/logo.png");
    const lw = story ? 380 : 260, lh = lw * logo.height / logo.width;
    ctx.save(); ctx.shadowColor = "rgba(6,30,66,.25)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.beginPath(); ctx.roundRect((W - lw) / 2, y, lw, lh, 18); ctx.clip(); ctx.drawImage(logo, (W - lw) / 2, y, lw, lh); ctx.restore();
    y += lh;
  } catch {}
  const { tipo, marca, modelo } = separarTitulo(m);
  // Selo
  y += 38 * k + 10;
  ctx.font = `800 ${Math.round(28 * k + 4)}px ArteGoullart, Inter, Arial, sans-serif`;
  const selo = "OFERTA GOULLART", sw = ctx.measureText(selo).width + 70 * k + 20, sh = 64 * k + 8;
  caixa(ctx, (W - sw) / 2, y, sw, sh, sh / 2, "#f5b301");
  ctx.fillStyle = "#061e42"; ctx.textBaseline = "middle"; centro(selo, y + sh / 2 + 2); ctx.textBaseline = "alphabetic";
  y += sh;
  // Marca / modelo / tipo
  ctx.fillStyle = "#061e42"; caberTexto(ctx, marca.toUpperCase(), 900, Math.round(140 * k), W - 2 * M);
  y += 140 * k + 10; centro(marca.toUpperCase(), y);
  if (modelo) { ctx.fillStyle = "#f5b301"; caberTexto(ctx, modelo.toUpperCase(), 900, Math.round(170 * k), W - 2 * M); y += 150 * k; centro(modelo.toUpperCase(), y); }
  if (tipo) { ctx.fillStyle = "#5b6675"; caberTexto(ctx, tipo.toUpperCase(), 600, Math.round(34 * k + 4), W - 2 * M); y += 56 * k + 6; centro(tipo.toUpperCase(), y); }
  // Rodapé de baixo para cima: aviso, faixa WhatsApp, preço, dados.
  let b = H - (story ? 96 : 56);
  ctx.fillStyle = "#5b6675"; ctx.font = `600 ${Math.round(21 * k + 3)}px ArteGoullart, Inter, Arial, sans-serif`;
  centro("Disponibilidade e condições a confirmar • goullartmaquinaspesadas.com.br", b);
  const ch = story ? 104 : 76; b -= 24 * k + 18 + ch;
  caixa(ctx, M, b, W - 2 * M, ch, 20, "#f5b301");
  ctx.fillStyle = "#061e42"; ctx.font = `800 ${Math.round(38 * k + 2)}px ArteGoullart, Inter, Arial, sans-serif`;
  ctx.textBaseline = "middle"; centro("Fale com a GOULLART • (62) 99942-7276", b + ch / 2 + 2); ctx.textBaseline = "alphabetic";
  const ph = story ? 210 : 150; b -= 20 + ph;
  caixa(ctx, M, b, W - 2 * M, ph, 24, "#061e42");
  ctx.fillStyle = "#c9d4e3"; ctx.font = `800 ${Math.round(26 * k + 2)}px ArteGoullart, Inter, Arial, sans-serif`; centro("PREÇO GOULLART", b + ph * 0.3);
  ctx.fillStyle = "#f5b301"; caberTexto(ctx, Number.isFinite(preco) ? `R$ ${Math.round(preco).toLocaleString("pt-BR")}` : "SOB CONSULTA", 900, Math.round(110 * k), W - 2 * M - 40);
  centro(Number.isFinite(preco) ? `R$ ${Math.round(preco).toLocaleString("pt-BR")}` : "SOB CONSULTA", b + ph * 0.82);
  const specs = [["ANO", m.ano], ["HORAS", m.horas]].filter(([, v]) => v);
  const sh2 = story ? 110 : 80;
  if (specs.length) {
    b -= 40 * k + sh2;
    const cw = (W - 2 * M) / specs.length;
    specs.forEach(([rot, val], i) => {
      const cx = M + cw * i + cw / 2;
      if (i) { ctx.fillStyle = "#dfe4ea"; ctx.fillRect(M + cw * i - 1, b, 3, sh2); }
      ctx.textAlign = "center";
      ctx.fillStyle = "#5b6675"; ctx.font = `700 ${Math.round(24 * k + 2)}px ArteGoullart, Inter, Arial, sans-serif`; ctx.fillText(rot, cx, b + sh2 * 0.32);
      ctx.fillStyle = "#061e42"; caberTexto(ctx, String(val), 800, Math.round(54 * k), cw - 30); ctx.fillText(String(val), cx, b + sh2 * 0.9);
    });
  }
  // Foto no espaço que sobrou, com cantos arredondados e sombra.
  const topo = y + 40 * k, base = b - 40 * k, fh = base - topo;
  ctx.save(); ctx.shadowColor = "rgba(6,30,66,.22)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  caixa(ctx, M, topo, W - 2 * M, fh, 28, "#e9edf2"); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(M, topo, W - 2 * M, fh, 28); ctx.clip();
  if (fotoIdx >= 0 && m.fotos?.[fotoIdx]) {
    const foto = await carregarImagem(`/adm/${m.fotos[fotoIdx]}`);
    const fw = W - 2 * M, escala = Math.max(fw / foto.width, fh / foto.height);
    const dw = foto.width * escala, dh = foto.height * escala;
    ctx.drawImage(foto, M + (fw - dw) / 2, topo + (fh - dh) * enquadre, dw, dh);
  } else {
    ctx.fillStyle = "#061e42"; ctx.font = `800 ${Math.round(46 * k)}px ArteGoullart, Inter, Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.fillText("Fotos e vídeo pelo WhatsApp", W / 2, topo + fh / 2);
  }
  ctx.restore();
  return c;
}

// "Colar do ChatGPT": o ChatGPT responde com o JSON da oferta (docs/CHATGPT-RADAR.md) e Júnior cola aqui.
// Aceita uma oferta, uma lista ou {ofertas: [...]}, mesmo dentro de ```json ... ``` ou com texto em volta.
function lerOfertasColadas(texto) {
  const t = String(texto).replace(/```(?:json)?/gi, "").trim();
  const ini = t.search(/[[{]/);
  const fim = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (ini < 0 || fim < ini) throw new Error("Não encontrei os dados da máquina. Cole a resposta do ChatGPT inteira.");
  try { return JSON.parse(t.slice(ini, fim + 1)); }
  catch { throw new Error("O texto colado está incompleto. Peça ao ChatGPT: \"responda só com o JSON\" e cole de novo."); }
}
function painelColar(recarregar) {
  const caixaTexto = h("textarea", { rows: 10, placeholder: "Cole aqui a resposta do ChatGPT com os dados da máquina (JSON)." });
  const enviar = h("button", { class: "btn" }, "Enviar para o Radar");
  const saida = h("div", { class: "lista" });
  enviar.addEventListener("click", () => acao(enviar, async () => {
    const { resultados } = await api("/radar/importar", { method: "POST", body: lerOfertasColadas(caixaTexto.value) });
    saida.replaceChildren(...resultados.map((r) => h("p", { class: r.erro ? "erro" : "" },
      r.erro ? `✗ ${r.titulo}: ${r.erro}` : `${r.novo ? "✓ Entrou" : "• Já estava no Radar"}: ${r.titulo}` +
        (r.classificacao ? ` — ${r.classificacao}${r.descontoPct != null ? `, ${r.descontoPct}% abaixo` : ""}` : "") +
        (r.avisos?.length ? ` (${r.avisos.join(" ")})` : ""))));
    if (resultados.some((r) => r.novo)) setTimeout(recarregar, 2500);
  }, "Ofertas enviadas para o Radar."));
  return h("div", { class: "painel" }, h("h2", {}, "Colar do ChatGPT"),
    h("p", { class: "muted" }, "No ChatGPT, mande o anúncio e o pedido do arquivo \"Prompt para o ChatGPT\". Copie a resposta inteira e cole aqui. As máquinas entram como \"Aguardando você\"; nada vai para o site sem você publicar."),
    caixaTexto, enviar, saida);
}

// Ficha interna do Radar: só no ADM, nunca no site (docs/RADAR-REGRAS.md).
function fichaInterna(m, recarregar) {
  const linhas = [];
  const classe = { Quente: "publicado", Boa: "novo" }[m.classificacao] || "descartado";
  if (m.classificacao) linhas.push(h("span", {}, h("span", { class: `selo ${classe}` }, m.classificacao),
    m.descontoPct != null ? ` ${m.descontoPct}% abaixo do mercado (${reais(m.precoMercado)})` : " • preço de mercado a informar"));
  if (m.fonte || m.link) linhas.push(h("span", { class: "muted" }, "Fonte: ", m.fonte || "", " ",
    /^https?:\/\//i.test(m.link || "") ? h("a", { href: m.link, target: "_blank", rel: "noopener noreferrer" }, "abrir anúncio") : ""));
  if (m.contato) linhas.push(h("span", { class: "muted" }, `Vendedor: ${m.contato}`));
  for (const aviso of m.avisos || []) linhas.push(h("span", { class: "erro" }, aviso));
  if (m.fotos?.length) {
    const marcadas = new Set(m.fotosMarca || []);
    linhas.push(h("div", { class: "fotos-prev" }, m.fotos.map((f) => {
      const caixaMarca = h("input", { type: "checkbox", checked: marcadas.has(f) });
      caixaMarca.addEventListener("change", () => acao(caixaMarca, async () => {
        caixaMarca.checked ? marcadas.add(f) : marcadas.delete(f);
        await api(`/radar/${m.id}`, { method: "PUT", body: { fotosMarca: [...marcadas] } });
        recarregar();
      }, caixaMarca.checked ? "Foto fora do site (marca d'água)." : "Foto liberada para o site."));
      return h("label", { class: "foto-marca" }, h("img", { src: `/adm/${f}`, alt: "" }), h("span", {}, caixaMarca, " marca d'água"));
    })));
    if (marcadas.size) {
      const msg = `Olá! Vi o anúncio da ${m.titulo}${m.ano ? ` ${m.ano}` : ""}. Tenho comprador interessado. Consegue me mandar fotos sem marca d'água e um vídeo da máquina funcionando?`;
      const tel = String(m.contato || "").replace(/\D/g, "");
      linhas.push(h("a", { class: "btn sec", target: "_blank", rel: "noopener",
        href: `https://wa.me/${tel.length >= 10 ? tel.replace(/^(?!55)/, "55") : ""}?text=${encodeURIComponent(msg)}` }, "Pedir fotos limpas ao vendedor"));
    }
  }
  return linhas.length ? h("div", { class: "ficha-interna" }, h("small", { class: "muted" }, "FICHA INTERNA — não vai para o site"), ...linhas) : null;
}

async function telaArte(tipo, m, voltar) {
  const preco = tipo === "radar" ? (m.precoSite ?? m.precoSiteCalculado) : m.preco;
  const marcadas = new Set(m.fotosMarca || []);
  let fotoIdx = m.fotos.findIndex((f) => !marcadas.has(f)), enquadre = 0.5, formato = "feed", canvas;
  const prev = h("div", { class: "arte-prev" });
  const escolhaFoto = h("select", {}, [h("option", { value: -1, selected: fotoIdx < 0 }, "Sem foto (fotos pelo WhatsApp)"),
    ...m.fotos.map((f, i) => h("option", { value: i, disabled: marcadas.has(f), selected: i === fotoIdx }, marcadas.has(f) ? `Foto ${i + 1} (marca d'água, não usar)` : `Foto ${i + 1}`))]);
  const escolhaFormato = h("select", {}, h("option", { value: "feed" }, "Feed 1080x1350"), h("option", { value: "story" }, "Story 1080x1920"));
  escolhaFormato.addEventListener("change", () => { formato = escolhaFormato.value; redesenhar(); });
  const posicao = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: 0.5 });
  async function redesenhar() {
    try { canvas = await desenharArte(m, preco, fotoIdx, enquadre, formato); canvas.className = "arte-canvas"; prev.replaceChildren(canvas); }
    catch (e) { prev.replaceChildren(h("p", { class: "erro" }, e.message)); }
  }
  escolhaFoto.addEventListener("change", () => { fotoIdx = +escolhaFoto.value; redesenhar(); });
  posicao.addEventListener("input", () => { enquadre = +posicao.value; redesenhar(); });
  const usar = h("button", { class: "btn ok" }, "Usar no site");
  usar.addEventListener("click", () => acao(usar, async () => {
    // O site usa sempre o formato feed.
    const feed = formato === "feed" ? canvas : await desenharArte(m, preco, fotoIdx, enquadre, "feed");
    const { foto } = await api("/fotos", { method: "POST", body: { dados: feed.toDataURL("image/jpeg", 0.88) } });
    await api(`/${tipo}/${m.id}`, { method: "PUT", body: { arte: foto } });
    voltar();
  }, "Arte salva. Ela aparece no site quando a máquina estiver publicada."));
  const baixar = h("button", { class: "btn sec" }, "Baixar para WhatsApp/Instagram");
  baixar.addEventListener("click", () => {
    const a = h("a", { href: canvas.toDataURL("image/jpeg", 0.92), download: `goullart-${String(m.titulo).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${formato}.jpg` });
    document.body.append(a); a.click(); a.remove();
  });
  conteudo.replaceChildren(h("div", { class: "painel" }, h("h2", {}, "Arte da máquina"),
    h("p", { class: "muted" }, "A arte mostra só foto, marca, modelo, ano, horas e preço. Fonte, local e observações nunca entram. Fotos marcadas com marca d'água de outra revenda não podem ser usadas: peça fotos limpas ao vendedor ou use \"Sem foto\"."),
    h("div", { class: "grade" }, h("label", {}, "Formato", escolhaFormato), h("label", {}, "Foto", escolhaFoto), h("label", {}, "Enquadramento (cima ↔ baixo)", posicao)),
    prev, h("div", { class: "acoes" }, usar, baixar, h("button", { class: "btn sec", onclick: voltar }, "Voltar"))));
  redesenhar();
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

// ---------- Publicações (painel do ChatGPT) ----------
const CATS_PUB = { maquinas: "Máquinas", pecas: "Peças", implementos: "Implementos / Outros", locacao: "Locação", licitacao: "Licitação" };

function importadorBackup(dados, aoImportar) {
  const arquivo = h("input", { type: "file", accept: "application/json,.json" });
  arquivo.addEventListener("change", async () => {
    const f = arquivo.files[0]; if (!f) return;
    if (dados && !confirm("Importar de novo substitui as publicações e radares do ADM (incluindo o que você editou aqui). Continuar?")) { arquivo.value = ""; return; }
    try {
      const r = await api("/publicacoes", { method: "POST", body: await f.text() });
      aviso(`Importado: ${r.itens} publicações (${r.noSite} no site) e ${r.radares} radares.`); aoImportar();
    } catch (e) { aviso(e.message); }
  });
  return h("div", { class: "painel" }, h("h2", {}, "Backup do painel do ChatGPT"),
    h("p", { class: "muted" }, dados
      ? `Importado em ${data(dados.importadoEm)}. Enviar outro backup substitui tudo.`
      : "Envie o arquivo goullart-agro-brasil-backup.json. Ao importar, fica no site exatamente o que o site mostra hoje; o resto entra como \"fora do site\" para você decidir."),
    h("label", {}, "Arquivo de backup", arquivo));
}

function formPublicacao(item, aoSalvar, aoCancelar) {
  const c = {
    titulo: h("input", { required: true, value: item.titulo }),
    categoria: h("select", {}, Object.entries(CATS_PUB).map(([v, n]) => h("option", { value: v, selected: item.categoria === v }, n))),
    preco: h("input", { value: item.preco ?? "", inputmode: "decimal", placeholder: "Vazio = sob consulta" }),
    textoPublico: h("textarea", {}, item.textoPublico || ""),
    notasPrivadas: h("textarea", {}, item.notasPrivadas || ""),
  };
  let imagens = [...item.imagens];
  const prev = h("div", { class: "fotos-prev" });
  const desenharFotos = () => prev.replaceChildren(...imagens.map((src, i) => h("span", {}, h("img", { src, alt: "" }),
    h("button", { type: "button", class: "btn sec", onclick: () => { imagens.splice(i, 1); desenharFotos(); } }, "Tirar"))));
  desenharFotos();
  const arquivo = h("input", { type: "file", accept: "image/*", multiple: true });
  arquivo.addEventListener("change", async () => {
    for (const f of arquivo.files) { try { imagens.push("/" + await enviarFoto(f)); desenharFotos(); } catch (e) { aviso(e.message); } }
    arquivo.value = "";
  });
  const salvar = h("button", { class: "btn" }, "Salvar");
  salvar.addEventListener("click", () => acao(salvar, async () => {
    aoSalvar(await api(`/publicacoes/${encodeURIComponent(item.id)}`, { method: "PUT", body: {
      titulo: c.titulo.value, categoria: c.categoria.value, preco: c.preco.value, textoPublico: c.textoPublico.value,
      notasPrivadas: c.notasPrivadas.value, imagens } }));
  }, "Publicação salva."));
  return h("div", { class: "painel" },
    h("div", { class: "grade" }, h("label", {}, "Título", c.titulo), h("label", {}, "Categoria", c.categoria), h("label", {}, "Preço (R$)", c.preco)),
    h("label", {}, "Texto que aparece no site", c.textoPublico),
    h("label", {}, "Notas privadas (só no ADM, nunca no site)", c.notasPrivadas),
    h("label", {}, "Adicionar fotos", arquivo), prev,
    h("div", { class: "acoes" }, salvar, h("button", { class: "btn sec", onclick: aoCancelar }, "Cancelar")));
}

async function publicacoes() {
  const dados = await api("/publicacoes");
  const importar = importadorBackup(dados, publicacoes);
  if (!dados) { conteudo.replaceChildren(importar); return; }
  const busca = h("input", { type: "search", placeholder: "Título, código ou texto" });
  const cat = h("select", {}, h("option", { value: "" }, "Todas"), Object.entries(CATS_PUB).map(([v, n]) => h("option", { value: v }, n)));
  const situacao = h("select", {}, ["No site", "Fora do site", "Todas"].map((v) => h("option", {}, v)));
  const lista = h("div", { class: "lista" });
  const contagem = h("p", { class: "muted" });
  let limite = 60;
  function cartao(item) {
    const caixa = h("article", { class: "item" });
    const preencher = () => {
      const alternar = h("button", { class: item.noSite ? "btn perigo" : "btn ok" }, item.noSite ? "Tirar do site" : "Colocar no site");
      alternar.addEventListener("click", () => acao(alternar, async () => {
        Object.assign(item, await api(`/publicacoes/${encodeURIComponent(item.id)}`, { method: "PUT", body: { noSite: !item.noSite } }));
        preencher();
      }, item.noSite ? "Tirado do site." : "Colocado no site."));
      caixa.replaceChildren(
        item.imagens[0] ? h("img", { src: item.imagens[0], alt: "", loading: "lazy" }) : h("div", { class: "semfoto" }, "sem foto"),
        h("div", { class: "corpo" },
          h("div", {}, h("span", { class: item.noSite ? "selo publicado" : "selo descartado" }, item.noSite ? "No site" : "Fora do site"), " ",
            h("span", { class: "selo" }, CATS_PUB[item.categoria] || item.categoria), " ", h("span", { class: "muted" }, item.codigo || item.id)),
          h("strong", {}, item.titulo),
          h("span", { class: "preco" }, item.preco != null ? reais(item.preco) : "Sob consulta"),
          item.textoPublico ? h("span", { class: "muted" }, item.textoPublico.slice(0, 160)) : null,
          item.notasPrivadas ? h("details", {}, h("summary", {}, "Notas privadas"), h("p", { class: "muted" }, item.notasPrivadas)) : null,
          h("div", { class: "acoes" }, alternar, h("button", { class: "btn sec", onclick: () => {
            caixa.replaceChildren(h("div", { class: "linha-inteira" }, formPublicacao(item, (novo) => { Object.assign(item, novo); preencher(); }, preencher)));
          } }, "Editar"))));
    };
    preencher();
    return caixa;
  }
  function desenhar() {
    const t = busca.value.trim().toLowerCase();
    const f = dados.itens.filter((i) => (!cat.value || i.categoria === cat.value)
      && (situacao.value === "Todas" || (situacao.value === "No site") === i.noSite)
      && (!t || `${i.titulo} ${i.codigo} ${i.id} ${i.textoPublico}`.toLowerCase().includes(t)));
    contagem.textContent = `${f.length} publicação(ões)`;
    lista.replaceChildren(...f.slice(0, limite).map(cartao),
      f.length > limite ? h("button", { class: "btn sec", onclick: () => { limite += 60; desenhar(); } }, "Ver mais") : "");
  }
  for (const x of [busca, cat, situacao]) x.addEventListener("input", () => { limite = 60; desenhar(); });
  conteudo.replaceChildren(
    h("div", { class: "painel" }, h("h2", {}, "Publicações do site"),
      h("p", { class: "muted" }, "O que está \"No site\" aparece no catálogo de www.goullartmaquinaspesadas.com.br em poucos segundos. Notas privadas nunca vão para o site."),
      h("div", { class: "grade" }, h("label", {}, "Buscar", busca), h("label", {}, "Categoria", cat), h("label", {}, "Situação", situacao)), contagem),
    lista, importar);
  desenhar();
}

async function radares() {
  const [lista, dados] = await Promise.all([api("/radares"), api("/publicacoes")]);
  if (!dados) { conteudo.replaceChildren(importadorBackup(null, radares)); return; }
  conteudo.replaceChildren(h("div", { class: "painel" }, h("h2", {}, "Radares"),
    h("p", { class: "muted" }, "Perfis de busca de máquinas que vieram do painel do ChatGPT. Aqui ficam os critérios de cada radar para a equipe consultar e ajustar.")),
    ...(lista.length ? lista.map((r) => {
      const nome = h("input", { value: r.nome });
      const status = h("select", {}, ["scheduled", "active", "paused", "done"].map((s) => h("option", { value: s, selected: r.status === s },
        { scheduled: "Agendado", active: "Ativo", paused: "Pausado", done: "Concluído" }[s])));
      if (![...status.options].some((o) => o.selected)) status.prepend(h("option", { value: r.status, selected: true }, r.status));
      const criterios = h("textarea", { rows: 8 }, r.criterios);
      const salvar = h("button", { class: "btn" }, "Salvar radar");
      salvar.addEventListener("click", () => acao(salvar, () => api(`/radares/${encodeURIComponent(r.id)}`, { method: "PUT",
        body: { nome: nome.value, status: status.value, criterios: criterios.value } }), "Radar salvo."));
      return h("div", { class: "painel" }, h("div", { class: "grade" }, h("label", {}, "Nome", nome), h("label", {}, "Situação", status)),
        h("label", {}, "Critérios", criterios), salvar);
    }) : [h("p", { class: "muted" }, "Nenhum radar no backup importado.")]));
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
  const entrada = await api("/entrada");
  const urlEntrada = h("input", { readonly: true, value: entrada.url });
  // O servidor guarda só o hash: o token aparece uma única vez, na hora em que é gerado.
  const token = h("input", { readonly: true, value: entrada.token || (entrada.ligada ? "(ligada — o token só aparece quando é gerado)" : "(desligada: gere o token)") });
  const gerar = h("button", { class: "btn sec" }, entrada.ligada ? "Gerar novo token" : "Ligar entrada do Radar");
  gerar.addEventListener("click", () => (!entrada.ligada || confirm("O token antigo deixa de funcionar. Continuar?")) &&
    acao(gerar, async () => { entrada.token = (await api("/entrada/token", { method: "POST" })).token; entrada.ligada = true; token.value = entrada.token; gerar.textContent = "Gerar novo token"; }, "Token gerado. Copie agora: ele não será mostrado de novo."));
  const aviso = h("input", { value: entrada.avisoWebhook, placeholder: "https://... (Zapier, Make ou iZap)" });
  const salvarAviso = h("button", { class: "btn" }, "Salvar aviso");
  salvarAviso.addEventListener("click", () => acao(salvarAviso, async () => { await api("/config", { method: "PUT", body: { avisoWebhook: aviso.value } }); }, "Aviso salvo."));
  const sair = h("button", { class: "btn perigo" }, "Sair do ADM");
  sair.addEventListener("click", async () => { await api("/sair", { method: "POST" }).catch(() => {}); mostrarLogin(); });
  const painelWhats = await painelWhatsapp();
  conteudo.replaceChildren(
    painelWhats,
    h("div", { class: "painel" }, h("h2", {}, "Margem do Radar"),
      h("p", { class: "muted" }, "Valor somado ao preço de origem para calcular o preço do site. Vale para as próximas publicações; as já publicadas mantêm o preço."),
      h("label", {}, "Margem (R$)", margem), salvarMargem),
    h("div", { class: "painel" }, h("h2", {}, "Entrada do Radar"),
      h("p", { class: "muted" }, "Endereço para o Radar (ChatGPT ou automação) mandar cada oferta. Ela entra como \"Aguardando você\" com a ficha interna. Envie POST em JSON com o token no cabeçalho Authorization: Bearer. Campos: titulo, categoria, ano, horas, local, precoOrigem, precoMercado, fonte, link, contato, obs e fotos ([{url, marcaDagua}], até 3)."),
      h("label", {}, "Endereço", urlEntrada), h("label", {}, "Token (guarde em segredo)", token), gerar),
    h("div", { class: "painel" }, h("h2", {}, "Aviso de nova oferta"),
      h("p", { class: "muted" }, "Quando entra uma oferta, o ADM manda os dados (com o link para aprovar) para este endereço. Ligue-o a uma automação que mande para o seu WhatsApp."),
      h("label", {}, "Endereço do aviso", aviso), salvarAviso),
    h("div", { class: "painel" }, h("h2", {}, "Trocar senha"), h("label", {}, "Senha atual", atual), h("label", {}, "Nova senha (8+ caracteres)", nova), trocar),
    h("div", { class: "painel" }, sair));
}

// ---------- WhatsApp do Radar (API oficial da Meta) ----------
// Token e App Secret só vão do navegador para o servidor; o servidor nunca os devolve.
async function painelWhatsapp() {
  let st = await api("/whatsapp");
  const caixa = h("div", { class: "painel" });
  const dataHora = (s) => (s ? new Date(s).toLocaleString("pt-BR") : "—");
  function desenhar() {
    const phone = h("input", { value: st.phoneNumberId || "", inputmode: "numeric", placeholder: "ID do número (Meta > WhatsApp > Configuração da API)" });
    const aprovador = h("input", { value: "", inputmode: "tel", placeholder: st.aprovadorFinal ? `Salvo: final ${st.aprovadorFinal} (deixe vazio para manter)` : "55 + DDD + número de quem aprova (SIM/NÃO)" });
    const token = h("input", { type: "password", autocomplete: "off", placeholder: st.tokenSalvo ? "Salvo (deixe vazio para manter)" : "Token permanente do usuário do sistema" });
    const secret = h("input", { type: "password", autocomplete: "off", placeholder: st.appSecretSalvo ? "Salvo (deixe vazio para manter)" : "App Secret (32 caracteres)" });
    const versao = h("input", { value: st.versao || "v23.0" });
    const salvar = h("button", { class: "btn" }, "Salvar WhatsApp");
    salvar.addEventListener("click", () => acao(salvar, async () => {
      const corpo = { phoneNumberId: phone.value, versao: versao.value };
      if (aprovador.value.trim()) corpo.aprovador = aprovador.value;
      if (token.value.trim()) corpo.token = token.value;
      if (secret.value.trim()) corpo.appSecret = secret.value;
      st = { ...st, ...(await api("/whatsapp", { method: "PUT", body: corpo })) };
      desenhar();
    }, "WhatsApp salvo."));
    const teste = h("button", { class: "btn sec" }, "Enviar mensagem de teste ao aprovador");
    teste.addEventListener("click", () => acao(teste, () => api("/whatsapp/teste", { method: "POST" }), "Teste enviado. Confira o WhatsApp do aprovador."));
    const novoVerify = h("button", { class: "btn sec" }, "Gerar novo token de verificação");
    novoVerify.addEventListener("click", () => confirm("Depois será preciso colar o novo token na Meta. Continuar?") &&
      acao(novoVerify, async () => { st = { ...st, ...(await api("/whatsapp", { method: "PUT", body: { gerarVerifyToken: true } })) }; desenhar(); }, "Token de verificação trocado."));
    caixa.replaceChildren(
      h("h2", {}, "WhatsApp do Radar"),
      h("p", {}, st.pronto ? h("span", { class: "selo publicado" }, "Configurado") : h("span", { class: "selo novo" }, "Falta configurar")),
      h("p", { class: "muted" }, "Anúncio encaminhado pelo aprovador ao número da empresa vira oferta no Radar. Se for boa, o aprovador recebe a foto com o código e responde SIM RADAR-… para publicar ou NÃO RADAR-…. Mensagens de clientes são ignoradas."),
      h("div", { class: "grade" }, h("label", {}, "ID do número (Phone number ID)", phone), h("label", {}, "Aprovador", aprovador)),
      h("div", { class: "grade" }, h("label", {}, "Token de acesso", token), h("label", {}, "App Secret", secret)),
      h("label", {}, "Versão da API", versao),
      salvar,
      h("p", { class: "muted" }, "Na Meta (Webhooks do WhatsApp), cole estes dois valores e assine o campo \"messages\":"),
      h("label", {}, "URL de retorno (Callback URL)", h("input", { readonly: true, value: st.webhook || "" })),
      h("label", {}, "Token de verificação (Verify token)", h("input", { readonly: true, value: st.verifyToken || "(salve para gerar)" })),
      h("div", { class: "acoes" }, teste, novoVerify),
      h("p", { class: "muted" }, `Última mensagem recebida: ${dataHora(st.ultimoRecebido)} · Último envio: ${dataHora(st.ultimoEnvio)}` +
        (st.ultimoErro ? ` · Último erro (${dataHora(st.ultimoErro.em)}): ${st.ultimoErro.msg}` : "")));
  }
  desenhar();
  return caixa;
}

iniciar();
