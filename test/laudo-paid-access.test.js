import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const checkout = 'https://laudo.goullartmaquinaspesadas.com.br/';
const oldPdf = 'assets/exemplo-laudo/exemplo-goullart.pdf';

test('publicação não distribui o PDF de laudo sem confirmação de pagamento', () => {
  for (const root of ['public', '_site']) {
    assert.equal(existsSync(`${root}/${oldPdf}`), false, `${root}: o PDF antigo não pode continuar público`);
    const reportPdfs = readdirSync(root, { recursive: true }).filter(path => /laudo/i.test(path) && /\.pdf$/i.test(path));
    assert.deepEqual(reportPdfs, [], `${root}: laudos em PDF pertencem à entrega autenticada, fora dos assets`);
  }
});

test('home e notícia encaminham a compra de R$ 49,90 sem promessa de PDF grátis', () => {
  for (const name of ['index.html', 'noticia-laudo-tecnico-pdf.html']) {
    const html = readFileSync(`_site/${name}`, 'utf8');
    assert.ok(html.includes(checkout), name);
    assert.match(html, /R\$ 49,90/, name);
    assert.doesNotMatch(html, /(?:exemplo|laudo|PDF)[^<>]{0,80}(?:grátis|gratuit)|(?:grátis|gratuit)[^<>]{0,80}(?:laudo|PDF)/i, name);
    assert.ok(!html.includes(oldPdf), name);
  }
});

test('o endereço antigo explica Pix confirmado e não contém modelo nem download', () => {
  const html = readFileSync('_site/laudo-aberto.html', 'utf8');
  assert.ok(html.includes(checkout));
  assert.match(html, /somente após a confirmação do recebimento do Pix/);
  assert.match(html, /Pagamento pendente, agendado ou em análise não libera o PDF/);
  assert.doesNotMatch(html, /(?:href|src)=["'][^"']*(?:\.pdf|data:application\/pdf)/i);
  assert.doesNotMatch(html, /<embed\b|<object\b|<iframe\b|%PDF-|JVBERi0|Hyundai R140/);
});
