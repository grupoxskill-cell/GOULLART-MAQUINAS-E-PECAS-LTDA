# Radar GOULLART — rotina de 3 em 3 horas

O fluxo foi combinado com Júnior em 31/10/2026:

1. Júnior (ou a equipe) **encaminha para o WhatsApp oficial (62) 99942-7276** os anúncios de máquinas dos grupos e do canal, a partir do número **(62) 99853-1936**.
2. A cada 3 horas, a rotina lê o que chegou e separa **só as baratas**, ou seja, as que estão **pelo menos 15% abaixo** das máquinas parecidas do catálogo (`lib/radar.js`).
3. Para cada barata, a rotina faz uma **arte** e manda para o 1936 com um código `RADAR-AAMMDD-NN`.
4. Júnior responde **`SIM RADAR-AAMMDD-NN`** para publicar, ou **`NÃO RADAR-AAMMDD-NN`** para descartar.
5. Na rodada seguinte, cada SIM vai para o site, em `public/maquinas.json` na `master`. O GitHub publica, e o servidor puxa em até 10 minutos.

Nada além de máquinas vai para o site: Aurora, BotConversa e outros projetos ficaram de fora a pedido de Júnior.

## Regras fixas

- **Dados privados nunca vão para o GitHub nem para a arte:** fonte, grupo, contato do vendedor, link do anúncio e preço de origem. Eles só aparecem na mensagem para Júnior. O `publicar.mjs` recusa esses campos.
- **Preço do site = preço de origem + R$ 20.000**, a margem padrão do ADM.
- Só publique com um **SIM vindo do (62) 99853-1936** e com o código exato. Na dúvida, não publique.
- Não responda nem escreva para vendedores ou para quem mandou anúncio. As únicas mensagens enviadas são as artes, o resumo para o 1936 e o aviso quando uma máquina vai para o site.
- Não altere configurações do iZap.

## Passo a passo de cada rodada

O iZap é usado pelas ferramentas `mcp__Izap__*`. O negócio é `API AGRO GOULLART`.

### A. Primeiro, os SIM e NÃO pendentes

1. `list_chats` com `phone="62998531936"`. Leia as conversas com `get_chat_messages`, até 100 mensagens.
2. Para cada mensagem recebida do 1936 com `SIM RADAR-…` ou `NÃO RADAR-…`, procure a arte que a rotina enviou com esse código. A legenda dela tem uma linha `#dados {…}`.
3. **SIM:** salve o JSON do `#dados` em um arquivo. Se ele tiver `fotoMsg`, baixe essa foto com `download_media` e ponha o caminho local em `foto`. A arte não vai para o site como foto. Depois publique na `master`:
   ```sh
   git fetch origin master && git worktree add /tmp/master origin/master
   cd /tmp/master && node "$REPO/scripts/radar/publicar.mjs" /caminho/dados.json
   git add public/maquinas.json public/maquinas && git commit -m "Radar: publica RADAR-AAMMDD-NN aprovado por Júnior" && git push origin HEAD:master
   ```
   `$REPO` é a pasta do repositório da rodada. Se o código já estiver no site, o script avisa e nada muda. Depois mande ao 1936: "RADAR-… publicado. Entra no site em até 15 minutos."
4. **NÃO:** não faça nada. A arte fica só no histórico.

### B. Depois, os anúncios novos

1. Use as mensagens recebidas do 1936 nas **últimas 3 horas e 10 minutos**. Ignore as que não são anúncio de máquina, como "bom dia", SIM e NÃO.
2. Para cada anúncio, tire do texto, das fotos (`download_media` com `inline=true`) e do link (`mcp__TinyFish__fetch_content`, se for OLX ou outro site): **tipo, marca, modelo, ano, horas, preço pedido e estado/região**. Se não houver preço, pule e anote no resumo.
3. Não repita anúncios. Se uma arte com o mesmo título e preço já foi enviada nos últimos 7 dias, pule.
4. Calcule:
   ```sh
   node -e 'import("./lib/radar.js").then(async r=>{const c=JSON.parse(require("fs").readFileSync("public/maquinas.json"));console.log(JSON.stringify(r.avaliar({titulo:"…",categoria:"Escavadeiras",ano:"2015",precoOrigem:"…"},c)))})'
   ```
   A categoria tem que ser uma de `CATEGORIAS` em `lib/radar.js`. Só segue quem der `"barata": true`.
5. Para cada barata, crie o código `RADAR-AAMMDD-NN` com a data de hoje, sem repetir códigos já usados no histórico, e gere a arte:
   ```sh
   node scripts/radar/arte.mjs arte.json RADAR-AAMMDD-NN.png
   ```
   O `arte.json` leva `{codigo, titulo, ano, horas, precoSite, local, foto}`. O `local` é só o estado ou a região, e a `foto` é opcional (caminho local). Sem foto, a arte sai com "Fotos e vídeos com a equipe GOULLART".
6. Hospede a arte na branch `radar-artes` deste repositório. A arte só tem dados públicos.
   ```sh
   git fetch origin radar-artes || true
   ```
   Faça commit do PNG na raiz dessa branch (crie a branch vazia com `git switch --orphan` se não existir) e dê push. O link fica `https://raw.githubusercontent.com/grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA/radar-artes/RADAR-AAMMDD-NN.png`.
7. Envie para `+5562998531936` com `send_whatsapp_message`, usando `media_url` = o link acima, `client_request_id` = o código, e esta legenda:
   ```
   RADAR-AAMMDD-NN · <título> <ano>
   Origem R$ X · Site R$ X+20 mil · <N>% abaixo de <K> parecidas
   Fonte: <grupo/canal/link> · Vendedor: <contato>
   Responda SIM RADAR-AAMMDD-NN para publicar ou NÃO RADAR-AAMMDD-NN.
   #dados {"codigo":"…","titulo":"…","categoria":"…","ano":"…","horas":"…","precoSite":000000,"fotoMsg":"<message_id da foto original, se houver>"}
   ```
8. No fim, mande ao 1936 **um** resumo curto, só se houve anúncio na rodada: "Radar 14h: 6 anúncios, 2 baratas enviadas, 3 acima do mercado, 1 sem preço." Se não chegou nada, não mande mensagem.

### Se algo falhar

- **WhatsApp recusar o envio porque passou de 24 horas sem mensagem do 1936:** não insista. A próxima mensagem que Júnior encaminhar reabre a janela, e a rodada seguinte reenvia o que ficou pendente.
- **Foto que não baixa** (a rede do ambiente pode bloquear o endereço): gere a arte sem foto e diga isso na legenda.
- **Push recusado:** não force. Relate no resumo.
