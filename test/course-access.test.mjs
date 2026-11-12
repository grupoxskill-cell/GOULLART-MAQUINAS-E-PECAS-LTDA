import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
test('public mirror contains only course sales page and access notices',()=>{
 for(const root of ['espelho','_site']){
  assert.ok(!existsSync(root+'/assets/course/media'));
  const sales=readFileSync(root+'/curso.html','utf8');
  const publicIntro = /<video\b[^>]*><source src="\/media\/junior-goullart-abertura-mobile-v2\.mp4" type="video\/mp4"><a href="\/media\/junior-goullart-abertura-mobile-v2\.mp4">[^<]*<\/a><\/video>/;
  assert.doesNotMatch(sales.replace(publicIntro, ''),/href="\/curso\/midia|<video|id="transcript"/);assert.match(sales,/🔒 Conteúdo liberado após o pagamento/);
  for(const name of ['midia','aluno','apostila','modulo-1','modulo-2','modulo-3','modulo-4','modulo-5']){const html=readFileSync(root+'/curso/'+name+'.html','utf8');assert.doesNotMatch(html,/<video|id="transcript"|Ouvir revisão|<source|<track/);assert.match(html,/Conteúdo exclusivo para alunos/);}
 }
});
