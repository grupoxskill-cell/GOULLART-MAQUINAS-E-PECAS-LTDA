# Radar GOULLART — rotina de 3 em 3 horas

> **Novo (13/11/2026):** a iZap foi removida e as rotinas foram desligadas em 08/11. O fluxo passa a rodar no próprio servidor pela API oficial do WhatsApp: veja [WHATSAPP-RADAR.md](WHATSAPP-RADAR.md). As regras abaixo continuam valendo; o passo a passo com `mcp__Izap__*` fica só como histórico.

O fluxo foi combinado com Júnior em 31/10/2026:

1. Júnior (ou a equipe) **encaminha para o WhatsApp oficial (62) 99942-7276** os anúncios de máquinas dos grupos e do canal, a partir do número **o número pessoal do Júnior**.
2. A cada 3 horas, a rotina lê o que chegou e só segue com **ofertas de verdade**:
   - **anúncio real:** o link abre, o anúncio está no ar e tem foto da própria máquina;
   - **recente:** publicado há no máximo 15 dias;
   - **com localização:** cidade e estado;
   - **abaixo do mercado:** pelo menos 15% abaixo das máquinas parecidas do catálogo (`lib/radar.js`).
3. Para cada barata, a rotina faz uma **arte** e manda para o Júnior com um código `RADAR-AAMMDD-NN`.
4. Júnior responde **`SIM RADAR-AAMMDD-NN`** para publicar, ou **`NÃO RADAR-AAMMDD-NN`** para descartar.
5. Na rodada seguinte, cada SIM vai para o site, em `public/maquinas.json` na `master`. O GitHub publica, e o servidor puxa em até 10 minutos.

Nada além de máquinas vai para o site: Aurora, BotConversa e outros projetos ficaram de fora a pedido de Júnior.

## Regras fixas

- **Dados privados nunca vão para o GitHub nem para a arte:** fonte, grupo, contato do vendedor, link do anúncio e preço de origem. Eles só aparecem na mensagem para Júnior. O `publicar.mjs` recusa esses campos.
- **Preço do site = preço de origem + R$ 20.000**, a margem padrão do ADM.
- Só publique com um **SIM vindo do o número pessoal do Júnior** e com o código exato. Na dúvida, não publique.
- Não responda nem escreva para vendedores ou para quem mandou anúncio. As únicas mensagens enviadas são as artes, o resumo para o Júnior e o aviso quando uma máquina vai para o site.
- Não altere configurações do iZap.

## Passo a passo de cada rodada

O iZap é usado pelas ferramentas `mcp__Izap__*`. O negócio é `API AGRO GOULLART`.

### A. Primeiro, os SIM e NÃO pendentes

1. `list_chats` com `phone="<número do Júnior>"`. Leia as conversas com `get_chat_messages`, até 100 mensagens.
2. Para cada mensagem recebida do Júnior com `SIM RADAR-…` ou `NÃO RADAR-…`, procure a arte que a rotina enviou com esse código. A legenda dela tem uma linha `#dados {…}`.
3. **SIM:** salve o JSON do `#dados` em um arquivo. Se existir a foto original `RADAR-AAMMDD-NN-foto.*` na branch `radar-artes` (`git fetch origin radar-artes` e `git show origin/radar-artes:<arquivo> > foto.<ext>`), ponha o caminho dela em `foto`. A foto original é obrigatória, e a arte não serve como foto do site. Sem foto, não publique e avise Júnior. Depois publique na `master`:
   ```sh
   git fetch origin master && git worktree add /tmp/master origin/master
   cd /tmp/master && node "$REPO/scripts/radar/publicar.mjs" /caminho/dados.json
   git add public/maquinas.json public/maquinas && git commit -m "Radar: publica RADAR-AAMMDD-NN aprovado por Júnior" && git push origin HEAD:master
   ```
   `$REPO` é a pasta do repositório da rodada. Se o código já estiver no site, o script avisa e nada muda. Depois mande ao Júnior: "RADAR-… publicado. Entra no site em até 15 minutos."
4. **NÃO:** não faça nada. A arte fica só no histórico.

### B. Depois, os anúncios novos

1. Use as mensagens recebidas do Júnior nas **últimas 3 horas e 10 minutos**. Ignore as que não são anúncio de máquina, como "bom dia", SIM e NÃO.
2. Para cada anúncio, tire do texto, das fotos (`download_media` com `inline=true`) e do link (`mcp__TinyFish__fetch_content`, se for OLX ou outro site): **tipo, marca, modelo, ano, horas, preço pedido, cidade e estado, data de publicação**.
   - **Anúncio com link:** abra o link. A data é a que aparece no anúncio (na OLX, "21/10 às 12:44"). O anúncio está `ativo` se a página abriu com o anúncio, e não com "anúncio removido", página de busca ou página inicial.
   - **Post encaminhado de grupo ou canal, sem link:** a data é a que aparecer no post. Se não houver data, use a do encaminhamento, desde que o post traga foto da máquina, preço e cidade. `ativo` = true.
   - `temFotoOriginal` só vale para foto da máquina anunciada. Não vale logo, arte, imagem de catálogo de fábrica nem foto de outra máquina.
