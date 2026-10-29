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

O script `scripts/instalar-no-servidor.sh`, adicionado em paralelo na atualização `1c83d49`, foi preservado sem execução. Ele troca a raiz do nginx para o site estático; não migra catálogo de máquinas, login, pedidos ou banco de dados do aplicativo atual. Exige revisão da configuração e backup integral antes de uso neste domínio. A referência existente de hospedagem é a VM `goullart1`, IP `20.69.167.61`; a origem não foi confirmada no painel nesta revisão.

## Render

O `render.yaml` está pronto para Node, `npm run build`, `npm start` e health check `/health`. Nenhuma variável OpenAI é necessária. A existência deste arquivo não comprova que um serviço Render tenha sido criado ou publicado.

## Conteúdo e marca

- `public/assets/logo-oficial.png`: cópia sem edição da referência aprovada por Júnior em 27/10/2026 (`goullart_pesados_logo_referencia.png`).
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
