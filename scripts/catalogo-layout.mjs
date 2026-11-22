// Os elementos de navegação vêm do mesmo HTML aprovado e já filtrado usado na home.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE, tiposDeMaquina } from '../lib/paginas.js';

export async function aplicarLayoutCatalogo(diretorio) {
  const inicio = await readFile(join(diretorio, 'index.html'), 'utf8');
  function trecho(expressao) {
    const encontrado = inicio.match(expressao);
    if (!encontrado) throw new Error('Elemento público ausente na página inicial: ' + expressao);
    return encontrado[0];
  }
  const topo = trecho(/<header>[\s\S]*?<\/header>/)
    .replaceAll('href="#inicio"', 'href="/"')
    .replace(/href="#(maquinas|pecas|locacao)"/g, 'href="/?area=$1"');
  const rodape = trecho(/<footer id="atendimento"[^>]*>[\s\S]*?<\/footer>/);
  const menu = trecho(/<dialog id="goullart-sidebar"[^>]*>[\s\S]*?<\/dialog>/);
  const categorias = (await tiposDeMaquina()).map(tipo => 'maquinas/' + tipo);
  const paginas = ['maquinas.html', ...['ofertas', ...categorias].flatMap(rota => [rota+'.html', rota+'/index.html'])];

  for (const pagina of paginas) {
    const arquivo = join(diretorio, pagina);
    const principal = pagina === 'maquinas.html';
    let html = await readFile(arquivo, 'utf8');
    const rota = principal ? '/maquinas.html' : '/' + pagina.replace(/(?:\/index)?\.html$/, '') + '/';
    const url = SITE + rota;
    html = html.replace(/<body(?: class="([^"]*)")?>/, (_, classes) =>
      '<body class="' + [classes, 'goullart-storefront approved-layout catalogo-comercial'].filter(Boolean).join(' ') + '">');
    html = html.replace(/<header class="(?:catalog-page-header|topbar)">[\s\S]*?<\/header>/, () => topo)
      .replace(/<footer class="(?:catalog-page-footer|footer goullart-watermark-footer)">[\s\S]*?<\/footer>/, () => rodape);
    // As categorias já contêm o mesmo menu com os vínculos locais e a visibilidade calculada.
    if (principal) html = html.replace('</body>', () => menu + '<script defer src="/mobile-navigation.js"></script></body>');
    html = html.replace('</body>', '<script defer src="/brand-strip.js"></script></body>');

    const estilos = ['storefront-bundle', 'sidebar-navigation', 'footer-information', 'site-typography', 'correcoes-site'];
    const novos = estilos.filter(nome => !html.includes('href="/' + nome + '.css'))
      .map(nome => '<link rel="stylesheet" href="/' + nome + '.css">');
    html = html.replace('</head>', () => novos.join('') + '</head>');
    html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_, ini, fim) => ini + url + fim);
    html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, (_, ini, fim) => ini + url + fim);
    await writeFile(arquivo, html);
  }
}
