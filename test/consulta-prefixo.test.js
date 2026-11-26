// Rede e arquivos reais em servidor estático isolado; o DOM é simulado, não um navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';

const site = resolve('_site');
const referencia = 'GOUL-HY-2020-12000';
const ficha = 'maquina/escavadeira-hyundai-r220lc-9-2020.html';
const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.png': 'image/png' };

async function servir(t, prefixo) {
  const servidor = createServer(async (req, res) => {
    const caminho = new URL(req.url, 'http://localhost').pathname;
    if (!caminho.startsWith(prefixo)) { res.writeHead(404).end(); return; }
    const arquivo = resolve(site, decodeURIComponent(caminho.slice(prefixo.length)) || 'index.html');
    if (!arquivo.startsWith(site + sep)) { res.writeHead(404).end(); return; }
    try {
      const dados = await readFile(arquivo);
      res.writeHead(200, { 'Content-Type': tipos[extname(arquivo)] || 'application/octet-stream' }).end(dados);
    } catch { res.writeHead(404).end(); }
  });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((ok, falha) => {
    servidor.close(erro => erro ? falha(erro) : ok());
    servidor.closeAllConnections();
  }));
  return new URL(prefixo, `http://127.0.0.1:${servidor.address().port}`);
}

function estadoSimulado() {
  const elemento = () => ({ listeners: {}, addEventListener(nome, fn) { this.listeners[nome] = fn; } });
  const seletor = () => ({ ...elemento(), value: '', options: [], replaceChildren(...opcoes) { this.options = opcoes; } });
  const corpo = { rows: [], replaceChildren() { this.rows = []; }, insertRow() {
    const linha = { cells: [], append(cab) { this.cab = cab; }, insertCell() {
      const celula = {}; this.cells.push(celula); return celula;
    } };
    this.rows.push(linha); return linha;
  } };
  const troca = { ...elemento(), reportValidity: () => true, elements: {} };
  return { primeira: seletor(), segunda: seletor(), comparacao: { tBodies: [corpo] },
    aviso: {}, pdf: { hidden: true }, resultado: {}, troca };
}

