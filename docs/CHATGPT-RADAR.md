# ChatGPT + Radar GOULLART

Como fazer o ChatGPT mandar cada máquina do Radar direto para o ADM
(`www.goullartmaquinaspesadas.com.br/adm`), onde ela entra como "Aguardando você".
Regras do Radar: `docs/RADAR-REGRAS.md`.

## Passo a passo (uma vez só)

1. No ADM, em **Config.**, toque em **"Ligar entrada do Radar"** e copie o **token**.
2. No ChatGPT (computador): **Explorar GPTs → Criar → Configurar**.
3. **Nome:** `Radar GOULLART`. **Instruções:** cole o bloco "Instruções do GPT" abaixo.
4. Em **Ações → Criar nova ação**:
   - **Autenticação:** Chave de API → tipo **Bearer** → cole o token do passo 1.
   - **Esquema:** cole o bloco "Esquema da ação" abaixo.
5. Salve o GPT como **"Somente eu"** (o token dá acesso de entrada ao Radar).

Depois disso, no GPT "Radar GOULLART", mande o link ou o print do anúncio e diga "manda pro Radar".
A máquina aparece no ADM em **Radar (preço)**, com a ficha interna, e só vai para o site quando você tocar em **Publicar**.

## Instruções do GPT

```
Você é o Radar GOULLART (GOULLART Pesados). Quando eu enviar um anúncio de máquina (link, texto ou print):
1. Extraia: titulo (tipo + marca + modelo), categoria (Escavadeiras, Pás-carregadeiras, Retroescavadeiras,
   Tratores, Motoniveladoras, Caminhões ou Outros), ano, horas, local, precoOrigem (preço do anúncio),
   precoMercado (sua melhor referência de mercado, se souber), fonte (site/perfil), link, contato do vendedor,
   obs e até 3 fotos (url pública https de cada foto, com marcaDagua=true quando a foto tiver marca d'água
   ou telefone de outra empresa).
2. Mostre o resumo e, quando eu disser "manda pro Radar", chame a ação enviarOferta.
3. Nunca invente dados: o que não estiver no anúncio fica vazio.
4. Nunca remova marca d'água de fotos; apenas marque marcaDagua=true.
5. Você não publica nada no site: a máquina entra como "Aguardando você" e Júnior aprova no ADM.
```

## Esquema da ação

```yaml
openapi: 3.1.0
info:
  title: Radar GOULLART
  version: 1.0.0
servers:
  - url: https://www.goullartmaquinaspesadas.com.br
paths:
  /adm/entrada/radar:
    post:
      operationId: enviarOferta
      summary: Envia uma oferta de máquina para o Radar do ADM GOULLART
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [titulo]
              properties:
                titulo: { type: string, description: "Tipo, marca e modelo. Ex.: Escavadeira Komatsu PC200" }
                categoria: { type: string, enum: [Escavadeiras, Pás-carregadeiras, Retroescavadeiras, Tratores, Motoniveladoras, Caminhões, Outros] }
                ano: { type: string }
                horas: { type: string, description: "Horas ou km. Ex.: 14.170 h" }
                local: { type: string }
                precoOrigem: { type: number, description: "Preço do anúncio em reais" }
                precoMercado: { type: number, description: "Preço de referência de mercado em reais" }
                fonte: { type: string }
                link: { type: string, description: "Link do anúncio original" }
                contato: { type: string }
                obs: { type: string }
                fotos:
                  type: array
                  maxItems: 3
                  items:
                    type: object
                    properties:
                      url: { type: string, description: "Link https da foto (JPEG)" }
                      marcaDagua: { type: boolean }
      responses:
        "201": { description: Oferta recebida e aguardando aprovação }
        "200": { description: Oferta repetida (mesmo link nos últimos 7 dias) }
        "401": { description: Token inválido }
```
