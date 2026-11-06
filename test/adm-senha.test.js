import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = await mkdtemp(join(tmpdir(), "goullart-adm-senha-"));
process.env.DATA_DIR = dir;
after(() => rm(dir, { recursive: true, force: true }));
const { config, garantirConfig, senhaConfere, hashSenha, CUSTO_SENHA } = await import("../lib/auth.js");

test("a senha gerada na instalação e a redefinida pelo operador permitem entrar", async () => {
  const inicial = await garantirConfig();
  assert.equal((await config()).custo, CUSTO_SENHA);
  assert.equal(await senhaConfere(inicial, await config()), true);
  assert.equal(await garantirConfig(), null);
  const nova = "redefinida-apenas-no-teste";
  await garantirConfig(nova);
  assert.equal(await senhaConfere(inicial, await config()), false);
  assert.equal(await senhaConfere(nova, await config()), true);
});

test("instalações que omitiram o custo aceitam a senha correta com ambos os custos históricos", async () => {
  for (const custo of [2 ** 14, CUSTO_SENHA]) {
    const { sal, hash } = hashSenha("senha-sintetica", undefined, custo);
    assert.equal(await senhaConfere("senha-sintetica", { sal, hash }), true);
    assert.equal(await senhaConfere("errada", { sal, hash }), false);
  }
});
