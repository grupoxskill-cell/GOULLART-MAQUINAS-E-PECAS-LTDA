// Ponta a ponta do Radar aprovado: dados.json → publicar.mjs → public/maquinas.json → vitrine do ADM com selo de oferta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function rodar(args, cwd) {
  const p = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let saida = ''; p.stdout.on('data', (d) => (saida += d)); p.stderr.on('data', (d) => (saida += d));
  const [codigo] = await once(p, 'exit');
  return { codigo, saida };
}

test('publicar.mjs grava a máquina aprovada com até 3 fotos, preço do site e selo de mercado, sem dados privados', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'goullart-publicar-'));
  // Cópia mínima do repositório: scripts, lib e um catálogo vazio.
  await cp('scripts', join(raiz, 'scripts'), { recursive: true });
  await cp('lib', join(raiz, 'lib'), { recursive: true });
  await mkdir(join(raiz, 'public', 'maquinas'), { recursive: true });
  await writeFile(join(raiz, 'public', 'maquinas.json'), '[]');
  const foto = 'public/maquinas/radar-komatsu-pc200-2018-1.jpg';
  const dados = join(raiz, 'dados.json');
  await writeFile(dados, JSON.stringify({ codigo: 'RADAR-261104-08', titulo: 'Escavadeira Sany SY215C', categoria: 'Escavadeiras', ano: '2021', horas: '5.000 h',
    local: 'Belo Horizonte/MG', precoSite: 339000, precoMercado: 490000, fotos: [join(process.cwd(), foto), join(process.cwd(), foto), join(process.cwd(), foto), join(process.cwd(), foto)] }));
  const ok = await rodar(['scripts/radar/publicar.mjs', dados], raiz);
  assert.equal(ok.codigo, 0, ok.saida);
  const catalogo = JSON.parse(await readFile(join(raiz, 'public', 'maquinas.json'), 'utf8'));
  assert.equal(catalogo.length, 1);
  const m = catalogo[0];
  assert.equal(m.referencia, 'RADAR-261104-08'); assert.equal(m.ficha, 'radar-2026-11-04'); assert.equal(m.local, 'Belo Horizonte - MG');
  assert.equal(m.preco, 'R$ 339.000'); assert.equal(m.mercado, 'R$ 490.000'); assert.equal(m.desconto, 31);
  assert.equal(m.fotos.length, 3, 'no máximo 3 fotos');
  for (const f of m.fotos) assert.ok((await readFile(join(raiz, 'public', f))).length > 1000, f);
  assert.ok(!('precoMercado' in m) && !('precoSite' in m));
  // Rodar de novo não duplica.
  const denovo = await rodar(['scripts/radar/publicar.mjs', dados], raiz);
  assert.equal(denovo.codigo, 0); assert.match(denovo.saida, /já está no site/);
  assert.equal(JSON.parse(await readFile(join(raiz, 'public', 'maquinas.json'), 'utf8')).length, 1);
  // Dados privados são recusados.
  await writeFile(dados, JSON.stringify({ codigo: 'RADAR-261104-09', titulo: 'X', categoria: 'Escavadeiras', local: 'Goiânia/GO', precoSite: 100000, fotos: [join(process.cwd(), foto)], vendedor: 'Fulano' }));
  const privado = await rodar(['scripts/radar/publicar.mjs', dados], raiz);
  assert.notEqual(privado.codigo, 0); assert.match(privado.saida, /Dados privados/);
  // Sem foto não publica.
  await writeFile(dados, JSON.stringify({ codigo: 'RADAR-261104-10', titulo: 'X', categoria: 'Escavadeiras', local: 'Goiânia/GO', precoSite: 100000, fotos: [] }));
  const semFoto = await rodar(['scripts/radar/publicar.mjs', dados], raiz);
  assert.notEqual(semFoto.codigo, 0); assert.match(semFoto.saida, /Sem foto/);
});
