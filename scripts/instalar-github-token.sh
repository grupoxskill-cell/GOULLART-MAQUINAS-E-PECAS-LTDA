#!/usr/bin/env bash
# Guarda no servidor o token do GitHub (só leitura) que deixa o site se atualizar com o repositório privado.
# Uso (como root):  TOKEN='github_pat_...' bash instalar-github-token.sh
# O token fica em /etc/goullart/github-token (só root lê) e nunca é mostrado na tela.
set -euo pipefail

REPO="grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA"
GH_API="${GH_API:-https://api.github.com}"
TOKEN_FILE="${TOKEN_FILE:-/etc/goullart/github-token}"
TOKEN="$(printf '%s' "${TOKEN:-}" | tr -d '[:space:]')"

if [ -z "$TOKEN" ]; then
  echo "ERRO: informe o token assim: TOKEN='github_pat_...' bash instalar-github-token.sh"
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
(umask 077; printf 'Authorization: Bearer %s\n' "$TOKEN" > "$TMP/auth")
# Testa antes de gravar: um token errado não substitui um que já funciona.
if ! curl -fsS -o /dev/null -H "@$TMP/auth" -H "X-GitHub-Api-Version: 2022-11-28" "$GH_API/repos/$REPO/commits/master"; then
  echo "ERRO: token recusado pelo GitHub (confira se dá acesso de leitura a $REPO). Nada foi alterado."
  exit 1
fi

mkdir -p "$(dirname "$TOKEN_FILE")"
chmod 700 "$(dirname "$TOKEN_FILE")"
(umask 077; printf '%s\n' "$TOKEN" > "$TOKEN_FILE.tmp")
chmod 600 "$TOKEN_FILE.tmp"
mv "$TOKEN_FILE.tmp" "$TOKEN_FILE"
echo "TOKEN OK: guardado em $TOKEN_FILE. O site continua se atualizando mesmo com o repositório privado."
