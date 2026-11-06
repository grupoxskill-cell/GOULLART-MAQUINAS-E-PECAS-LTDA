const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Recebe somente os anúncios elegíveis da vitrine: vendidos nunca entram no banner.
export function renderMachineBanner(items, pageMap = {}) {
 const seen = new Set();
 const machines = items.filter(item => {
  const code = item.publicCode || item.id;
  if (item.category !== 'maquinas' || !item.artwork || !item.image || seen.has(code)) return false;
  seen.add(code); return true;
 });
 if (!machines.length) return '';
 const slides = machines.map((item, index) => {
  const link = pageMap[item.publicCode] || '/?area=maquinas&item=' + encodeURIComponent(item.id);
  const price = item.price == null ? 'Solicite proposta' : Number(item.price).toLocaleString('pt-BR', {style:'currency',currency:'BRL',maximumFractionDigits:0});
  const facts = [item.year, item.hours && item.hours + ' h', item.location || item.state || 'Localização sob consulta'].filter(Boolean).join(' · ');
  return `<article class="approved-slide approved-machine-slide" data-slide data-code="${esc(item.publicCode)}" role="group" aria-roledescription="slide" aria-label="${index+1} de ${machines.length}"${index ? ' hidden inert' : ''}>
<a class="machine-banner-art" href="${esc(link)}" aria-label="Ver ${esc(item.title)}"><img src="${esc(item.image)}" alt="${esc(item.title)} — arte completa" loading="${index ? 'lazy' : 'eager'}"${index ? '' : ' fetchpriority="high"'} decoding="async"></a>
<div class="machine-banner-copy"><p class="machine-banner-kicker">GOULLART PESADOS</p><h2>${esc(item.title)}</h2><p class="machine-banner-facts">${esc(facts)}</p><strong class="machine-banner-price">${esc(price)}</strong>${item.priceNote ? `<p class="machine-banner-note">${esc(item.priceNote)}</p>` : ''}<a class="machine-banner-link" href="${esc(link)}">Ver máquina e fotos →</a></div>
</article>`;
 }).join('\n');
 return `<section class="approved-banner machine-banner" id="approved-banner" data-banner-interval="1250" data-banner-count="${machines.length}" role="region" aria-roledescription="carrossel" aria-label="Máquinas GOULLART"><h1 class="machine-banner-heading">Máquinas GOULLART</h1><div class="machine-banner-stage">${slides}</div><div class="approved-controls"><button type="button" data-banner-prev aria-label="Máquina anterior">‹</button><div class="machine-banner-dots">${machines.map((item,index)=>`<button type="button" data-banner-to="${index}" aria-label="Ver ${esc(item.title)}" aria-pressed="${index===0}">${index+1}</button>`).join('')}</div><button type="button" data-banner-next aria-label="Próxima máquina">›</button><button type="button" data-banner-pause aria-label="Pausar banners" aria-pressed="false">Ⅱ</button></div></section>`;
}
