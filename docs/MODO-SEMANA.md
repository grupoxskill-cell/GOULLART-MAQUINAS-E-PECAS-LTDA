# Modo Semana GOULLART

Rotina fixa da operação, valendo a partir de domingo, 22/11/2026. O objetivo é **Júnior gastar o mínimo de tempo e decidir só o que é dele**: aprovar, negociar e fechar. O resto (procurar, conferir, montar ficha, arte, site, relatórios) fica com o sistema e com o Claude.

As regras fixas do `CLAUDE.md` valem sempre: nada vai ao site sem `SIM RADAR-AAMMDD-NN`, a fonte e o preço de origem nunca saem do ADM, e preço do site = origem + margem.

## O dia a dia (10 minutos por dia)

| Quando | Quem | O quê |
| --- | --- | --- |
| Manhã | Sistema | O Radar recebe ofertas (WhatsApp encaminhado, ChatGPT colado, entrada automática). Cada oferta vira ficha "Aguardando você", com o preço do site já calculado. |
| Manhã | Júnior | Abre o **ADM → Início**. Vê as ofertas novas, os encontros com pedidos e as máquinas paradas há 30 dias ou mais. Responde `SIM RADAR-…` ou recusa. |
| Durante o dia | Júnior | Atende o WhatsApp comercial. Cliente com pedido novo vai para o CRM. |
| Fim do dia | Sistema | Backup diário dos dados (03:17) e atualização automática do site a cada 10 minutos. |

## A semana

| Dia | Foco | Resultado esperado |
| --- | --- | --- |
| **Segunda** | Radar | Aprovar ou recusar todas as ofertas da semana anterior. Nenhuma oferta com mais de 15 dias fica parada. |
| **Terça** | Encontros | Abrir **ADM → Encontros**: cada pedido de cliente que combina com uma máquina recebe uma mensagem de Júnior. |
| **Quarta** | Vitrine | Máquinas com 30 dias ou mais no site: baixar o preço, trocar a foto ou tirar do site. Marcar as vendidas na lista `vendidas`. |
| **Quinta** | Conteúdo | Publicar 1 notícia ou guia novo, sempre com fatos reais (máquina nova, serviço novo, como funciona). Arte da semana no Instagram e WhatsApp. |
| **Sexta** | Números | Abrir **ADM → Início → Interesse no site**: quais máquinas tiveram mais cliques. Elas viram destaque na semana seguinte. |
| **Sábado** | Segurança | Em **ADM → Config.**, baixar a cópia dos dados e conferir os **Últimos acessos** (só Júnior deve aparecer). |
| **Domingo** | Descanso | O sistema segue sozinho: Radar recebendo, site no ar e backup rodando. |

## O que o Claude faz sozinho (modo automático)

- Revisão diária do código: erros, falhas de segurança e melhorias. Cada mudança testada vira PR, é mesclada no `master` e o servidor atualiza sozinho.
- Nunca muda o visual do site sem pedido de Júnior. Nunca publica máquina sem `SIM`. Nunca escreve no WhatsApp para clientes.
- Conteúdo novo (notícias e guias) só com fatos verificáveis da própria GOULLART.

## Indicadores da semana

1. Ofertas do Radar avaliadas (meta: todas, com no máximo 15 dias).
2. Máquinas novas publicadas.
3. Cliques em "Tenho interesse" (ADM → Início).
4. Pedidos respondidos a partir de Encontros.
5. Máquinas vendidas e retiradas do site.
