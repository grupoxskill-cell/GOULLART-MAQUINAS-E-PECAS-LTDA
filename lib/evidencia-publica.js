import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { DATA_DIR, prepararPastas, ler, atualizar } from "./dados.js";

function caixas(buf, inicio=0, fim=buf.length) {
  const lista=[];
  while(inicio+8<=fim){
    const tamanho=buf.readUInt32BE(inicio);
    if(tamanho<8 || inicio+tamanho>fim)break;
    lista.push({tipo:buf.toString("ascii",inicio+4,inicio+8), inicio:inicio+8, fim:inicio+tamanho});
    inicio+=tamanho;
  }
  return lista;
}
export function duracaoVideo(buf) {
  const raiz=caixas(buf), moov=raiz.find(c=>c.tipo==="moov");
  if(!moov || !raiz.some(c=>c.tipo==="ftyp") || !raiz.some(c=>c.tipo==="mdat"))return null;
  const filhos=c=>caixas(buf,c.inicio,c.fim);
  const traks=filhos(moov).filter(c=>c.tipo==="trak");
  const video=traks.some(t=>filhos(t).filter(c=>c.tipo==="mdia").some(m=>filhos(m).some(c=>c.tipo==="hdlr" && c.inicio+12<=c.fim && buf.toString("ascii",c.inicio+8,c.inicio+12)==="vide")));
  const cab=filhos(moov).find(c=>c.tipo==="mvhd");
  if(!video || !cab)return null;
  const v=buf[cab.inicio], pos=cab.inicio+(v===1?20:12);
  if(v>1 || pos+(v===1?12:8)>cab.fim)return null;
  const escala=buf.readUInt32BE(pos);
  return escala ? (v===1?Number(buf.readBigUInt64BE(pos+4)):buf.readUInt32BE(pos+4))/escala : null;
}
const invalido=m=>{throw Object.assign(Error(m),{status:400});};
export async function salvarEvidencia(ref, e) {
  if(typeof e.verificada!=="boolean" || (e.verificada && !(typeof e.base==="string" && e.base.trim().length>=5 && e.base.length<=500)))invalido("Informe a evidência da conferência.");
  let arquivo=null;
  if(e.video){
    const buf=Buffer.from(String(e.video),"base64");
    const segundos=duracaoVideo(buf);
    if(buf.length>8*1024*1024 || !Number.isFinite(segundos) || segundos<14 || segundos>16)invalido("Envie vídeo MP4 do horímetro com 15 segundos (14 a 16 s), até 8 MB.");
    await prepararPastas();
    arquivo="horimetro-"+randomUUID()+".mp4";
    await writeFile(join(DATA_DIR,arquivo),buf,{mode:0o600,flag:"wx"});
  }
  const hoje=new Date().toISOString();
  try{await atualizar("evidencias-catalogo",{},d=>{
    d[ref]={verificada:e.verificada,base:e.verificada?e.base.trim():"",em:hoje,video:arquivo||(e.removerVideo?null:d[ref]?.video)||null};
  });}catch(err){if(arquivo)await unlink(join(DATA_DIR,arquivo)).catch(()=>{});throw err;}
}
export async function evidenciaPublica(ref) {
  const e=(await ler("evidencias-catalogo",{}))[ref]||{};
  return {verificada:e.verificada===true,conferidaEm:e.verificada?e.em?.slice(0,10):null,video:e.video?"/api/interesse?video="+encodeURIComponent(ref):null};
}
export async function responderVideo(req,res,ref) {
  const e=(await ler("evidencias-catalogo",{}))[ref];
  if(!e || !/^horimetro-[a-f0-9-]{36}\.mp4$/.test(e.video||""))return res.writeHead(404).end();
  let buf;try{buf=await readFile(join(DATA_DIR,e.video));}catch{return res.writeHead(404).end();}
  const headers={"Content-Type":"video/mp4","Cache-Control":"no-store","Accept-Ranges":"bytes"};
  let bytes=buf, status=200;
  if(req.headers.range){
    const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    const ini=m?Number(m[1]):NaN, fim=m?.[2]?Math.min(Number(m[2]),buf.length-1):buf.length-1;
    if(!Number.isSafeInteger(ini)||ini>fim)return res.writeHead(416,{"Content-Range":"bytes */"+buf.length}).end();
    headers["Content-Range"]="bytes "+ini+"-"+fim+"/"+buf.length;
    bytes=buf.subarray(ini,fim+1);status=206;
  }
  res.writeHead(status,{...headers,"Content-Length":bytes.length}).end(req.method==="HEAD"?undefined:bytes);
}
