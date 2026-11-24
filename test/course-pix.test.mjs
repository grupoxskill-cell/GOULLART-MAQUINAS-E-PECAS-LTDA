import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const key = '645f04d0-e06c-4288-83e6-e489c19aa2e0';

function fields(value) {
  const result = {};
  for (let offset = 0; offset < value.length;) {
    const tag = value.slice(offset, offset + 2);
    const lengthText = value.slice(offset + 2, offset + 4);
    assert.match(tag + lengthText, /^\d{4}$/, 'cabeçalho TLV válido');
    const length = Number(lengthText);
    assert.ok(offset + 4 + length <= value.length, `tamanho válido no campo ${tag}`);
    assert.equal(result[tag], undefined, `campo ${tag} único`);
    result[tag] = value.slice(offset + 4, offset + 4 + length);
    offset += 4 + length;
  }
  return result;
}

function crc16(value) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

for (const page of ['espelho/curso.html', '_site/curso.html', '_site/curso/index.html']) {
  test(`${page}: Pix do curso usa chave autorizada, R$ 497,00 e CRC válido`, () => {
    const html = readFileSync(page, 'utf8');
    const payload = html.match(/<textarea\b[^>]*id="pix-code"[^>]*>([^<]+)<\/textarea>/)?.[1];
    assert.ok(payload, 'Pix copia e cola presente');
    const parsed = fields(payload);
    const account = fields(parsed['26']);
    assert.equal(account['00'], 'br.gov.bcb.pix');
    assert.equal(account['01'], key);
    assert.equal(parsed['54'], '497.00');
    assert.equal(parsed['53'], '986');
    assert.equal(parsed['58'], 'BR');
    assert.equal(parsed['59'], 'GOULLART PECAS');
    assert.equal(parsed['60'], 'GOIANIA');
    assert.equal(parsed['63'], crc16(payload.slice(0, -4)));
    assert.match(html, /Chave Pix aleatória:/);
    assert.ok(html.includes(`<span class="pix-key">${key}</span>`));
    assert.doesNotMatch(html, /Pix pelo CNPJ|Chave CNPJ|011429759621000135/);
    assert.match(html, /pix-curso-49700\.svg\?v=pix-20261124/);
    assert.match(html, /Conteúdo liberado após o pagamento e conferência pela equipe/);
  });
}
