import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'goullart-dados-'));
const { ler, gravar, DATA_DIR } = await import('../lib/dados.js');

test('arquivo corrompido volta para a cópia da gravação anterior', async () => {
  await gravar('radar', [{ id: 'a' }]);
  await gravar('radar', [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(JSON.parse(await readFile(join(DATA_DIR, 'radar.json.anterior'), 'utf-8')), [{ id: 'a' }]);
  assert.equal((await stat(join(DATA_DIR, 'radar.json'))).mode & 0o777, 0o600);
  assert.equal((await stat(join(DATA_DIR, 'radar.json.anterior'))).mode & 0o777, 0o600);
  await writeFile(join(DATA_DIR, 'radar.json'), '[{"id":"a"},{"i');
  assert.deepEqual(await ler('radar', []), [{ id: 'a' }]);
});

test('sem cópia anterior, o erro de arquivo corrompido continua aparecendo', async () => {
  await writeFile(join(DATA_DIR, 'patio.json'), '{quebrado');
  await assert.rejects(() => ler('patio', []), SyntaxError);
});
