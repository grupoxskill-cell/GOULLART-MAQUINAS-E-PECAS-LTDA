// Ajusta a cópia do site do ChatGPT (espelho/) para rodar como site estático no domínio próprio.
// Uso: node scripts/preparar-espelho.mjs   (gera site-novo/)
import { cp, readdir, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { protectCourse } from './proteger-curso.mjs';

const ORIGEM = "https://www.goullartmaquinaspesadas.com.br";
const DOMINIO = "https://www.goullartmaquinaspesadas.com.br";
const SAIDA = "site-novo";
await rm(SAIDA, { recursive: true, force: true });
await cp("espelho", SAIDA, { recursive: true });
await protectCourse(SAIDA);
await rm(join(SAIDA, "cdn-cgi"), { recursive: true, force: true });
await rm(join(SAIDA, "admin"), { recursive: true, force: true });
await rm(join(SAIDA, "_relatorio.txt"), { force: true });

async function* arquivos(pasta) {
  for (const n of await readdir(pasta)) {
    const p = join(pasta, n);
    if ((await stat(p)).isDirectory()) yield* arquivos(p); else yield p;
  }
}

for await (const f of arquivos(SAIDA)) {
  if (!/\.(html|css|js|mjs|json)$/.test(f)) continue;
  let t = await readFile(f, "utf-8");
  const antes = t;
  if(f.endsWith(".html") && /src="\/catalog-page-client\.js/.test(t) && !/src="\/?listing-policy\.js/.test(t)) t=t.replace(/<script(?=[^>]*src="\/catalog-page-client\.js)/,'<script defer src="/listing-policy.js?v=locacoes-20261031-2"></script><script');
  if(f.endsWith(".html") && !t.includes('src="/catalog-data.js')) t=t.replace(/<script(?=[^>]*src="\/(?:app|catalog-page-client)\.js)/,'<script defer src="/catalog-data.js?v=correcoes-20261031-2"></script><script');
  // Páginas individuais das máquinas (ficha completa) linkadas a partir dos cards.
  if(f.endsWith(".html") && !t.includes('src="/paginas-maquinas.js')) t=t.replace(/<script(?=[^>]*src="\/(?:app|catalog-page-client)\.js)/,'<script defer src="/paginas-maquinas.js?v=20261105"></script><script');
  if(f.endsWith(".html") && /src="\/(?:app|catalog-page-client)\.js/.test(t) && !t.includes('src="/catalog-navigation.js')) t=t.replace('</body>','<script defer src="/catalog-navigation.js?v=correcoes-20261031-2"></script></body>');
  if(f.endsWith(".html")) t=t.replace(/((?:catalog-data|catalog-navigation|catalog-routes|area-pages|organized-areas|mobile-navigation|catalog-page-client|app)\.js)\?v=[^"'<>\s]+/g, '$1?v=correcoes-20261031-2').replace(/(organized-areas\.css)\?v=[^"'<>\s]+/g, '$1?v=correcoes-20261031-2');
  if(f.endsWith(".html")) t=t.replace(/((?:mobile-navigation|catalog-page-client)\.js)\?v=[^"'<>\s]+/g, '$1?v=elegibilidade-inicio-20261031');
  if(f.endsWith(".html")) t=t.replace(/((?:listing-policy|app)\.js|site-typography\.css)\?v=[^"'<>\s]+/g, '$1?v=locacoes-20261101-2');
  if(f.endsWith(".html")) t=t.replace(/(area-pages\.js)\?v=[^"'<>\s]+/g, '$1?v=magazine-20261101');
  if(f.endsWith(".html")) t=t.replace(/(src="\/(?:runtime-compat|app|catalog-page-client|hero-offers)\.js)(?:\?v=[^"'<>\s]+)?/g, '$1?v=catalog-fallback-20261105');
  if(f.endsWith(".html")) t=t.replace(/((?:app|catalog-page-client)\.js|(?:catalog-pages|storefront-bundle)\.css)(?:\?v=[^"'<>\s]+)?/g, '$1?v=artes-20261105');
  t = t.split(ORIGEM).join(DOMINIO);
  // Script de verificação da Cloudflare do servidor do ChatGPT: não existe no domínio próprio.
  t = t.replace(/<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument[\s\S]*?<\/script>/g, "");
  // Catálogo vira arquivo estático.
  // Catálogo: primeiro o do ADM (publicações editadas lá); se o ADM não responder, a cópia estática.
  t = t.replace(/fetch\((['"])\/api\/catalog\1\s*,/g,
    "window.GoullartRuntime.fetchCatalog(");
  // Área administrativa e de cliente do ChatGPT não existem aqui: "Administração" vai para o ADM do servidor.
  // Links de login do ChatGPT saem do site público. O ADM fica em /adm, sem link visível para visitantes.
  t = t.replace(/<a href="\/(?:admin\/login|cliente)">[^<]*<\/a>/g, "");
  t = t.replace(/href="\/admin\/login"/g, 'href="/adm"');
  if (f.endsWith("catalog.json")) {
    const d = JSON.parse(t);
    for (const i of d.items || []) delete i.sourceKey;
    t = JSON.stringify(d);
  }
  if (t !== antes) await writeFile(f, t);
}

const {prepareCatalogue}=await import("./build-catalog-pages.mjs");
await prepareCatalogue(SAIDA);

// Correções de navegação e textos feitas no produto gerado, sem mudar CSS, fotos ou logos.
for await (const file of arquivos(SAIDA)) {
 if(!file.endsWith('.html'))continue;
 let html=await readFile(file,'utf8'),original=html;
 html=html.replace(/<nav class="central-navigation"[^>]*>[\s\S]*?<\/nav>/g,'');
 html=html.replace(/href="\/cliente(?:\/)?"/g,'href="/?area=maquinas"');
 html=html.replace(/href="#maquinas"([^>]*>Explorar o catálogo de peças)/g,'href="#pecas"$1');
 // Peças vão direto para o WhatsApp (não há lista de peças com foto no site).
 html=html.replace(/<summary>Ver peças e pedir orçamento<\/summary>/g,'<summary>Pedir peça pelo WhatsApp</summary>');
 html=html.replace(/<small>Consultar (?:peça|aplicação ↗)<\/small>/g,'<small>Pedir no WhatsApp ↗</small>');
 html=html.replace(/(>)Explorar o catálogo de peças( <span)/g,'$1Pedir peça pelo WhatsApp$2');
 html=html.replace(/href="#maquinas"([^>]*>Ver editais e locações)/g,'href="#locacao"$1');
 html=html.replace(/Estudo de personalização\. Consulte modelos e tamanhos\./g,'Bordado country. Consulte modelos e tamanhos.');
 html=html.replace(/<a\b[^>]*>[^<]*(?:Solicitar link oficial|Área do administrador)[^<]*<\/a>/gi,'');
 html=html.replace(/Falaa, Júnior!/gi,'Olá, equipe Goullart! Vim pelo site e quero conversar sobre uma máquina.');
 html=html.replace(/goullartmaquinaspesadas\.com\.br/g,'www.goullartmaquinaspesadas.com.br').replace(/www\.www\./g,'www.');
 if(file.includes('/adm/'))html=html.replace(/<head>/i,'<head><meta name="robots" content="noindex,nofollow">');
 if(html!==original)await writeFile(file,html);
}
// Rota direta de cliente envia ao catálogo sem depender de JavaScript.
await mkdir(join(SAIDA,'cliente'),{recursive:true});
await writeFile(join(SAIDA,'cliente','index.html'),
 '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=/?area=maquinas"><title>Catálogo GOULLART PESADOS</title></head><body><a href="/?area=maquinas">Abrir catálogo</a></body></html>');


// Páginas públicas sem extensão recebem index.html, inclusive ofertas e os 15 tipos.
const paginas = [];
for await (const f of arquivos(SAIDA)) if (f.endsWith(".html") && !f.endsWith("/index.html")) paginas.push(f);
for (const html of paginas) {
  const pasta = html.slice(0,-5);
  let texto = await readFile(html,"utf8");
  if (!/<base\b/i.test(texto)) texto = texto.replace(/<head>/i,'<head><base href="/">');
  // Com <base href="/">, todo atalho "#x" iria para a página inicial: fica apontando para a própria página.
  const rota = '/' + pasta.slice(SAIDA.length + 1) + '/';
  texto = texto.replace(/href="#([^"]+)"/g, (_, alvo) => `href="${rota}#${alvo}"`);
  await mkdir(pasta,{recursive:true});
  await writeFile(join(pasta,"index.html"),texto);
}
console.log("Site novo preparado em " + SAIDA + "/");
