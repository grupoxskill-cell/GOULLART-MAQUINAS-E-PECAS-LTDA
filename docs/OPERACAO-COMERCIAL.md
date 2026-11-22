# GOULLART · revisão comercial de 22 de novembro de 2026

O ponto de entrada da equipe é **ADM → Operação comercial**. O site público ganha **Buscar por orçamento e montar meu catálogo**. A versão 4 do aplicativo **GOULLART — Laudos Técnicos** foi preparada em projeto separado. A chegada dessas funções à produção depende da liberação de cada sistema.

## 30 ajustes para conferir

| Nº | Função | Como conferir e o que depende da operação |
|---:|---|---|
| 1 | Aniversário da máquina | Registrar unidade e data real de uma venda confirmada no CRM. No primeiro aniversário, o texto entra na lista de retornos e permanece até a equipe marcar o atendimento. |
| 2 | Áudio do Júnior | Anexar a gravação original de até 30 s. Júnior pode escutar e aprovar ou recusar. A equipe usa o material liberado no atendimento. |
| 3 | Unidades já vistas | Em Encontros, marcar “Cliente já viu”. A unidade sai das próximas sugestões para o mesmo cliente, inclusive nas referências alternativas mapeadas. |
| 4 | Quero uma igual | O histórico de vendidas e o aviso de uma referência conhecida como vendida oferecem o atalho ao WhatsApp com a identificação da máquina. |
| 5 | Menor preço | Ao registrar a pergunta de preço, o painel prepara três argumentos sobre aplicação, evidências e custo entregue. O envio pelo WhatsApp é manual após aprovação. |
| 6 | Vou pensar | Registrar a fala do cliente e a próxima ação combinada na negociação. |
| 7 | Anúncio antigo | Informar a data da primeira publicação na origem. Acima de 30 dias, a equipe recebe indicação para consultar o vendedor. A data do anúncio não comprova inatividade da máquina. |
| 8 | Conferência do horímetro | Triagem interna sinaliza menos de 250 h/ano para unidade com pelo menos três anos. Registrar estado observado e confrontar com plaqueta, vídeo e manutenção. |
| 9 | Mapa por UF | O ADM calcula a melhor oportunidade conferida dos últimos sete dias para cada estado. A leitura acompanha os novos registros; a equipe precisa alimentar as avaliações. |
| 10 | Nota do achado | Informar preços e links de três unidades distintas comparáveis. A nota sobe um ponto por 3% abaixo da mediana do preço pedido, limitada a 10. Anúncios sem base suficiente ficam sem nota. |
| 11 | Histórico do vendedor | Agrupar ofertas pelo identificador privado e mostrar o status. A venda anterior só aparece como confirmada quando há referência informada pela equipe. |
| 12 | Radar de peças | Cruzar o código de um pedido com o da peça da máquina doadora. A equipe ainda confere aplicação, condição e custo de desmontagem. |
| 13 | Vídeo do horímetro | Anexar à ficha pública um MP4 autorizado de 15 s. O servidor verifica trilha de vídeo e duração de 14 a 16 s. O vídeo real é fornecido pela equipe. |
| 14 | Busca em linguagem natural | Usar, por exemplo, “escavadeira em Goiânia até 3 mil horas”. Máquina sem horímetro informado fica fora desse resultado. |
| 15 | Orçamento | Abrir a página “Máquinas até R$ 300 mil” ou digitar outro teto. Preço sob consulta fica fora do recorte com teto definido. |
| 16 | Verificada pelo Radar | A área de evidências exige confirmação e justificativa interna. A ficha passa a mostrar o selo e a data. A equipe pode retirar o selo. |
| 17 | Audiência de hoje | Na ficha, o contador mede navegadores distintos com identificador diário. Atualizar a página no mesmo navegador preserva a contagem. Uma pessoa pode usar vários aparelhos. |
| 18 | Catálogo próprio | Selecionar três unidades e baixar um PDF de três páginas com as fotos disponíveis. A disponibilidade é consultada de novo antes da geração. |
| 19 | QR do vídeo | O app do laudo gera o QR localmente para o link HTTPS informado. O responsável testa o acesso do destinatário ao vídeo. |
| 20 | Laudo em dois idiomas | Português ou português e inglês para exportação. Os textos técnicos livres têm campo de tradução e as lacunas são sinalizadas. |
| 21 | Estimativa de revenda | Informar dois valores positivos com fontes diferentes. O relatório apresenta a diferença observada, inclusive negativa. A equipe valida comparabilidade e origem dos preços. |
| 22 | Antes e depois | Anexar e identificar separadamente as duas fotos no próprio laudo. |
| 23 | Corrigir e reemitir | Informar dado corrigido e evidência. Ao reemitir, o app numera a nova edição e guarda o conteúdo da anterior. O histórico técnico pode ser baixado em JSON. |
| 24 | Capotas e acessórios | Escolher a modalidade. Cada uma tem oito itens de inspeção. Fichas de máquinas preservam os cem itens. |
| 25 | Painel de uma tela | O início do ADM reúne vendas registradas no dia, entradas no Radar, ofertas e materiais comerciais aguardando decisão. |
| 26 | Previsão de caixa | Informar quanto entraria e em que data para cada negociação aberta. O ADM soma as cinco datas mais próximas e identifica os pedidos considerados. |
| 27 | Entrega | Conferir máquina, documento, chave, manual e foto. O último item requer anexar a evidência no ADM. |
| 28 | Frases do Júnior | Cadastrar texto original para aprovação. As sugestões iniciais funcionam como roteiros. As frases aprovadas ficam disponíveis para copiar. |
| 29 | Erro da semana | Ligar cada ocorrência à correção aplicada e à nova regra, com histórico da semana a partir de segunda-feira. |
| 30 | Férias | A entrada de pedidos e a fila de aprovações têm fluxos independentes. O painel registra a retomada após 48 h sem consulta e conserva as decisões pendentes. |

