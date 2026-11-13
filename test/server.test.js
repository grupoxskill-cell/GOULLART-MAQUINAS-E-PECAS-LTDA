// Testes do servidor: rodam com `npm test`, sem dependências e sem chamar a OpenAI.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";

const PORT = 3917;
let server;

before(async () => {
  server = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(PORT), OPENAI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => String(d).includes("Servidor rodando") && resolve());
    server.on("exit", (code) => reject(new Error(`servidor saiu com código ${code}`)));
  });
});

after(() => server.kill());

// fetch normaliza o caminho, então usamos http.request para mandar o endereço cru.
function get(path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: PORT, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("endereço malformado não derruba o servidor", async () => {
  assert.equal((await get("/%E0%A4%A")).status, 400);
  assert.equal((await get("/health")).status, 200);
});

test("bloqueia acesso a arquivos fora da pasta public", async () => {
  for (const path of ["/../server.js", "/..%2fserver.js", "/..%2f.env", "/%2e%2e/package.json"]) {
    const res = await get(path);
    assert.ok([403, 404].includes(res.status), `${path} respondeu ${res.status}`);
    assert.ok(!res.body.includes("OPENAI_API_KEY"), path);
  }
});

test("página inicial sai com cabeçalhos de segurança", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
});

test("health avisa quando o chat está sem chave", async () => {
  const res = await get("/health?x=1");
  assert.deepEqual(JSON.parse(res.body), { ok: true, chat: false });
});

test("catálogo é servido como lista", async () => {
  const res = await get("/api/catalogo");
  assert.ok(Array.isArray(JSON.parse(res.body)));
});

test("chat aceita só POST", async () => {
  assert.equal((await get("/api/chat")).status, 405);
  assert.equal((await get("/", { method: "DELETE" })).status, 405);
});
