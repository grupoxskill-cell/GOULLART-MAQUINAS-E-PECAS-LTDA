# O que falta no sistema GOULLART

**Diagnóstico de 22/11/2026.** A leitura dos arquivos versionados descreve o sistema implementado. Volume de estoque disponível, conexões de contas, entrega do laudo e execução das rotinas precisam de evidência na operação. Os pedidos, registros de aprovação e contatos de clientes ficam no ambiente privado.

## Onde começar

| Evidência no repositório | Ação que ajuda a vender |
| --- | --- |
| Na base histórica de 56 fichas de máquinas, 51 têm menos de três entradas em `fotos`, 40 não têm `local`, dez têm `horas` vazio e uma tem preço vazio. A idade da ficha e a categoria afetam a leitura. | Começar por máquina com comprador em andamento. Confirmar município, disponibilidade e os dados que fazem sentido para a categoria. Obter fotos com autorização. |
| Na base de referências de peças, das 93 linhas, 87 estão sem código e 90 sem aplicação. A busca por nome, código e aplicação já existe. | Completar referências dos pedidos em aberto, começando pelas peças de rodante. |
| A comparação de preço no código pode aceitar um único comparável e uma diferença de ano de até três anos. O horímetro da máquina não entra no cálculo. | Sustentar cada alegação de desconto com ao menos três ofertas comparáveis, ano até dois anos de diferença, horas e preço final ao comprador. |
| Fichas históricas e espelho da vitrine são conjuntos com sobreposição. Os campos e os números diferem. | Reconciliar pela referência antes de divulgar quantidades ou disponibilidade. |

Contagens sobre [fichas históricas de máquinas](../public/maquinas.json), [base de referências de peças](../data/catalogo.json), [espelho da vitrine](../espelho/api/catalog.json), [busca de peças](../public/catalogo.js) e [comparação no Radar](../lib/radar.js), na revisão `449ff0f`. As quantidades descrevem campos nessas bases.

## 30 ações para a operação

As ações abaixo incluem correções verificadas, decisões de produto e verificações para as quais a operação deve fornecer evidência. O critério de conclusão cabe na mesma linha do pedido.

| Nº | Ação | Critério de conclusão |
| --- | --- | --- |
| 1 | Conciliar os dois canais comerciais com o CRM. | Última conversa conferida por canal, data e pedidos pendentes identificados no painel privado. |
| 2 | Priorizar compradores que aguardam retorno. | Todo pedido ativo tem responsável, prazo e próxima ação. |
| 3 | Reconciliar referências do site, do Pátio e do Radar. | Uma ficha principal por máquina e registro privado das associações. |
| 4 | Reconfirmar disponibilidade e local das máquinas em proposta. | Cidade/UF e data da última confirmação registradas. |
| 5 | Completar horas ou quilometragem conforme o equipamento. | Cada ficha prioritária traz unidade, data da leitura e fonte ou pendência. |
| 6 | Completar as galerias usadas em propostas. | Três fotos originais e autorizadas da mesma unidade, com frente, lateral e detalhes. |
| 7 | Revisar textos e preços herdados de terceiros. | Cada valor tem validação interna e cada ressalva tem decisão de manter, corrigir ou suspender. |
| 8 | Testar proposta em PDF e alerta de máquina procurada. | Uma solicitação de teste cria pedido no CRM e uma proposta válida leva referência, condições e validade. |
| 9 | Homologar a entrada do Radar no WhatsApp oficial. | Anúncio de teste autorizado chega uma vez à fila privada e recebe retorno ao aprovador. |
| 10 | Melhorar a deduplicação entre portais. | O mesmo equipamento anunciado em dois sites aparece uma vez, com as duas fontes privadas. |
| 11 | Qualificar o comparativo de preço e guardar histórico. | Três fontes independentes, modelo compatível, ano ±2 e horas próximas sustentam o percentual sobre o preço final. |
| 12 | Acompanhar idade e motivo de recusa das ofertas. | Painel mostra data, motivo e próxima conferência das pendências. |
| 13 | Conciliar aprovações das fichas históricas. | Casos sem prova ficam para decisão de Júnior, com o registro restrito ao painel. |
| 14 | Registrar inspeção, visita e vídeo de funcionamento. | Cada visita acordada tem data e responsável. Um vídeo autorizado fica ligado à unidade correta. |
| 15 | Estimar o frete na proposta. | Origem, destino, condições e validade da cotação de transporte identificados. |
| 16 | Unificar navegação e visual do catálogo e da ficha no celular. | Uma mesma máquina abre com referência consistente, três fotos legíveis quando disponíveis e contato contextual. |
| 17 | Completar a busca de peças que já funciona. | Nas referências priorizadas, código e aplicação confirmados aparecem na consulta por modelo ou código. |
| 18 | Padronizar a arte do Radar. | Prévia aprovada usa três fotos inteiras, dados confirmados e revisão no formato de publicação. |
| 19 | Conferir o laudo na jornada de compra. | Compra de teste autorizada demonstra recebimento e abertura. Testar separadamente captura offline, plaqueta, fotos e vídeos pedidos. |
| 20 | Conferir mapa do site e Search Console. | Com acesso à propriedade correta do site, registrar URLs válidas, cobertura e data de rastreamento. |
| 21 | Testar conteúdo regional e por marca onde há oferta real. | Página com inventário confirmado, texto próprio e medição de buscas, sem criar páginas vazias. |
| 22 | Sustentar a cadência editorial e as avaliações de clientes. | Notícia ou guia traz fonte e data. Todo depoimento selecionado possui autorização de uso. |
| 23 | Medir o funil por semana. | Painel separa ofertas, cliques, pedidos, propostas e vendas confirmadas. |
| 24 | Comparar procura e prazo de atendimento. | Lista semanal identifica o que teve procura e ficou sem retorno na data combinada. |
| 25 | Conferir proteção da branch e acessos administrativos. | Responsável autorizado verifica revisores, permissões e opções de segundo fator. |
| 26 | Confirmar publicação técnica e recuperação. | Registro do deploy identifica versão, teste do endereço final e restauração de cópia em ambiente separado. |
| 27 | Localizar os responsáveis pelas contas de domínio, servidor e Google. | Registro privado identifica proprietário, acesso autorizado e procedimento de recuperação. |
| 28 | Acompanhar entrega e pós-venda. | Documentos, nota e transporte conferidos, entrega e responsável registrados. |
| 29 | Vincular revisão e peças à máquina entregue. | Contato de pós-venda autorizado usa data ou horas combinadas e aplicação confirmada. |
| 30 | Registrar satisfação e baixas. | Pendência de entrega tem tratativa e ficha de máquina vendida é conferida na vitrine, ficha e sitemap. |

