// Correções da revisão de 14/11/2026: fotos da aba Publicações, apagar máquina, metadados das fotos
// do Radar e limite de conferências de senha em paralelo.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pasta = await mkdtemp(join(tmpdir(), "goullart-revisao-"));
process.env.DATA_DIR = pasta;
const { prepararPastas, gravar, ler, FOTOS_DIR } = await import("../lib/dados.js");
const { criarCookie, hashSenha, senhaConfere, OCUPADO } = await import("../lib/auth.js");
const { servirFoto, rotaAdm } = await import("../lib/adm.js");
const { semMetadados } = await import("../lib/radar-entrada.js");

const segredo = "segredo-de-teste-nao-real";
const foto = (c) => `fotos/${c.repeat(24)}.jpg`;
await prepararPastas();
for (const c of "abcde") await writeFile(join(FOTOS_DIR, foto(c).slice(6)), Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { mode: 0o600 });
await gravar("config", { segredo });
await gravar("radar", []);
await gravar("patio", [
  { id: "aaaaaaaaaaaaaaaa", titulo: "Maquina A", fotos: [foto("c")], arte: foto("d") },
  { id: "bbbbbbbbbbbbbbbb", titulo: "Maquina B", fotos: [foto("e")] },
]);
await gravar("publicacoes", { itens: [
  { id: "PUB1", noSite: true, imagens: ["/" + foto("a")] },
  { id: "PUB2", noSite: false, imagens: ["/" + foto("b")] },
] });
after(() => rm(pasta, { recursive: true, force: true }));

function resposta() {
  return {
    status: null, headers: {}, body: undefined,
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this; },
    end(body) { this.body = body; return this; },
  };
}
const existe = (f) => access(join(FOTOS_DIR, f.slice(6))).then(() => true, () => false);

test("foto enviada na aba Publicações aparece no site quando a publicação está no site", async () => {
  const noSite = resposta();
  await servirFoto({ method: "GET", headers: {} }, noSite, "/" + foto("a"));
  assert.equal(noSite.status, 200);
  const foraDoSite = resposta();
  await servirFoto({ method: "GET", headers: {} }, foraDoSite, "/" + foto("b"));
  assert.equal(foraDoSite.status, 404);
});

test("apagar máquina devolve e registra a máquina apagada (não a seguinte) e tira a arte do disco", async () => {
  const res = resposta();
  const req = { method: "DELETE", headers: { cookie: criarCookie(segredo, true).split(";")[0] }, socket: { remoteAddress: "127.0.0.1" } };
  await rotaAdm(req, res, "/adm/api/patio/aaaaaaaaaaaaaaaa");
  assert.equal(res.status, 200);
  const corpo = JSON.parse(res.body);
  assert.equal(corpo.titulo, "Maquina A");
  assert.equal(corpo.id, "aaaaaaaaaaaaaaaa");
  assert.deepEqual((await ler("patio", [])).map((m) => m.titulo), ["Maquina B"]);
  assert.equal(await existe(foto("c")), false, "foto apagada");
  assert.equal(await existe(foto("d")), false, "arte apagada");
  assert.equal(await existe(foto("e")), true, "foto da outra máquina fica");
});

test("fotos do Radar perdem EXIF, IPTC e comentários e mantêm a imagem", () => {
  const seg = (m, dados) => Buffer.concat([Buffer.from([0xff, m, 0, dados.length + 2]), Buffer.from(dados)]);
  const app0 = seg(0xe0, "JFIF\0"), exif = seg(0xe1, "Exif\0\0GPS-e-dono"), iptc = seg(0xed, "Photoshop"), com = seg(0xfe, "olx");
  const imagem = Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
  const entrada = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, exif, iptc, com, imagem]);
  assert.deepEqual(semMetadados(entrada), Buffer.concat([Buffer.from([0xff, 0xd8]), app0, imagem]));
  assert.throws(() => semMetadados(Buffer.from([0xff, 0xd8, 0x00, 0x01, 0x02])), /inválida/);
});

test("muitas conferências de senha ao mesmo tempo: o excesso recebe OCUPADO sem travar o site", async () => {
  const cfg = hashSenha("senha-de-teste-longa", undefined, 2 ** 10);
  const resultados = await Promise.all(Array.from({ length: 14 }, () => senhaConfere("errada", cfg)));
  assert.equal(resultados.filter((r) => r === OCUPADO).length, 4); // 2 rodando + 8 na fila
  assert.equal(resultados.filter((r) => r === false).length, 10);
  assert.equal(await senhaConfere("senha-de-teste-longa", cfg), true, "depois da fila, volta ao normal");
});
