import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const window = {};
runInNewContext(await readFile("_site/paginas-maquinas.js", "utf8"), { window });
const paginas = window.GoullartMachinePages;

for (const [codigo, ficha] of Object.entries({
  "GOUL-330": "GOUL-306",
  "GOUL-331": "GOUL-307",
  "GOUL-333": "GOUL-315",
  "GOUL-334": "GOUL-316",
  "GOUL-405": "GOUL-281",
})) {
  test(codigo + " abre a ficha " + ficha, async () => {
    assert.match(paginas[ficha], /^\/maquina\/.+\.html$/);
    assert.equal(paginas[codigo], paginas[ficha]);
    const html = await readFile("_site" + paginas[codigo], "utf8");
    assert.ok(html.includes(ficha));
  });
}
