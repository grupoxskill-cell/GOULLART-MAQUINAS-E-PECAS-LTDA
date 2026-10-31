# GOULLART — catálogo e atendimento humano

Site da GOULLART com catálogo pesquisável de referências de peças e links para atendimento humano no WhatsApp **(62) 99942-7276**.

**Sophia permanece desativada.** Esta versão não chama a OpenAI, não precisa de chave de IA e responde HTTP 410 em `/api/chat`, inclusive se existir uma chave antiga no ambiente. Sua reativação exige autorização de Júnior e alteração de código.

## Executar e validar

Node.js 22.9 ou superior, sem dependências de aplicação:

```sh
npm start
npm test
npm run build
```

Abra `http://localhost:3000`. O build estático fica em `_site/`. A mesma URL relativa `catalogo.json` funciona no servidor e no GitHub Pages, inclusive em subdiretórios.

## Publicação existente no GitHub Pages

O workflow `.github/workflows/pages.yml` copia `public/` e `data/catalogo.json` para a branch `gh-pages`. A atualização remota `1c83d49` removeu o domínio personalizado do workflow enquanto esta revisão estava em andamento. Essa alteração foi preservada. Endereço de publicação: `https://grupoxskill-cell.github.io/GOULLART-MAQUINAS-E-PECAS-LTDA/`.

Em 29/10/2026, o domínio oficial respondeu por HTTPS com uma aplicação Laravel/Inertia diferente deste repositório, incluindo catálogo de máquinas, login e rastreamento. Não substituir essa aplicação nem trocar o DNS sem preservar seus dados e a continuidade do painel administrativo.

## Instalação existente no Azure / aaPanel

A VM `goullart1` (IP `20.69.167.61`, aaPanel) é a origem de www.goullartmaquinaspesadas.com.br. Em 29/10/2026 (09:11 UTC) o script `scripts/instalar-no-servidor.sh` foi executado pelo portal da Azure (Executar comando → RunShellScript) e trocou a raiz do nginx de `/www/wwwroot/goullartmaquinaspesadas.com.br/public` (aplicação Laravel) para `/www/wwwroot/goullart-site` (este site estático). A aplicação Laravel, seus arquivos e o banco de dados não foram apagados, mas deixaram de responder nesse domínio.

Para voltar à aplicação Laravel, rode como root:

```sh
cp /www/server/panel/vhost/nginx/goullartmaquinaspesadas.com.br.conf.bak-20261029-091156 /www/server/panel/vhost/nginx/goullartmaquinaspesadas.com.br.conf && /usr/bin/nginx -s reload
```

Rodar o script de novo atualiza o site e liga a atualização automática: o cron (`/etc/cron.d/goullart-site`) confere o branch `gh-pages` a cada 10 minutos e publica a versão nova. O registro fica em `/var/log/goullart-site.log`.

```sh
curl -fsSL https://raw.githubusercontent.com/grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA/master/scripts/instalar-no-servidor.sh | bash
```

## Páginas das máquinas e contador de interesse

Cada máquina tem página própria em `maquina/<slug>.html`, com título, foto e preço nas tags Open Graph (prévia no WhatsApp) e dados estruturados de produto para o Google. O build (`node scripts/build.mjs`, rodado pelo workflow) gera as páginas do catálogo, `sitemap.xml` e `robots.txt`; as máquinas publicadas pelo ADM são geradas pelo servidor (`lib/paginas.js`).

O botão "Tenho interesse" e a abertura das páginas são contados em `/api/interesse` (sem dados pessoais; a mesma pessoa conta uma vez a cada 30 minutos). Os números aparecem no início do ADM.

## Layout do site (cópia do site do ChatGPT)

A página inicial, `/curso`, `/cursos`, `/central` e `/texas.html` vêm de `espelho/`, cópia do site publicado em `www.goullartmaquinaspesadas.com.br`. Para atualizar a cópia, rode a ação "Importar site do ChatGPT" (branch `importar-chatgpt`) e junte no master. `scripts/preparar-espelho.mjs` adapta a cópia no build (tira scripts da Cloudflare do ChatGPT e mantém o painel privado em `/adm`, sem link público).

O catálogo do site é lido de `/adm/catalogo.json` (ADM, só campos públicos). Se o ADM não responder, o site usa a cópia estática `api/catalog.json`.

## ADM (Publicações, Radares, Radar de preço, Pátio, CRM e Encontros)

