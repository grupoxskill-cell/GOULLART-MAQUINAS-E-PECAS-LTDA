// The public mirror has no authentication. Never export paid lessons or media.
import {rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const STUDENT_URL='https://catalogo-goullart-pesados-brasil.fitbun9.chatgpt.site/curso/aluno';
export const lockedPage=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Acesso ao curso | GOULLART</title><link rel="stylesheet" href="/course-library.css?v=1"></head><body><header><a href="/curso"><img src="/assets/brands/goullart-pesados-original.svg" alt="GOULLART Pesados" width="210" height="98"></a></header><main><h1>Conteúdo exclusivo para alunos</h1><p>Aulas, vídeos, narração e apostilas ficam disponíveis somente após a confirmação do pagamento e a liberação pela equipe.</p><p><a class="button" href="${STUDENT_URL}">Já paguei: entrar na área do aluno ↗</a></p><p><a href="/curso#pix">Conhecer o curso e pagar</a></p><p>Entre com a conta informada à equipe. Enviar um comprovante não libera automaticamente o curso.</p></main></body></html>`;
export async function protectCourse(root){
 await rm(join(root,'assets/course/media'),{recursive:true,force:true});
 await rm(join(root,'curso'),{recursive:true,force:true});
 await mkdir(join(root,'curso'),{recursive:true});
 for(const name of ['midia','aluno','apostila',...Array.from({length:5},(_,i)=>'modulo-'+(i+1))])await writeFile(join(root,'curso',name+'.html'),lockedPage);
 for(const name of ['course-media.js','course-module-route.js'])await rm(join(root,name),{force:true});
 let html=await readFile(join(root,'curso.html'),'utf8');
 html=html.replace(/<a class="text-link" href="\/curso\/midia\?modulo=[1-5]">[^<]*<\/a>/g,'<span class="text-link">🔒 Conteúdo liberado após o pagamento</span>');
 if(!html.includes(STUDENT_URL))html=html.replace('<section class="buy-section"',`<p style="text-align:center;padding:20px"><a class="text-link" href="${STUDENT_URL}">Já paguei: entrar na área do aluno ↗</a></p><section class="buy-section"`);
 await writeFile(join(root,'curso.html'),html);
}
