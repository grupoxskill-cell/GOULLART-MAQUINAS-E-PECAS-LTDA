import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, prepararPastas } from "./dados.js";

const tipos = { mp3: "audio/mpeg", m4a: "audio/mp4", webm: "audio/webm", ogg: "audio/ogg", wav: "audio/wav" };
export async function salvarVoz(e) {
  const bytes = Buffer.from(typeof e.base64 === "string" ? e.base64 : "", "base64");
  const texto = (inicio, fim) => bytes.toString("ascii", inicio, fim);
  const ext = texto(0,3)==="ID3" || (bytes[0]===255 && (bytes[1]&224)===224) ? "mp3"
    : texto(4,8)==="ftyp" ? "m4a" : texto(0,4)==="OggS" ? "ogg" : bytes.subarray(0,4).toString("hex")==="1a45dfa3" ? "webm"
    : texto(0,4)==="RIFF" && texto(8,12)==="WAVE" ? "wav" : "";
  if (!ext || bytes.length<32 || bytes.length>3*1024*1024) throw Object.assign(new Error("Selecione um áudio de até 3 MB."), {status:400});
  await prepararPastas();
  const arquivo = "voz-"+randomBytes(16).toString("hex")+"."+ext;
  await writeFile(join(DATA_DIR,arquivo),bytes,{mode:0o600,flag:"wx"});
  return arquivo;
}
export async function servirVoz(res, arquivo) {
  if (!/^voz-[a-f0-9]{32}\.(mp3|m4a|webm|ogg|wav)$/.test(arquivo)) return res.writeHead(404).end();
  try {
    const bytes=await readFile(join(DATA_DIR,arquivo));
    res.writeHead(200,{"Content-Type":tipos[arquivo.split(".").pop()],"Cache-Control":"private, no-store"}).end(bytes);
  } catch { res.writeHead(404).end(); }
}
