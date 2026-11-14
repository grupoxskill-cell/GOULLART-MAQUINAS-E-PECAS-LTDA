import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'goullart-ips-'));
const { ipDesconhecido, registrarEvento } = await import('../lib/auditoria.js');

test('IP conhecido não volta a gerar aviso, mesmo depois de 500 eventos na auditoria', async () => {
  assert.equal(await ipDesconhecido('189.1.1.1'), true);
  assert.equal(await ipDesconhecido('189.1.1.1'), false);
  for (let i = 0; i < 510; i++) await registrarEvento('radar_editado', { id: String(i) });
  assert.equal(await ipDesconhecido('189.1.1.1'), false);
  assert.equal(await ipDesconhecido('200.2.2.2'), true);
});
