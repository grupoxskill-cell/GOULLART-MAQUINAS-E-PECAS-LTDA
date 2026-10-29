#!/usr/bin/env bash
# Instala a versão estática do site (branch gh-pages) no servidor aaPanel para
# www.goullartmaquinaspesadas.com.br e liga a atualização automática.
# O site antigo continua no disco e a configuração do nginx ganha um backup, para poder voltar atrás.
#
# Rodado à mão (como root), instala o site e grava uma cópia deste script em
# /usr/local/bin/goullart-atualizar-site, que o cron roda a cada 10 minutos com AUTOMATICO=1.
# A cópia local só baixa arquivos estáticos do GitHub; nenhum código remoto roda como root pelo cron.
set -euo pipefail

DOMINIO="${DOMINIO:-goullartmaquinaspesadas.com.br}"
REPO="grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA"
SCRIPT_URL="https://raw.githubusercontent.com/$REPO/master/scripts/instalar-no-servidor.sh"
VHOST_DIR="${VHOST_DIR:-/www/server/panel/vhost/nginx}"
DESTINO="${DESTINO:-/www/wwwroot/goullart-site}"
NGINX="${NGINX:-$(command -v nginx || echo /www/server/nginx/sbin/nginx)}"
BIN="${BIN:-/usr/local/bin/goullart-atualizar-site}"
CRON_FILE="${CRON_FILE:-/etc/cron.d/goullart-site}"
AUTOMATICO="${AUTOMATICO:-0}"
DATA=$(date +%Y%m%d-%H%M%S)

CONF=$(grep -lE "server_name.*[[:space:]](www\.)?${DOMINIO//./\\.}([[:space:];]|$)" "$VHOST_DIR"/*.conf 2>/dev/null | head -1 || true)
if [ -z "$CONF" ]; then
  echo "ERRO: não achei a configuração do nginx para $DOMINIO em $VHOST_DIR. Nada foi alterado."
  ls -1 "$VHOST_DIR" 2>/dev/null || true
  exit 1
fi
ROOT_ATUAL=$(grep -m1 -E '^[[:space:]]*root[[:space:]]' "$CONF" | awk '{print $2}' | tr -d ';')

# Versão publicada no GitHub; no modo automático não faz nada se o site já está nela.
VERSAO=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/$REPO/commits/gh-pages" || true)
if [ "$AUTOMATICO" = "1" ] && [ -n "$VERSAO" ] && [ "$ROOT_ATUAL" = "$DESTINO" ] \
  && [ "$(cat "$DESTINO/.versao" 2>/dev/null)" = "$VERSAO" ]; then
  exit 0
fi
echo "$(date '+%F %T') Configuração: $CONF"
echo "Pasta atual do site: $ROOT_ATUAL"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/$REPO/archive/${VERSAO:-refs/heads/gh-pages}.tar.gz" | tar -xz -C "$TMP"
PASTA=$(dirname "$(ls "$TMP"/*/index.html 2>/dev/null | head -1)")
[ -f "$PASTA/index.html" ] || { echo "ERRO: download do site incompleto. Nada foi alterado."; exit 1; }
rm -f "$PASTA/CNAME"
[ -n "$VERSAO" ] && echo "$VERSAO" > "$PASTA/.versao"
rm -rf "$DESTINO.novo" "$DESTINO.velho"
mv "$PASTA" "$DESTINO.novo"
chown -R www:www "$DESTINO.novo" 2>/dev/null || true
[ -d "$DESTINO" ] && mv "$DESTINO" "$DESTINO.velho"
mv "$DESTINO.novo" "$DESTINO"
rm -rf "$DESTINO.velho"
echo "Site novo copiado para: $DESTINO (versão ${VERSAO:-desconhecida})"

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

if [ "$AUTOMATICO" != "1" ]; then
  curl -fsSL "$SCRIPT_URL" -o "$BIN.tmp" && bash -n "$BIN.tmp" && chmod 755 "$BIN.tmp" && mv "$BIN.tmp" "$BIN"
  cat > "$CRON_FILE" <<CRON
# Atualiza o site da GOULLART a partir do GitHub (instalado por $SCRIPT_URL)
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root AUTOMATICO=1 flock -n /tmp/goullart-site.lock $BIN >> /var/log/goullart-site.log 2>&1
CRON
  chmod 644 "$CRON_FILE"
  echo "ATUALIZAÇÃO AUTOMÁTICA LIGADA: o servidor confere o GitHub a cada 10 minutos."
fi
