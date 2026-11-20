// Revisão de 20/11/2026: vincular pedido a radar com CRM importado sem negociações.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pasta = await mkdtemp(join(tmpdir(), "goullart-revisao-1120-"));
process.env.DATA_DIR = pasta;
const { prepararPastas, gravar } = await import("../lib/dados.js");
const { criarRadar, vincularPedido } = await import("../lib/publicacoes.js");
await prepararPastas();
after(() => rm(pasta, { recursive: true, force: true }));

test("CRM sem negociações: vincular pedido responde 409 em vez de quebrar com 500", async () => {
  await gravar("crm", { importadoEm: new Date().toISOString() });
  const radar = await criarRadar("Hyundai R220");
  await assert.rejects(vincularPedido(radar.id, "D1", true), (e) => e.status === 409);
});
