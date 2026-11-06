import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
test("layout público injeta CSS dos cards no build", async () => {
  const build = await readFile("scripts/preparar-espelho.mjs", "utf8");
  assert.match(build, /card-highlights\.css\?v=20261104/);
  assert.match(build, /t\.includes\(\x27id="products"\x27\)/);
  assert.doesNotMatch(build, /conteúdo\.\\n  if/);
  assert.doesNotMatch(build, /20261104<\/head>\x27\);\\n/);
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", "scripts/preparar-espelho.mjs"]));
});
test("preço permanece visível e respeita redução de movimento", async () => {
  const css = await readFile("espelho/card-highlights.css", "utf8");
  assert.match(css, /\.products \.product \.price/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none/);
  assert.doesNotMatch(css, /opacity:\s*0\s*;/);
  assert.doesNotMatch(css, /visibility:\s*hidden/);
});
test("vitrine usa as classes de título e preço existentes", async () => {
  const js = await readFile("espelho/app.js", "utf8");
  assert.ok(js.includes('<h3>${esc(i.title)}</h3>'));
  assert.ok(js.includes('<p class="price">'));
});
