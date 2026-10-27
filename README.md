# Goullart Máquinas e Peças LTDA

Site com chat de atendimento integrado ao ChatGPT (API da OpenAI).

## Como rodar

1. Instale o [Node.js](https://nodejs.org) 22.9 ou superior.
2. Copie `.env.example` para `.env` e coloque sua chave da OpenAI em `OPENAI_API_KEY`.
3. Rode:

   ```bash
   npm start
   ```

4. Abra http://localhost:3000 e clique em **💬 Atendimento**.

Não há dependências para instalar.

## Publicar na internet (Render, plano gratuito)

1. Crie uma conta em https://render.com entrando com o GitHub.
2. No painel, clique em **New → Blueprint** e escolha este repositório.
   O Render lê o arquivo `render.yaml` e configura tudo sozinho.
3. Quando pedir `OPENAI_API_KEY`, cole a sua chave da OpenAI e clique em **Apply**.
4. Em alguns minutos o site fica no ar num endereço `https://….onrender.com`.

A cada novo commit no branch `master`, o Render publica a nova versão automaticamente.
No plano gratuito o site "dorme" após 15 minutos sem visitas e leva cerca de 1 minuto
para acordar na próxima visita.

## Configuração

| Variável         | Descrição                                          | Padrão        |
| ---------------- | -------------------------------------------------- | ------------- |
| `OPENAI_API_KEY` | Chave da API da OpenAI (obrigatória)               | —             |
| `OPENAI_MODEL`   | Modelo usado no chat                               | `gpt-4o-mini` |
| `SYSTEM_PROMPT`  | Instruções do assistente (personalidade, regras)   | texto em `server.js` |
| `PORT`           | Porta do servidor                                  | `3000`        |

## Segurança

- A chave da OpenAI fica só no servidor; o navegador conversa apenas com `/api/chat`.
- Cada IP pode enviar até 20 mensagens por minuto.
- Nunca faça commit do arquivo `.env`.
