// Gera a arte (1080x1350, PNG) de uma máquina do Radar para aprovação no WhatsApp.
// Uso: node scripts/radar/arte.mjs dados.json saida.png
// dados.json: { codigo, titulo, ano, horas, precoSite (número), local (estado/região, opcional), foto (caminho local, opcional) }
import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { createRequire } from "node:module";
import { formatarReais } from "../../lib/radar.js";

// Playwright vem instalado no ambiente (fora do projeto); require resolve pelo NODE_PATH global.
const { chromium } = createRequire(import.meta.url)("playwright");

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error("Uso: node scripts/radar/arte.mjs dados.json saida.png");
  process.exit(1);
}
const d = JSON.parse(await readFile(entrada, "utf8"));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dataUri = async (p) => `data:image/${extname(p).slice(1).replace("jpg", "jpeg")};base64,${(await readFile(p)).toString("base64")}`;

const logo = await dataUri(new URL("../../public/assets/logo-oficial.png", import.meta.url).pathname);
const foto = d.foto ? await dataUri(d.foto) : null;
const detalhes = [d.ano && `Ano ${d.ano}`, d.horas, d.local].filter(Boolean).map(esc);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1080px;height:1350px;background:#041832;color:#fff;font-family:"DejaVu Sans",Arial,sans-serif;display:flex;flex-direction:column}
.topo{display:flex;justify-content:space-between;align-items:center;padding:44px 56px 28px}.topo img{width:230px}
.selo{background:#f5b800;color:#041832;font-weight:800;font-size:30px;letter-spacing:2px;padding:14px 26px;border-radius:8px}
.foto{flex:1;margin:0 56px;border-radius:18px;overflow:hidden;background:#0b2a52 center/cover no-repeat;display:flex;align-items:center;justify-content:center}
.foto span{font-size:34px;color:#8fa6c4;text-align:center;padding:40px}
.info{padding:36px 56px 0}.info h1{font-size:62px;line-height:1.08;font-weight:800}
.det{margin-top:18px;font-size:32px;color:#c9d6e6;display:flex;gap:18px;flex-wrap:wrap}.det b{color:#f5b800}
.preco{margin:30px 56px 0;display:flex;align-items:baseline;gap:18px}.preco small{font-size:30px;color:#c9d6e6}.preco strong{font-size:96px;color:#f5b800;font-weight:800}
.rodape{margin-top:30px;background:#f5b800;color:#041832;display:flex;justify-content:space-between;align-items:center;padding:26px 56px;font-size:34px;font-weight:800;white-space:nowrap;gap:24px}
.rodape span{font-size:22px;font-weight:600;text-align:right;white-space:normal}
</style></head><body>
<div class="topo"><img src="${logo}" alt=""><div class="selo">OPORTUNIDADE</div></div>
<div class="foto"${foto ? ` style="background-image:url('${foto}')"` : ""}>${foto ? "" : "<span>Fotos e vídeos com a equipe GOULLART</span>"}</div>
<div class="info"><h1>${esc(d.titulo)}</h1><div class="det">${detalhes.join(" <b>•</b> ")}</div></div>
<div class="preco"><small>Por</small><strong>${esc(formatarReais(d.precoSite))}</strong></div>
<div class="rodape">WhatsApp (62) 99942-7276<span>${esc(d.codigo)}<br>Sujeito a confirmação</span></div>
</body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1350 } });
await pagina.setContent(html, { waitUntil: "load" });
await writeFile(saida, await pagina.screenshot({ type: "png" }));
await navegador.close();
console.log(`Arte gerada: ${saida}`);
