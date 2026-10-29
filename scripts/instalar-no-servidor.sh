#!/usr/bin/env bash
# Instala a versão estática do site (branch gh-pages) no servidor aaPanel para
# www.goullartmaquinaspesadas.com.br. Pode ser rodado de novo para atualizar.
# O site antigo continua no disco e a configuração do nginx ganha um backup, para poder voltar atrás.
set -euo pipefail

DOMINIO="${DOMINIO:-goullartmaquinaspesadas.com.br}"
REPO="grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA"
VHOST_DIR="${VHOST_DIR:-/www/server/panel/vhost/nginx}"
DESTINO="${DESTINO:-/www/wwwroot/goullart-site}"
NGINX="${NGINX:-$(command -v nginx || echo /www/server/nginx/sbin/nginx)}"
DATA=$(date +%Y%m%d-%H%M%S)

CONF=$(grep -lE "server_name.*[[:space:]](www\.)?${DOMINIO//./\\.}([[:space:];]|$)" "$VHOST_DIR"/*.conf 2>/dev/null | head -1 || true)
if [ -z "$CONF" ]; then
  echo "ERRO: não achei a configuração do nginx para $DOMINIO em $VHOST_DIR. Nada foi alterado."
  ls -1 "$VHOST_DIR" 2>/dev/null || true
  exit 1
fi
ROOT_ATUAL=$(grep -m1 -E '^[[:space:]]*root[[:space:]]' "$CONF" | awk '{print $2}' | tr -d ';')
echo "Configuração: $CONF"
echo "Pasta atual do site: $ROOT_ATUAL"

TMP=$(mktemp -d)
curl -fsSL "https://github.com/$REPO/archive/refs/heads/gh-pages.tar.gz" | tar -xz -C "$TMP"
[ -f "$TMP"/*-gh-pages/index.html ] || { echo "ERRO: download do site incompleto. Nada foi alterado."; exit 1; }
rm -rf "$DESTINO.novo"
mv "$TMP"/*-gh-pages "$DESTINO.novo"
rm -f "$DESTINO.novo/CNAME"
rm -rf "$DESTINO"
mv "$DESTINO.novo" "$DESTINO"
chown -R www:www "$DESTINO" 2>/dev/null || true
echo "Site novo copiado para: $DESTINO"

if [ "$ROOT_ATUAL" != "$DESTINO" ]; then
  BACKUP="$CONF.bak-$DATA"
  cp "$CONF" "$BACKUP"
  sed -i -E "0,/^[[:space:]]*root[[:space:]]+[^;]+;/s##    root $DESTINO;#" "$CONF"
  if "$NGINX" -t; then
    "$NGINX" -s reload
    echo "PRONTO: $DOMINIO agora mostra o site novo."
    echo "Para voltar ao site antigo: cp '$BACKUP' '$CONF' && $NGINX -s reload"
  else
    cp "$BACKUP" "$CONF"
    echo "ERRO: o nginx recusou a configuração; o site antigo foi mantido."
    exit 1
  fi
else
  echo "PRONTO: site atualizado."
fi
