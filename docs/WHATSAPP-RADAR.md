# WhatsApp do Radar (API oficial da Meta, sem iZap)

O servidor do site conversa direto com o WhatsApp da empresa. Código em `lib/whatsapp.js`, testes em `test/whatsapp.test.js`.

## Como funciona

1. O **aprovador** (Júnior) encaminha o anúncio (fotos + texto) para o **número da empresa**.
2. A Meta entrega as mensagens em `POST /adm/entrada/whatsapp`. O servidor confere a assinatura (`X-Hub-Signature-256`, App Secret).
3. Mensagens seguidas do aprovador (até 90 s de intervalo) viram **uma oferta** no Radar do ADM ("Aguardando você"), com a ficha interna (texto original, link, preço de origem).
4. Se a oferta passa nas regras (`lib/radar.js`: preço, cidade e estado, foto real, pelo menos 15% abaixo das parecidas do catálogo), o aprovador recebe **a foto com o código** `RADAR-AAMMDD-NN`, a origem, o preço do site (origem + margem do ADM) e o desconto. Senão, recebe o motivo; a oferta fica no ADM.
5. O aprovador responde **`SIM RADAR-AAMMDD-NN`** → a máquina é publicada no site na hora (mesmas regras do botão Publicar do ADM: precisa de foto própria e preço). **`NÃO RADAR-AAMMDD-NN`** → descartada.

Regras que o código garante:
- Só o número do aprovador é atendido. **Mensagens de clientes são ignoradas e não são guardadas** (atendimento continua humano, no aplicativo).
- Nada vai para o site sem o SIM com o código exato, vindo do aprovador.
- Fonte, vendedor, link e preço de origem ficam só no ADM. O site recebe título, ano, horas, foto e preço do site.
- A mesma mensagem entregue duas vezes não repete a oferta; o mesmo anúncio (título + preço) em 7 dias também não.
- O token e o App Secret ficam só em `DATA_DIR/config.json` (0600). O painel nunca os mostra de volta. Nada disso vai para o GitHub.
- Respostas livres do WhatsApp só podem ser enviadas até 24 h depois da última mensagem do aprovador para o número da empresa. Como o fluxo começa com ele encaminhando um anúncio, a janela está sempre aberta.

## Passo a passo na Meta (feito pelo dono)

> Antes de confirmar qualquer tela que fale em **migrar** o número ou **desconectar o aplicativo WhatsApp**, pare e confira: o número da empresa é usado no celular pela equipe.

1. **developers.facebook.com** → Meus apps → Criar app → tipo **Empresa** → ligar ao portfólio **Goullart - Máquinas Pesadas**.
2. No app, adicionar o produto **WhatsApp** → **Configuração da API**: escolher/adicionar o número da empresa e copiar o **ID do número de telefone** (Phone number ID).
3. **Configurações do negócio** (business.facebook.com) → Usuários → **Usuários do sistema** → Adicionar (Administrador) → Atribuir ativos: o app e a conta do WhatsApp → **Gerar token** com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`, sem expiração. Copiar o token.
4. No app: Configurações → Básico → **Chave secreta do app** (App Secret) → Mostrar → copiar.
5. No ADM: **Config. → WhatsApp do Radar** → colar ID do número, número do aprovador (55 + DDD + número), token e App Secret → **Salvar**.
6. Copiar do ADM a **URL de retorno** e o **Token de verificação**. Na Meta: WhatsApp → **Configuração** → Webhook → Editar → colar os dois → Verificar e salvar → em "Campos do webhook", **assinar `messages`**.
7. Publicar o app (modo **Ao vivo**) se a Meta pedir para receber mensagens reais.
8. No ADM, tocar em **Enviar mensagem de teste ao aprovador**. Depois, encaminhar um anúncio de teste.

### Cloudflare

Se a verificação do webhook falhar, confira em Cloudflare → Segurança → Eventos se pedidos para `/adm/entrada/whatsapp` foram bloqueados (modo de luta contra bots ou desafio). Crie uma regra para **pular** desafios só nesse caminho. A segurança do endereço vem da assinatura da Meta, conferida pelo servidor.

## Problemas comuns

- **"Falta configurar" no ADM**: falta algum dos 5 campos (ID, aprovador, token, App Secret, token de verificação).
- **Teste falha com 401/190**: token errado ou expirado. Gere outro no usuário do sistema.
- **Encaminhei e nada chegou**: veja "Última mensagem recebida" no ADM. Se estiver vazio, o webhook não está assinado em `messages` ou a Cloudflare bloqueou.
- **Chegou "Não virou oferta"**: o anúncio não tinha preço, cidade e estado, foto, ou não estava 15% abaixo das parecidas. A oferta fica no Radar do ADM; dá para editar e publicar por lá.
