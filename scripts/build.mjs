import { cp, mkdir, rm, writeFile } from "node:fs/promises";
await rm("_site", { recursive: true, force: true });
await mkdir("_site", { recursive: true });
await cp("public", "_site", { recursive: true });
await cp("data/catalogo.json", "_site/catalogo.json");
await writeFile("_site/.nojekyll", "");
console.log("Site estático gerado em _site");