## Dez diferenciais e a evidência necessária

| Prática GOULLART | O que o sistema permite sustentar |
|---|---|
| 1. Triagem privada | A publicação pelo ADM exige foto. Indícios textuais de sinal antecipado ou boleto de terceiro retêm a oferta para conferência. Horímetro e procedência precisam de verificação humana. |
| 2. Proposta dupla 0006 | O Radar abre impressos separados. A via interna exibe preço de origem, diferença antes dos custos e alertas. A via cliente exige preço e foto da unidade e contém apenas as informações comerciais. |
| 3. Cartão por cliente no Trello | O painel usa o identificador do cliente importado do CRM. A unicidade dos cartões e a sincronização do Trello precisam de conferência nos quadros autorizados. |
| 4. Foto original | A montagem da arte preserva a foto inteira no gerador e no ADM. A equipe seleciona a foto original da unidade. |
| 5. Laudo online | O aplicativo de inspeção registra checklist, fotos e assinaturas. A entrega individual após o checkout comercial ainda requer um teste de ponta a ponta. |
| 6. Compra e margem | O Radar compara preços pedidos e a proposta interna calcula a diferença sobre o preço de venda. A margem realizada de 20% a 30% requer comprovação do negócio e dos custos. |
| 7. Acesso ao decisor | O canal público encaminha à equipe. Atribuir cada caso ao Júnior e comprovar sua participação depende do registro de atendimento. |
| 8. Máquinas e capotas | As duas categorias passam a ter inspeção no mesmo aplicativo. A oferta comercial de cada capota requer ficha e disponibilidade próprias. |
| 9. Atendimento 24 horas com IA | O site mantém atendimento humano e o webhook existente recebe ofertas para o Radar. Cobertura 24 horas e fichamento por Meta AI não foram verificados. |
| 10. Venda com prova | Depois da confirmação da venda, a equipe prepara o cartão público com modelo, destino e prazo. Só a aprovação explícita libera o registro no histórico. Redes sociais têm publicação própria. |

**Para liberar comercialmente:** aprovar a atualização do site/ADM e a versão 4 do aplicativo. Validar a compra de teste com acesso individual ao laudo, carregar três vídeos reais de horímetro nas primeiras fichas e gravar o primeiro áudio do Júnior. Exclusividade nacional e percentuais de lucro dependem de comprovação independente.
