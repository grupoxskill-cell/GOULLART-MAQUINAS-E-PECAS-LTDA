// Ajusta a cópia do site do ChatGPT (espelho/) para rodar como site estático no domínio próprio.
// Uso: node scripts/preparar-espelho.mjs   (gera site-novo/)
import { cp, readdir, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ORIGEM = "https://www.goullartmaquinaspesadas.com.br";
const DOMINIO = "https://www.goullartmaquinaspesadas.com.br";
const SAIDA = "site-novo";
await rm(SAIDA, { recursive: true, force: true });
await cp("espelho", SAIDA, { recursive: true });
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
  if(f.endsWith(".html") && /src="\/(?:app|catalog-page-client)\.js/.test(t) && !t.includes('src="/catalog-navigation.js')) t=t.replace('</body>','<script defer src="/catalog-navigation.js?v=correcoes-20261031-2"></script></body>');
  if(f.endsWith(".html")) t=t.replace(/((?:catalog-data|catalog-navigation|catalog-routes|area-pages|organized-areas|mobile-navigation|catalog-page-client|app)\.js)\?v=[^"'<>\s]+/g, '$1?v=correcoes-20261031-2').replace(/(organized-areas\.css)\?v=[^"'<>\s]+/g, '$1?v=correcoes-20261031-2');
  if(f.endsWith(".html")) t=t.replace(/((?:mobile-navigation|catalog-page-client)\.js)\?v=[^"'<>\s]+/g, '$1?v=elegibilidade-inicio-20261031');
  t = t.split(ORIGEM).join(DOMINIO);
  // Script de verificação da Cloudflare do servidor do ChatGPT: não existe no domínio próprio.
  t = t.replace(/<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument[\s\S]*?<\/script>/g, "");
  // Catálogo vira arquivo estático.
  // Catálogo: primeiro o do ADM (publicações editadas lá); se o ADM não responder, a cópia estática.
  t = t.replace(/fetch\((['"])\/api\/catalog\1\s*,/g,
    "((o)=>fetch('/adm/catalogo.json',o).then((r)=>r.ok?r:Promise.reject(r)).catch(()=>fetch('/api/catalog.json',o)))(");
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
 html=html.replace(/href="#maquinas"([^>]*>Ver editais e locações)/g,'href="#locacao"$1');
 html=html.replace(/Estudo de personalização\. Consulte modelos e tamanhos\./g,'Bordado country. Consulte modelos e tamanhos.');
 html=html.replace(/<a\\b[^>]*>[^<]*(?:Solicitar link oficial|Área do administrador)[^<]*<\\/a>/gi,'');
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
  await mkdir(pasta,{recursive:true});
  await writeFile(join(pasta,"index.html"),texto);
}
console.log("Site novo preparado em " + SAIDA + "/");
