# Correção de navegação e concorrência — 04/11/2026

Base: `1732a7d1d5d71553f18e0c99361aa5eb74f94032` (master confirmado novamente antes do commit).

## Alterações

- Nas cópias sem extensão de categorias e ofertas, o atalho “Ir para os anúncios” aponta explicitamente para a rota da própria categoria/ofertas, com `#catalog-page-list`. Isso neutraliza o efeito de `<base href="/">`, sem mudar os recursos relativos, o layout ou os originais `.html`.
- `alterarPublicacao` e `alterarRadar` executam leitura, validação, alteração e gravação dentro de `atualizar`.
- Criação, edição, exclusão, publicação, despublicação e descarte de Radar/Pátio usam a mesma fila por arquivo da entrada automática. Respostas, campos privados e regras de publicação foram preservados.

## Validação executada nesta revisão

- `npm run build`: sucesso; 40 páginas de máquinas geradas pelo build.
- `npm test` após build: **56 testes, 56 aprovados, 0 falhas**.
- `git diff --check`: sucesso.
- Nove testes novos usam exclusivamente `DATA_DIR` temporário e dados sintéticos. Cobrem edições em registros distintos (10 rodadas), criações concorrentes, publicação com edição, exclusão com edição, chegada de oferta automática durante uma edição bloqueada e validação sem gravação parcial.
- Na cópia isolada do commit-base, esses mesmos testes produzem **8 falhas e 1 aprovação**. O teste de chegada automática reproduz a perda da terceira ficha antes da correção.
- O teste do build verifica todas as categorias e ofertas em `.html`, rota sem extensão, barra final e `/index.html`: resolução com `new URL` e o `<base>` real, caminho esperado e existência de `<section id="catalog-page-list">`. Falha no commit-base porque `/ofertas/index.html` resolve para `/`.
- Comparação estática entre os builds base/corrigido: **106 documentos HTML, 2.568 links internos examinados; nenhum novo diagnóstico e 18 fragmentos inválidos eliminados**. O verificador resolve `href` contra o `base`, procura arquivo direto/`.html`/`index.html` e IDs estáticos. Exclui endpoints ADM/API/fotos. Restam 595 diagnósticos preexistentes (613 antes), incluindo alvos criados por JavaScript: não são 595 erros de navegador confirmados. Não houve crawl externo nem certificação de todos os links dinâmicos.

A primeira execução de `npm test` sem build teve 55 aprovações e uma falha: o teste preexistente `course-access.test.mjs` lê `_site/curso.html`, ausente em checkout limpo. Após gerar o build, a suíte completa passou. Essa dependência de ordem foi registrada, sem alterar testes alheios à correção.

## Catálogo e achados fora desta alteração

- A fonte estática contém 10 máquinas, todas com `retentionPolicy: owner_confirmation`. A importação marca `noSite` pela presença do ID nessa fonte, e não pelo campo `published` do backup. Não foram importados backups nem modificados inventário, aprovação, elegibilidade ou exclusão deliberada de cavalo mecânico dos destaques da homepage.
- O relato de logo Peças sem navegação em um deep link não foi reproduzido em navegador nesta execução. O HTML usa hash, mas `app.js` instala um clique que navega para `/?area=pecas`, descartando o item antigo. Sem JavaScript funcional, a prioridade da área explícita sobre o hash pode conservar a área anterior. Exige reprodução com console/eventos antes de mudar outros scripts.
- `espelho/publicacoes.js` filtra por `sourceKey === 'whatsapp'`, enquanto build/backend retiram essa informação privada. É uma incompatibilidade confirmada por inspeção e pode explicar a seção Publicações vazia. Correção separada deve definir um marcador público neutro (ou validar `publicationId`) e testar sua passagem pelo catálogo do ADM e a elegibilidade. **Não expor `sourceKey` nem publicar conteúdo adicional.**
- A fila de `lib/dados.js` protege operações no mesmo processo Node; não é um bloqueio entre múltiplos processos. Importações intencionais de bases inteiras continuam substituindo a base. A deduplicação da entrada automática continua sendo feita antes de sua fila e não foi ampliada neste PR.

Nenhuma requisição mutante contra produção, publicação de anúncios, alteração de dados de clientes, merge ou deploy. Os únicos dados gravados para testar foram sintéticos em diretórios temporários. O build ficou local; o workflow de publicação existente só reage a master.
