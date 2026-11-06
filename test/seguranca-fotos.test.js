// Testes de privacidade do repositório (não substituem testes no servidor de produção).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pasta = await mkdtemp(join(tmpdir(), "goullart-security-"));
process.env.DATA_DIR = pasta;
const { prepararPastas, gravar, FOTOS_DIR } = await import("../lib/dados.js");
const { criarCookie } = await import("../lib/auth.js");
const { servirFoto, rotaAdm } = await import("../lib/adm.js");

const fotoPrivada = "fotos/aaaaaaaaaaaaaaaaaaaaaaaa.jpg";
const fotoPublicada = "fotos/bbbbbbbbbbbbbbbbbbbbbbbb.jpg";
const arteInterna = "fotos/cccccccccccccccccccccccc.jpg";
const segredo = "segredo-de-teste-nao-real";
await prepararPastas();
for (const p of [fotoPrivada, fotoPublicada, arteInterna]) {
  await writeFile(join(FOTOS_DIR, p.slice(6)), Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { mode: 0o600 });
}
await gravar("config", { segredo });
await gravar("radar", [
  { id: "private", status: "novo", fotos: [fotoPrivada], arte: arteInterna },
  { id: "published", status: "publicado", fotos: [fotoPublicada, arteInterna], arte: arteInterna }
]);
await gravar("patio", []);

function resposta() {
  return {
    status: null, headers: {}, body: undefined,
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this; },
    end(body) { this.body = body; return this; }
  };
}
function reqAutenticada() {
  return { method: "GET", headers: { cookie: criarCookie(segredo, true).split(";")[0] } };
}

test("visitante anônimo não abre JPEG privado", async () => {
  const res = resposta();
  await servirFoto({ method: "GET", headers: {} }, res, "/" + fotoPrivada);
  assert.equal(res.status, 404);
});
test("visitante anônimo não abre arte interna, mesmo de máquina publicada", async () => {
  const res = resposta();
  await servirFoto({ method: "GET", headers: {} }, res, "/" + arteInterna);
  assert.equal(res.status, 404);
});
test("visitante anônimo abre somente foto vinculada a máquina publicada", async () => {
  const res = resposta();
  await servirFoto({ method: "GET", headers: {} }, res, "/" + fotoPublicada);
  assert.equal(res.status, 200);
  assert.match(res.headers["Cache-Control"], /public/);
});
test("administrador autenticado abre foto privada sem cache público", async () => {
  const res = resposta();
  await servirFoto(reqAutenticada(), res, "/" + fotoPrivada);
  assert.equal(res.status, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
});
test("o painel usa fotos dentro do caminho do cookie, sem liberar o endereço para visitantes", async () => {
  const url = "/adm/" + fotoPrivada;
  const anon = resposta();
  await rotaAdm({ method: "HEAD", headers: {} }, anon, url);
  assert.equal(anon.status, 404);
  const admin = resposta();
  await rotaAdm(reqAutenticada(), admin, url);
  assert.equal(admin.status, 200);
  assert.equal(admin.headers["Cache-Control"], "private, no-store");
});
test("diretórios privados permanecem restritos ao usuário do serviço", async () => {
  assert.equal((await stat(pasta)).mode & 0o777, 0o700);
  assert.equal((await stat(FOTOS_DIR)).mode & 0o777, 0o700);
});
test("limpar dados temporários de teste", async () => {
  await rm(pasta, { recursive: true, force: true });
});
