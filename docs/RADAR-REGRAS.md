# Regras do Radar GOULLART

Estas regras valem para qualquer pessoa ou IA (Claude, ChatGPT, Sophia) que trabalhe com o Radar.
Definidas por Júnior Goullart em 31/10/2026.

## O que é o Radar

A cada 3 horas o Radar procura máquinas anunciadas de 10% a 40% abaixo do mercado.
Cada oferta encontrada entra no ADM pelo **endereço de entrada do Radar**
(`POST /adm/entrada/radar`, com o token mostrado em ADM > Config.) e vira uma máquina "Aguardando você".

## Duas imagens por máquina

1. **Ficha interna (nunca divulgar).** Fica só no ADM:
   fonte, link do anúncio, contato do vendedor, local, preço de origem, preço de mercado,
   % abaixo do mercado, classificação e observações.
2. **Arte pública (padrão GOULLART).** Gerada pelo botão "Fazer arte" no ADM, em feed (1080x1350)
   e story (1080x1920): logo GOULLART Pesados, MARCA em azul-marinho, MODELO em amarelo, tipo,
   foto, ano/horas, "PREÇO GOULLART" e "Fale com a GOULLART • (62) 99942-7276".
   Cores: azul-marinho `#061E42` e amarelo `#F5B301`, fundo branco, curvas nos cantos.

## Preço

- Preço GOULLART = preço de origem + margem (R$ 20.000 por padrão, editável em ADM > Config.).
- O preço do site é congelado no momento da publicação.
- Classificação pelo desconto sobre o preço de mercado: **Quente** 25% ou mais, **Boa** de 10% a 25%,
  **Fraca** abaixo de 10%.

## Fluxo

1. Oferta entra pelo endereço do Radar, com até 3 fotos originais do anúncio.
2. O ADM avisa (aviso por WhatsApp/automação configurado em ADM > Config.).
3. Júnior confere a ficha interna e a arte e toca em **Publicar**. Nada vai para o site sem isso.
4. Publicada, a máquina aparece no site com a arte e as fotos permitidas.

## Regras que nunca mudam

1. A arte e o site **nunca** mostram: fonte, link do anúncio, nome ou telefone do vendedor,
   cidade exata, preço de origem, preço de mercado ou % de desconto.
2. **Nunca remover marca d'água de foto de terceiros.** Foto com marca d'água de outra revenda é
   marcada no ADM e **não vai para o site**. Peça ao vendedor fotos sem marca d'água (o ADM traz a
   mensagem pronta) ou publique só a arte, com "fotos pelo WhatsApp".
3. **Nunca apagar ou alterar a marca do fabricante** na máquina (CAT, Komatsu, Volvo...).
4. **Nunca inventar** ano, horas, estado ou preço. Dado faltando fica "a confirmar".
5. Nada é publicado sem aprovação de Júnior.
6. Atendimento ao cliente é humano, pelo WhatsApp (62) 99942-7276.

## Prompt para a IA que alimenta o Radar

```
Você é o assistente do RADAR GOULLART. Para cada oferta encontrada, envie para o endereço de
entrada do Radar um JSON com: titulo, categoria, ano, horas, local, precoOrigem, precoMercado,
fonte, link, contato, obs e até 3 fotos ({"url": "...", "marcaDagua": true|false}).
Siga as "Regras que nunca mudam" acima. Não remova marca d'água; apenas informe marcaDagua=true.
Não invente dados: o que faltar vai vazio.
```
