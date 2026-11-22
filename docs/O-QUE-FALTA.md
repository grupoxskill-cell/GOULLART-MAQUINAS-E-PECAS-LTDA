# O que falta no sistema GOULLART (diagnóstico de 22/11/2026)

Feito a partir do código, do site no ar e das regras do `CLAUDE.md`. A coluna "Quem" diz se depende do login de Júnior ou se o Claude faz sozinho.

## 1. Pendências que travam (prioridade máxima)

| # | Falta | Por que importa | Quem |
| --- | --- | --- | --- |
| 1 | Repositório privado e `master` protegido | Hoje qualquer pessoa vê o código e o histórico. | Júnior (GitHub → Settings) |
| 2 | Rodar `scripts/instalar-no-servidor.sh` de novo | Os cabeçalhos de segurança do nginx e as melhorias de servidor só valem depois disso. | Júnior (Azure → Executar comando) |
| 3 | Decisão sobre RADAR-PC200-2018 | Está no site sem registro de aprovação. | Júnior |
| 4 | Google Search Console e Perfil da Empresa no Google | Sem eles, o Google demora a mostrar a GOULLART nas buscas por "escavadeira usada Goiânia" e similares. | Júnior (login Google), com o Claude guiando |
| 5 | Conta da Cloudflare localizada | Sem ela, não dá para limpar o cache nem ver ataques. | Júnior |

## 2. 30 coisas que ainda faltam (oportunidades)

**Vendas**
1. Botão "Me avise quando chegar uma máquina assim" (cliente deixa o pedido, que cai no CRM).
2. Simulador de financiamento e consórcio na página da máquina.
3. Comparador de máquinas lado a lado na página própria (hoje só existe na vitrine).
4. Selo "Laudo GOULLART disponível" nas máquinas que já têm laudo.
5. Vídeo curto de cada máquina (30 s), além das fotos.
6. Página "Vendidas recentemente", para prova social sem preço.
7. Depoimentos reais de clientes, com autorização.
8. Proposta em PDF gerada pelo ADM (máquina, preço, condições, validade).

**Radar e operação**
9. Aviso no WhatsApp de Júnior a cada oferta nova (o webhook existe, falta ligar Zapier, Make ou iZap).
10. Painel de "ofertas que vencem amanhã" (regra dos 15 dias).
11. Histórico de preço de cada modelo (para saber se a oferta está mesmo 15% abaixo).
12. Etiqueta de motivo ao recusar uma oferta (preço, foto, local), para afinar o Radar.
13. Agenda de visitas e inspeções no ADM.
14. Controle de frete: quanto custa levar a máquina até o cliente.
15. Checklist de entrega (documentos, nota, transporte).

**Site e Google**
16. Página por cidade ou estado ("Escavadeira usada em Goiás"), com as máquinas daquela região.
17. Página por marca ("Caterpillar usada"), com as máquinas daquela marca.
18. FAQ estruturado (perguntas frequentes) para aparecer no Google.
19. Notícia semanal (a seção Notícias começou em 22/11/2026).
20. Imagens em WebP em todas as fotos de máquina (carregam mais rápido).
21. Página de peças com busca por código da peça.
22. Versão em espanhol para compradores do Paraguai e da Bolívia.

**Júnior e gestão**
23. Relatório semanal automático (máquinas novas, cliques, vendidas) no e-mail de Júnior.
24. Meta mensal e funil (ofertas → publicadas → interessados → vendidas).
25. Cadastro de parceiros e vendedores com histórico (só no ADM, nunca no site).
26. Login em dois passos no ADM (código no celular).
27. Aplicativo do ADM na tela inicial do celular (PWA).

**Pós-venda**
28. Lembrete de revisão para quem comprou (horas e data).
29. Peças sugeridas para a máquina que o cliente comprou.
30. Pesquisa de satisfação depois da entrega.

## 3. 10 coisas que a GOULLART já tem e poucas revendas de pesados oferecem

Não existe levantamento oficial de todo o Brasil. Estas são funções reais do sistema que não são comuns em revendas de linha amarela.

1. **Radar com aprovação por código**: nenhuma máquina vai para o site sem o `SIM RADAR-AAMMDD-NN` do dono.
2. **Preço calculado sozinho**: origem + margem, sem planilha e sem erro de conta.
3. **Arte profissional automática** da máquina (feed e story), sem marca d'água de terceiros.
4. **Laudo técnico em PDF por R$ 49,90** para qualquer dono de máquina.
5. **Encontros**: o sistema cruza os pedidos dos clientes com as máquinas do Radar e do site.
6. **Máquina vendida some do site inteiro na hora**: vitrine, página, lista e Google.
7. **Página própria por máquina**, com foto e preço na prévia do WhatsApp.
8. **Fotos sem localização escondida**: o GPS do celular é apagado antes de publicar.
9. **Contador de interesse por máquina** (visitas e cliques), sem guardar dados pessoais.
10. **Radar pelo WhatsApp oficial**: oferta encaminhada vira ficha pronta para aprovar.
