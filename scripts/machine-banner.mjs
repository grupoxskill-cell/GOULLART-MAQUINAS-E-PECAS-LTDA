import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function fotoMobile(url, directory) {
 if (!/^\/assets\/listings\/(?:[\w-]+\/)*[\w-]+\.(?:jpe?g|png|webp)$/i.test(url)) return '';
 const original = join(directory, url);
 if (!existsSync(original)) return '';
 // Uma foto substituída no catálogo só usa a miniatura correspondente ao novo conteúdo.
 const hash = createHash('sha256').update(readFileSync(original)).digest('hex').slice(0, 12);
 const mobile = url.replace(/\.[^.]+$/, '-banner-' + hash + '.webp');
 return existsSync(join(directory, mobile)) ? mobile : '';
}

// Recebe somente os anúncios elegíveis da vitrine: vendidos nunca entram no banner.
export function renderMachineBanner(items, pageMap = {}, directory = 'espelho') {
 const seen = new Set();
 const machines = items.filter(item => {
  const code = item.publicCode || item.id;
  if (item.category !== 'maquinas' || !String(item.image || '').trim() || !Number.isFinite(Number(item.price)) || Number(item.price) <= 0 || seen.has(code)) return false;
  seen.add(code); return true;
 }).slice(0,12);
 if (!machines.length) return '';
 const slides = machines.map((item, index) => {
  const link = pageMap[item.publicCode] || '/?area=maquinas&item=' + encodeURIComponent(item.id);
  const price = item.price == null ? 'Solicite proposta' : Number(item.price).toLocaleString('pt-BR', {style:'currency',currency:'BRL',maximumFractionDigits:0});
  const facts = [item.year, item.hours && item.hours + ' h', item.location || item.state || 'Localização sob consulta'].filter(Boolean).join(' · ');
  const mobile = fotoMobile(item.image, directory);
  const image = `<img src="${esc(item.image)}" alt="${esc(item.title)}" loading="${index ? 'lazy' : 'eager'}"${index ? '' : ' fetchpriority="high"'} decoding="async">`;
  const photo = mobile ? `<picture><source media="(max-width: 700px), (max-resolution: 1.5dppx)" type="image/webp" srcset="${esc(mobile)}">${image}</picture>` : image;
  return `<article class="approved-slide approved-machine-slide" data-slide data-code="${esc(item.publicCode)}" role="group" aria-roledescription="slide" aria-label="${index+1} de ${machines.length}"${index ? ' hidden inert' : ''}>
<a class="machine-banner-art" href="${esc(link)}" aria-label="Ver ${esc(item.title)}">${photo}</a>
<div class="machine-banner-copy"><p class="machine-banner-kicker">GOULLART PESADOS</p><h2>${esc(item.title)}</h2><p class="machine-banner-facts">${esc(facts)}</p><strong class="machine-banner-price">${esc(price)}</strong>${item.priceNote ? `<p class="machine-banner-note">${esc(item.priceNote)}</p>` : ''}<a class="machine-banner-link" href="${esc(link)}">Ver máquina e fotos →</a></div>
</article>`;
 }).join('\n');
 return `<section class="approved-banner machine-banner" id="approved-banner" data-banner-interval="5000" data-banner-count="${machines.length}" role="region" aria-roledescription="carrossel" aria-label="Máquinas GOULLART com preço"><h1 class="machine-banner-heading">Máquinas GOULLART</h1><div class="machine-banner-stage">${slides}</div><div class="approved-controls"><button type="button" data-banner-prev aria-label="Máquina anterior">‹</button><span class="machine-banner-position" data-banner-position>1 / ${machines.length}</span><button type="button" data-banner-next aria-label="Próxima máquina">›</button><button type="button" data-banner-pause aria-label="Pausar banners" aria-pressed="false">Ⅱ</button><a class="machine-banner-all" href="/?area=maquinas">Ver todas →</a></div></section>`;
}
