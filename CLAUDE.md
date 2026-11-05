# GOULLART — memória do projeto para o Claude

Este repositório é **público**. Nada pessoal, nenhum telefone particular, token, senha ou dado de cliente entra aqui.

## O que é

Site da GOULLART (máquinas pesadas, peças, locação) em `www.goullartmaquinaspesadas.com.br`, servido por uma VM
(nginx + serviço Node "goullart-app"). O servidor puxa o `master` sozinho em até 10 minutos.

- `espelho/` → cópia aprovada do layout; `scripts/build.mjs` monta `_site/` (publicado em `gh-pages` pelo `pages.yml`).
- `server.js` + `lib/` → ADM em `/adm` (senha única, sessão em cookie), Radar, Pátio, CRM, catálogo dinâmico `/adm/catalogo.json`.
- `public/maquinas.json` → máquinas publicadas pelo repositório (inclui as do Radar aprovadas, ficha `radar-AAAA-MM-DD`).
- Dados privados ficam só em `DATA_DIR` no servidor (nunca no git).

## Regras fixas de Júnior (dono)

1. **Nada vai para o site sem o SIM de Júnior com o código exato** (`SIM RADAR-AAMMDD-NN`). Na dúvida, não publica.
2. Só **ofertas reais, recentes (≤ 15 dias) e com cidade/estado**; pelo menos 15% abaixo das parecidas.
3. **Fonte, link do anúncio, contato/nome do vendedor e preço de origem nunca** vão para o GitHub, para a arte nem para o site.
4. Preço do site = preço de origem + R$ 20.000 (margem do ADM).
5. Só máquinas: nada de Aurora, BotConversa ou outros projetos no site.
6. Não escrever no WhatsApp para ninguém além do próprio Júnior; não mudar configurações do iZap.
7. Máquina vendida sai do site inteiro: lista `vendidas` em `espelho/catalog-data.js`.
8. Nunca `git push --force`. Trabalhar no branch indicado, abrir PR e mesclar no `master`.

## Como validar antes de mesclar

```
npm test                 # ~65 testes (node:test)
node scripts/build.mjs   # gera _site/ (deve terminar sem erro)
```

Conferir o `_site/` num navegador (Playwright está instalado) para links, imagens e erros de console.
O painel ADM tem CSP estrita: nenhum script ou estilo embutido em `adm/index.html`.

## Trello

Quadros por função: RADAR, APROVAÇÃO (lista "⏳ Aguardando Júnior" → "✅ Aprovada"/"❌ Recusada"), SITE, PEDIDOS, CRM etc.
Cards do Radar levam código, máquina, ano, horas, preço anunciado → preço do site, cidade/UF e até 3 fotos.

## Proteção dos dados do ADM (resumo do que já existe)

- Só Júnior tem a senha; sessão expira com 2 h sem uso (máx. 12 h); sair ou trocar a senha derruba todas as sessões.
- `DATA_DIR` (0700) com arquivos 0600; fotos de ofertas não publicadas só abrem com sessão do ADM; backup diário em `/www/goullart-backups`.
- Auditoria em `auditoria.json` (acessos e ações, só IP/hora/alvo); "Últimos acessos" no painel; aviso de login de IP novo pelo webhook de Config.
- Token do Radar só como hash; CSP estrita no painel; serviço systemd confinado (`ProtectSystem=strict`, `UMask=0077`, sem capacidades).

## Pendências conhecidas (nov/2026)

- Deixar o repositório privado e proteger o `master` (ação do dono no GitHub).
- Rodar `scripts/instalar-no-servidor.sh` de novo no servidor para os cabeçalhos do nginx valerem.
- RADAR-PC200-2018 está em `public/maquinas.json` sem registro de aprovação; decisão de Júnior.