3. **Filtro de oferta real** (regra de Júnior):
   ```sh
   node -e 'import("./lib/radar.js").then(r=>console.log(JSON.stringify(r.anuncioAprovado({dataAnuncio:"2026-10-28",local:"Itaúna - MG",temFotoOriginal:true,preco:"R$ 250.000",ativo:true}))))'
   ```
   Se der `"ok": false`, pule e conte no resumo com o motivo.
4. Não repita anúncios. Se uma arte com o mesmo título e preço já foi enviada nos últimos 7 dias, pule.
5. Calcule:
   ```sh
   node -e 'import("./lib/radar.js").then(async r=>{const c=JSON.parse(require("fs").readFileSync("public/maquinas.json"));console.log(JSON.stringify(r.avaliar({titulo:"…",categoria:"Escavadeiras",ano:"2015",precoOrigem:"…"},c)))})'
   ```
   A categoria tem que ser uma de `CATEGORIAS` em `lib/radar.js`. Só segue quem der `"barata": true`.
6. Para cada barata, crie o código `RADAR-AAMMDD-NN` com a data de hoje, sem repetir códigos já usados no histórico.
7. **Arte com a foto original.** Esta conversa não consegue baixar fotos, então quem baixa é o GitHub (`.github/workflows/radar-arte.yml`):
   - Pegue o link da **foto original**. Num anúncio de site (OLX etc.), use `mcp__TinyFish__fetch_content` com `image_links=true` e escolha a foto principal em tamanho grande, `.jpg`; na OLX é a de `og.image`, `img.olx.com.br/images/...jpg`. Numa foto encaminhada no WhatsApp, use o `download_url` de `download_media`, que vale 1 hora.
   - Na branch `radar-fila`, crie `fila/RADAR-AAMMDD-NN.json` com `{codigo, titulo, ano, horas, precoSite, local, fotoUrl}`. Só dados públicos: o `local` é "Cidade - UF". Faça commit e push:
     ```sh
     git fetch origin radar-fila && git worktree add /tmp/fila origin/radar-fila
     # escreva os arquivos em /tmp/fila/fila/, depois:
     cd /tmp/fila && git add fila && git commit -m "Radar: fila RADAR-AAMMDD-NN" && git push origin HEAD:radar-fila
     ```
   - Em 2 a 4 minutos, o GitHub baixa a foto, gera a arte, apaga o pedido da fila e grava `RADAR-AAMMDD-NN.png` (a arte) e `RADAR-AAMMDD-NN-foto.<ext>` (a foto original) na branch `radar-artes`. Para conferir: `git fetch origin radar-artes && git ls-tree --name-only origin/radar-artes`. Tente a cada 30 segundos, por até 8 minutos.
   - Se não aparecer, ou se a foto não baixou (o GitHub registra um aviso e a arte sai sem foto), gere a arte aqui sem foto com `node scripts/radar/arte.mjs arte.json RADAR-AAMMDD-NN.png`. Depois faça commit dela na `radar-artes` e diga na legenda que foi sem foto.
   - Link da arte: `https://raw.githubusercontent.com/grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA/radar-artes/RADAR-AAMMDD-NN.png`
8. Envie para `<número do Júnior>` com `send_whatsapp_message`, usando `media_url` = o link acima, `client_request_id` = o código, e esta legenda:
   ```
   RADAR-AAMMDD-NN · <título> <ano> · <Cidade - UF>
   Anúncio de <data> · <link do anúncio ou "post do grupo X">
   Origem R$ X · Site R$ X+20 mil · <N>% abaixo de <K> parecidas
   Fonte: <grupo/canal/link> · Vendedor: <contato>
   Responda SIM RADAR-AAMMDD-NN para publicar ou NÃO RADAR-AAMMDD-NN.
   #dados {"codigo":"…","titulo":"…","categoria":"…","ano":"…","horas":"…","local":"Cidade - UF","precoSite":000000,"precoMercado":000000}
   (`precoMercado` = mediana pública das parecidas; com ele a máquina ganha o selo "abaixo do mercado" em /ofertas. Preço de origem nunca.)
   ```
9. No fim, mande ao Júnior **um** resumo curto, só se houve anúncio na rodada: "Radar 14h: 6 anúncios, 2 ofertas enviadas, 2 acima do mercado, 1 antigo, 1 sem cidade." Se não chegou nada, não mande mensagem.

### Se algo falhar

- **WhatsApp recusar o envio porque passou de 24 horas sem mensagem do Júnior:** não insista. A próxima mensagem que Júnior encaminhar reabre a janela, e a rodada seguinte reenvia o que ficou pendente.
- **Foto que não baixa:** gere a arte sem foto e diga isso na legenda. Esse anúncio não pode ir ao site enquanto não houver a foto original (veja o passo B7).
- **Push recusado:** não force. Relate no resumo.