- **Publicações:** importe `goullart-agro-brasil-backup.json` (painel do ChatGPT). Fica "No site" o que o site mostrava na importação; o resto entra "Fora do site". Editar título, preço, texto, fotos ou tirar/colocar no site muda o catálogo na hora. Notas privadas e fonte nunca saem do ADM.
- **Radares:** perfis de busca do backup, com critérios e situação editáveis.
- **Radar (preço):** máquina publicada vai para o catálogo do site com nome, ano, horas, preço (origem + margem) e o "texto para o cliente". Fonte, local, observações e preço de origem ficam só no ADM.
- **Arte:** botão "Fazer arte" no Radar e no Pátio gera uma imagem 1080x1350 com foto, marca e preço, usada como capa no site e baixável para WhatsApp/Instagram. Refazer a imagem apaga os dados escondidos da foto original.
- O site público não tem link para `/adm` nem para a área de cliente do ChatGPT.

Área privada em `/adm`, com senha. Roda como serviço Node (`goullart-app`) no servidor, ouvindo só em `127.0.0.1:3210`; o nginx encaminha `/adm`, `/fotos/` e `/maquinas.json`. Os dados ficam em `/www/goullart-dados` (variável `DATA_DIR`), nunca no GitHub.

- **Radar:** máquina com preço de origem; o preço do site é origem + margem (R$ 20.000 por padrão, editável em Configurações) e fica congelado no momento da publicação. Só aparece no site depois de "Publicar". Fonte, local e observações não são públicos.
- **Pátio:** máquinas da GOULLART; publicadas aparecem na seção Pátio do site com o local informado.
- **CRM:** importado do backup JSON do painel do CRM (substitui a base anterior).
- **Encontros:** pedidos abertos do CRM (compra/locação, exceto peças e serviços) cruzados com Radar, Pátio e catálogo por tipo, marca, modelo e orçamento (`lib/encontros.js`).

A senha é criada na instalação e aparece uma única vez na saída do script. Para gerar outra: `runuser -u goullart -- env DATA_DIR=/www/goullart-dados node /opt/goullart-app/scripts/criar-senha.mjs --nova`.

## Render

O `render.yaml` está pronto para Node, `npm run build`, `npm start` e health check `/health`. Nenhuma variável OpenAI é necessária. A existência deste arquivo não comprova que um serviço Render tenha sido criado ou publicado.

## Conteúdo e marca

- `public/assets/logo-oficial.png`: cópia sem edição da referência aprovada por Júnior em 27/10/2026 (`goullart_pesados_logo_referencia.png`).
- `public/maquinas.json` e `public/maquinas/`: catálogo público de máquinas, gerado em 29/10/2026 a partir das fichas do levantamento interno (partes 1 e 2), com publicação e preços aprovados por Júnior. Ficaram de fora as ofertas de terceiros do CRM (GOUL-CRM-*), a localização, as observações internas e duas imagens (anúncio de terceiro e arte do Radar).
- `data/catalogo.json`: referências para orçamento, sem preços, custos ou confirmação de estoque. Duplicação literal é suprimida na exibição sem excluir o registro de origem.
- `data/empresa.json`: contato comercial. WhatsApp 7276 conferido no iZap em 29/10/2026. O telefone 1936 foi preservado do projeto e do histórico do usuário; não foi efetuada ligação.
- CNPJ 29.759.621/0001-35: presente no projeto e correspondente a Goulart Pecas e Maquinas Pesadas Ltda em consultas públicas Serasa/CNPJ.biz. A razão social anterior do projeto divergia. Não foi obtido novo comprovante diretamente da Receita; o rodapé usa marca e CNPJ.
- E-mails, horário, promessa de retorno em 24h, cobertura internacional e texto de trocas foram retirados da apresentação por falta de validação atual. Consulte o histórico Git para os valores anteriores.

## Segurança

Nunca incluir `.env`, tokens, dados de CRM, fornecedores, custos ou chaves de API na pasta pública. O script legado `chat.js` permanece vazio para evitar novas chamadas por HTML antigo. Configurações do iZap não são alteradas por este site.

## Domínio: configuração possível, ainda não aplicada

Consulta pública em 29/10/2026 identificou nameservers `aragorn.ns.cloudflare.com` e `gail.ns.cloudflare.com`, com os endereços de proxy Cloudflare `104.21.21.130` e `172.67.198.204`. Isso não revela o IP da origem.

O DNS deve ser inventariado e salvo antes de qualquer migração. Preservar MX, SPF, DKIM e registros de serviços. Para GitHub Pages, após validar a propriedade e configurar o domínio no painel:

- `www`: CNAME `grupoxskill-cell.github.io` (sem nome do repositório).
- Raiz, somente se a migração da aplicação atual for decidida: A `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- Depois da validação do DNS/certificado, habilitar Enforce HTTPS e testar raiz e www.

Fonte oficial: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

Para Render, usar os registros retornados pelo serviço efetivamente criado; não adivinhar seu hostname. Fonte: https://render.com/docs/custom-domains
