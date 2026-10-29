// Cria a senha do ADM se ainda não existir; com --nova, troca por uma senha nova.
// Uso: DATA_DIR=/caminho node scripts/criar-senha.mjs [--nova]
import { randomBytes } from "node:crypto";
import { garantirConfig } from "../lib/auth.js";
import { DATA_DIR, prepararPastas } from "../lib/dados.js";

await prepararPastas();
const senha = await garantirConfig(process.argv.includes("--nova") ? randomBytes(9).toString("base64url") : undefined);

if (senha) {
  console.log(`SENHA DO ADM: ${senha}`);
  console.log("Guarde esta senha. Ela não aparece de novo; troque depois em ADM > Configurações.");
} else {
  console.log(`ADM já configurado em ${DATA_DIR}; senha mantida.`);
}