for (const prefixo of ['/', '/catalogo/']) {
  test(`ficha, recursos, catálogo e PDF por HTTP em ${prefixo}`, async t => {
    const base = await servir(t, prefixo);
    const obter = async (ref, pagina = base) => {
      const url = new URL(ref, pagina);
      assert.equal(url.origin, base.origin, `recurso externo inesperado: ${url}`);
      assert.ok(url.pathname.startsWith(prefixo), `recurso escapou do subdiretório: ${url}`);
      const resposta = await fetch(url);
      assert.equal(resposta.status, 200, url.href);
      return resposta;
    };
    const recursos = async (html, pagina) => {
      const refs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"|<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)]
        .map(m => m[1] || m[2]);
      assert.ok(refs.length, 'a página deve declarar seus recursos');
      for (const ref of refs) {
        const url = new URL(ref, pagina);
        const resposta = await obter(url);
        const mime = tipos[extname(url.pathname)];
        assert.equal(resposta.headers.get('content-type'), mime, url.href);
        const conteudo = await resposta.text();
        if (mime !== 'text/css') continue;
        for (const [, interno] of conteudo.matchAll(/url\(\s*['"]?([^\s'"()]+)['"]?\s*\)/g)) {
          if (/^(?:data:|#)/.test(interno)) continue;
          const fonteOuImagem = await obter(interno, url);
          assert.ok((await fonteOuImagem.arrayBuffer()).byteLength > 0, interno);
        }
      }
    };
    const urlFicha = new URL(ficha, base);
    const htmlFicha = await (await obter(urlFicha)).text();
    await recursos(htmlFicha, urlFicha);
    const cta = htmlFicha.match(/href="([^"]+)">Comparar máquinas ou simular troca/);
    assert.ok(cta, 'a ficha deve oferecer o comparador');
    const consulta = new URL(cta[1], urlFicha);
    assert.equal(consulta.pathname, prefixo + 'consulta-maquinas.html');
    assert.equal(consulta.searchParams.get('ref'), referencia);
    const htmlConsulta = await (await obter(consulta)).text();
    await recursos(htmlConsulta, consulta);

    // O script da ficha tenta a situação no mesmo espelho; 404 é esperado sem ADM.
    const statusSrc = htmlFicha.match(/<script\b[^>]*src="([^"]*situacao-ficha\.js[^\"]*)"/)[1];
    const scriptStatus = await (await obter(statusSrc, urlFicha)).text();
    const pedidosStatus = [];
    const situacao = { textContent: 'Disponibilidade · A confirmar' };
    await runInNewContext(scriptStatus, {
      document: { body: { dataset: { ref: referencia } }, querySelector: () => situacao },
      fetch: async (ref, opcoes) => {
        const url = new URL(ref, urlFicha);
        const resposta = await fetch(url, opcoes);
        pedidosStatus.push({ caminho: url.pathname, status: resposta.status });
        return resposta;
      },
    });
    assert.deepEqual(pedidosStatus, [{ caminho: prefixo + 'adm/consulta-maquinas.json', status: 404 }]);
    assert.equal(situacao.textContent, 'Disponibilidade · A confirmar');

    const lista = await (await obter('consulta-maquinas.json')).json();
    const hyundai = lista.find(m => m.referencia === referencia);
    assert.ok(hyundai, 'catálogo real deve conter a Hyundai usada na regressão');
    assert.equal(hyundai.ano, 2020);
    assert.ok(lista.length > 1, 'comparação precisa de duas fichas');
    const scriptSrc = htmlConsulta.match(/<script\b[^>]*src="([^"]*consulta-maquinas\.js[^\"]*)"/)[1];
    const script = await (await obter(scriptSrc, consulta)).text();
    assert.match(script, /^carregar\(\);$/m);
    const estado = estadoSimulado(), pedidos = [];
    await runInNewContext(script.replace(/^carregar\(\);$/m, 'const carregamento = carregar();') + '; carregamento;', {
      document: { getElementById: id => estado[id], createElement: () => ({}) },
      location: consulta, URLSearchParams,
      Option: function(text, value) { this.text = text; this.value = value; },
      fetch: async (ref, opcoes) => {
        const url = new URL(ref, consulta); pedidos.push(url.pathname);
        assert.equal(url.origin, base.origin);
        assert.ok(url.pathname.startsWith(prefixo), url.href);
        return fetch(url, opcoes);
      },
    });
    assert.deepEqual(pedidos, [prefixo + 'adm/consulta-maquinas.json', prefixo + 'consulta-maquinas.json']);
    assert.equal(estado.primeira.value, referencia);
    assert.equal(estado.primeira.disabled, false);
    assert.equal(estado.primeira.options.length, lista.length + 1);
    assert.match(estado.aviso.textContent, /última atualização/);
    const outra = lista.find(m => m.referencia !== referencia);
    estado.segunda.value = outra.referencia;
    estado.segunda.listeners.change();
    assert.equal(estado.comparacao.hidden, false);
    assert.deepEqual(estado.comparacao.tBodies[0].rows[0].cells.map(c => c.textContent), [hyundai.titulo, outra.titulo]);
    assert.equal(estado.segunda.options.find(o => o.value === referencia).disabled, true);

    // Aciona o manipulador real com campos simulados; não valida controles nativos do navegador.
    for (const [campo, valor] of Object.entries({ ref1: 340000, ref2: 300000, ref3: 320000, custos: 20000, alvo: 350000 })) {
      estado.troca.elements[campo] = { valueAsNumber: valor };
    }
    estado.troca.listeners.submit({ preventDefault() {} });
    assert.match(estado.resultado.textContent, /mediana de R\$\s*320\.000,00/);
    assert.match(estado.resultado.textContent, /troca de R\$\s*300\.000,00/);
    assert.match(estado.resultado.textContent, /completar de R\$\s*50\.000,00/);

    assert.equal(estado.pdf.hidden, false);
    const urlPdf = new URL(estado.pdf.href, consulta);
    assert.equal(urlPdf.pathname, prefixo + 'catalogo-maquinas.pdf');
    const pdf = await obter(urlPdf);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from('%PDF-1.4')));
    assert.match(bytes.toString('latin1'), /%%EOF\s*$/);
    assert.ok(bytes.includes(Buffer.from(referencia)));
    assert.deepEqual(bytes, await readFile(resolve(site, 'catalogo-maquinas.pdf')));
  });
}