Outras ideias do plano original, como simulador de financiamento, comparador de fichas, versão em espanhol e atalho do ADM no celular, podem entrar no ciclo seguinte após definir público, dados e responsável.

## Dez diferenciais demonstráveis da GOULLART

Tracbel publica classificados com avaliação e comparação de máquinas. A MAQ360 oferece anúncios com inspeções técnicas. O que a GOULLART pode apresentar com evidência é como suas ferramentas funcionam em conjunto. [Tracbel](https://www.tracbel.com.br/blog/conheca-portal-classificados-seminovos/) · [MAQ360](https://maq360.com.br/)

| Nº | Recurso | O que mostrar |
| --- | --- | --- |
| 1 | Radar com aprovação por código | A integração implementa SIM ou NÃO do aprovador para uma oferta específica e evita repetir mensagens. A ativação depende de teste com a conta autorizada. [Fluxo](WHATSAPP-RADAR.md) |
| 2 | Formação de preço no Radar | O código calcula preço final com a margem configurada e gera a ficha pública com os campos comerciais permitidos. [Cálculo](../lib/radar.js) |
| 3 | Encontros entre pedido e máquina | O sistema considera tipo, marca, modelo e orçamento e informa as razões de cada sugestão. [Encontros](../lib/encontros.js) |
| 4 | Pedido de peça com referência | O comprador pode pesquisar nome, código ou aplicação quando cadastrados e abrir uma cotação com a peça identificada. [Busca e cotação](../public/catalogo.js) |
| 5 | Fotografias por família de peça | O catálogo associa 17 famílias a imagens de referência, distinguindo peças semelhantes da unidade exata cotada. [Famílias](../espelho/parts-reference.js) |
| 6 | Arte da máquina condicionada à foto | O gerador de arte de feed exige uma foto da unidade e usa o código e os dados fornecidos. [Gerador](../scripts/radar/arte.mjs) |
| 7 | Tratamento dos JPEGs do Radar | A rotina remove metadados como GPS e conserva a orientação da foto. [Processamento](../lib/radar-entrada.js) |
| 8 | Ficha individual que acompanha a conversa | A ficha prepara prévia social com imagem e preço quando disponível. O contato pelo WhatsApp leva a referência e o endereço da ficha. [Ficha](../lib/paginas.js) |
| 9 | Interesse medido por máquina | Visitas e cliques ficam agrupados por referência, com janela de repetição e resumo dos últimos dias. [Contador](../lib/interesse.js) |
| 10 | Curso de vendas de Júnior Goullart | A página descreve cinco módulos de venda de máquinas online com atividade e revisão em vídeo. [Curso](../espelho/curso.html) |

Para baixa de máquina, o sistema atualiza as próprias páginas e o sitemap. A data em que a alteração aparece na pesquisa depende de novo rastreamento. [Orientação do Google](https://developers.google.com/search/help/crawling-index-faq?hl=pt-br)
