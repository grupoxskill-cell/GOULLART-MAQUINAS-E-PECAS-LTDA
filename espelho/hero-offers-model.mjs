const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const cleanLabel = value => String(value || '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
const machineTypes = /\b(?:mini\s*)?(?:escavadeiras?|retroescavadeiras?|carregadeiras?)\b|\b(?:motoniveladoras?|patrol|rolos? compactador(?:es)?|(?:trator|tratores) de esteiras?)\b/;
const otherTypes = /\b(?:gerador|caminhao|cavalo mecanico|carreta|prancha|pecas?)\b/;
const manufacturer = /\b(?:caterpillar|cat|case|komatsu|john deere|hyundai|volvo|sany|jcb|new holland|develon|liugong|xcmg)\b/i;

export function machineName(item) {
  const title = cleanLabel(item.title).replace(/\s*•\s*/g, ' · ');
  const lines = String(item.publicText || '').split('\n').map(cleanLabel).filter(Boolean);
  const brandLine = lines.find(line => manufacturer.test(line));
  const modelLine = lines.find(line => /^modelo\s*:/i.test(line));
  if (modelLine && !normal(title).includes(normal(modelLine.replace(/^modelo\s*:/i, '').trim()))) {
    return cleanLabel(title.replace(/Fabricante:\s*/i, '') + ' ' + modelLine.replace(/^modelo\s*:/i, ''));
  }
  if (!manufacturer.test(title) && brandLine) return title + ' · ' + brandLine;
  if (/^escavadeira hyundai$/i.test(title)) {
    const model = lines.find(line => /^R\s*\d{3}/i.test(line));
    if (model) return title + ' ' + model;
  }
  return title;
}

export function selectCheapestMachines(items, eligible, now = Date.now(), limit = 20) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(item => {
    if (!item || item.category !== 'maquinas' || item.archived || item.privateOnly || item.published === false) return false;
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price <= 0) return false;
    if (!item.image || !eligible(item, now)) return false;
    const title = normal(item.title);
    if (otherTypes.test(title)) return false;
    return machineTypes.test(title) || machineTypes.test(normal(String(item.publicText || '').slice(0, 180)));
  }).sort((a, b) => a.price - b.price || String(b.publishedAt).localeCompare(String(a.publishedAt))).filter(item => {
    // Identical reposts use their most recent listing and appear only once.
    const description = normal(item.publicText).replace(/[^a-z0-9]+/g, '');
    const key = item.price + '|' + (description || normal(item.title) + '|' + item.image);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}
