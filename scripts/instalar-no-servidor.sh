#!/usr/bin/env bash
# Instala o site da GOULLART no servidor aaPanel (www.goullartmaquinaspesadas.com.br):
#  1. site público estático (branch gh-pages), servido direto pelo nginx;
#  2. ADM (Radar, Pátio, CRM, Encontros) como serviço Node em 127.0.0.1, atrás de /adm,
#     com dados privados em /www/goullart-dados (fora do GitHub e da pasta pública);
#  3. atualização automática pelo cron a cada 10 minutos.
# O site antigo continua no disco e a configuração do nginx ganha backup antes de qualquer troca.
#
# Rodado à mão (como root), instala tudo e grava uma cópia deste script em
# /usr/local/bin/goullart-atualizar-site, que o cron roda com AUTOMATICO=1.
set -euo pipefail

DOMINIO="${DOMINIO:-goullartmaquinaspesadas.com.br}"
REPO="grupoxskill-cell/GOULLART-MAQUINAS-E-PECAS-LTDA"
SCRIPT_URL="https://raw.githubusercontent.com/$REPO/master/scripts/instalar-no-servidor.sh"
VHOST_DIR="${VHOST_DIR:-/www/server/panel/vhost/nginx}"
DESTINO="${DESTINO:-/www/wwwroot/goullart-site}"
APP_DIR="${APP_DIR:-/opt/goullart-app}"
DADOS="${DADOS:-/www/goullart-dados}"
PORTA="${PORTA:-3210}"
USUARIO="${USUARIO:-goullart}"
INCLUDE="${INCLUDE:-/www/server/panel/vhost/goullart-app.inc}"
SERVICO="${SERVICO:-/etc/systemd/system/goullart-app.service}"
NGINX="${NGINX:-$(command -v nginx || echo /www/server/nginx/sbin/nginx)}"
BIN="${BIN:-/usr/local/bin/goullart-atualizar-site}"
CRON_FILE="${CRON_FILE:-/etc/cron.d/goullart-site}"
AUTOMATICO="${AUTOMATICO:-0}"
SEM_APP="${SEM_APP:-0}"
DATA=$(date +%Y%m%d-%H%M%S)

CONF=$(grep -lE "server_name.*[[:space:]](www\.)?${DOMINIO//./\\.}([[:space:];]|$)" "$VHOST_DIR"/*.conf 2>/dev/null | head -1 || true)
if [ -z "$CONF" ]; then
  echo "ERRO: não achei a configuração do nginx para $DOMINIO em $VHOST_DIR. Nada foi alterado."
  ls -1 "$VHOST_DIR" 2>/dev/null || true
  exit 1
fi
ROOT_ATUAL=$(grep -m1 -E '^[[:space:]]*root[[:space:]]' "$CONF" | awk '{print $2}' | tr -d ';')
BACKUP=""
fazer_backup() { [ -n "$BACKUP" ] || { BACKUP="$CONF.bak-$DATA"; cp "$CONF" "$BACKUP"; }; }
recarregar_nginx() {
  if "$NGINX" -t; then
    "$NGINX" -s reload
  else
    cp "$BACKUP" "$CONF"
    echo "ERRO: o nginx recusou a configuração; a configuração anterior foi restaurada."
    exit 1
  fi
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Baixa um branch do GitHub para uma pasta, trocando a antiga sem deixar o site pela metade.
# Devolve 0 se instalou versão nova, 1 se já estava atualizado.
sincronizar() {
  local branch="$1" pasta="$2" teste="$3" versao origem
  versao=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/$REPO/commits/$branch" || true)
  if [ -n "$versao" ] && [ -d "$pasta" ] && [ "$(cat "$pasta/.versao" 2>/dev/null)" = "$versao" ]; then return 1; fi
  rm -rf "$TMP/$branch" && mkdir -p "$TMP/$branch"
  curl -fsSL "https://github.com/$REPO/archive/${versao:-refs/heads/$branch}.tar.gz" | tar -xz -C "$TMP/$branch"
  origem=$(dirname "$(ls "$TMP/$branch"/*/"$teste" 2>/dev/null | head -1)")
  [ -f "$origem/$teste" ] || { echo "ERRO: download de $branch incompleto. Nada foi alterado."; exit 1; }
  rm -f "$origem/CNAME"
  [ -n "$versao" ] && echo "$versao" > "$origem/.versao"
  rm -rf "$pasta.novo" "$pasta.velho"
  mv "$origem" "$pasta.novo"
  [ -d "$pasta" ] && mv "$pasta" "$pasta.velho"
  mv "$pasta.novo" "$pasta"
  rm -rf "$pasta.velho"
  echo "$(date '+%F %T') $branch atualizado em $pasta (versão ${versao:-desconhecida})"
  return 0
}

# ---------- 1. Site público estático ----------
if sincronizar gh-pages "$DESTINO" index.html; then chown -R www:www "$DESTINO" 2>/dev/null || true; fi
if [ "$ROOT_ATUAL" != "$DESTINO" ]; then
  fazer_backup
  sed -i -E "0,/^[[:space:]]*root[[:space:]]+[^;]+;/s##    root $DESTINO;#" "$CONF"
  recarregar_nginx
  echo "PRONTO: $DOMINIO agora mostra o site novo."
  echo "Para voltar ao site antigo: cp '$BACKUP' '$CONF' && $NGINX -s reload"
fi

# ---------- 2. ADM (serviço Node) ----------
NODE=$(command -v node || true)
versao_node() { "$NODE" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$SEM_APP" != "1" ]; then
  if [ -z "$NODE" ] || [ "$(versao_node)" -lt 22 ]; then
    if [ "$AUTOMATICO" = "1" ]; then echo "Node.js 22 ausente; rode a instalação manual."; exit 0; fi
    echo "Instalando Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y nodejs >/dev/null
    NODE=$(command -v node)
  fi

  id "$USUARIO" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$USUARIO"
  mkdir -p "$DADOS" && chown "$USUARIO:$USUARIO" "$DADOS" && chmod 700 "$DADOS"

  APP_NOVO=0
  if sincronizar master "$APP_DIR" server.js; then APP_NOVO=1; fi
  chown -R root:root "$APP_DIR"

  if [ "$AUTOMATICO" != "1" ]; then
    runuser -u "$USUARIO" -- env DATA_DIR="$DADOS" "$NODE" "$APP_DIR/scripts/criar-senha.mjs"
  fi

  cat > "$SERVICO.tmp" <<UNIT
[Unit]
Description=GOULLART site e ADM
After=network.target

[Service]
User=$USUARIO
Environment=PORT=$PORTA HOST=127.0.0.1 DATA_DIR=$DADOS NODE_ENV=production
ExecStart=$NODE $APP_DIR/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DADOS

[Install]
WantedBy=multi-user.target
UNIT
  if ! cmp -s "$SERVICO.tmp" "$SERVICO" 2>/dev/null; then mv "$SERVICO.tmp" "$SERVICO"; systemctl daemon-reload; APP_NOVO=1; else rm -f "$SERVICO.tmp"; fi
  systemctl enable goullart-app >/dev/null 2>&1 || true
  if [ "$APP_NOVO" = "1" ] || ! systemctl is-active --quiet goullart-app; then systemctl restart goullart-app; fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fsS "http://127.0.0.1:$PORTA/health" >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS "http://127.0.0.1:$PORTA/health" >/dev/null || { echo "ERRO: o ADM não respondeu. Veja: journalctl -u goullart-app -n 50"; exit 1; }

  cat > "$INCLUDE" <<NGX
# GOULLART: ADM, fotos do ADM e catálogo dinâmico vão para o serviço Node local.
location ^~ /adm {
    proxy_pass http://127.0.0.1:$PORTA;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    client_max_body_size 16m;
    add_header X-Robots-Tag "noindex, nofollow" always;
}
location ^~ /fotos/ {
    proxy_pass http://127.0.0.1:$PORTA;
    proxy_set_header Host \$host;
}
location = /maquinas.json {
    proxy_pass http://127.0.0.1:$PORTA;
    proxy_set_header Host \$host;
}
NGX
  if ! grep -qF "include $INCLUDE;" "$CONF"; then
    fazer_backup
    sed -i -E "0,/^[[:space:]]*root[[:space:]]+[^;]+;/s##&\n    include $INCLUDE;#" "$CONF"
    recarregar_nginx
    echo "ADM LIGADO: https://www.$DOMINIO/adm"
  elif [ "$APP_NOVO" = "1" ]; then
    echo "ADM atualizado."
  fi
fi

# ---------- 3. Atualização automática ----------
if [ "$AUTOMATICO" != "1" ]; then
  curl -fsSL "$SCRIPT_URL" -o "$BIN.tmp" && bash -n "$BIN.tmp" && chmod 755 "$BIN.tmp" && mv "$BIN.tmp" "$BIN"
  cat > "$CRON_FILE" <<CRON
# Atualiza o site e o ADM da GOULLART a partir do GitHub (instalado por $SCRIPT_URL)
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root AUTOMATICO=1 flock -n /tmp/goullart-site.lock $BIN >> /var/log/goullart-site.log 2>&1
CRON
  chmod 644 "$CRON_FILE"
  echo "ATUALIZAÇÃO AUTOMÁTICA LIGADA: o servidor confere o GitHub a cada 10 minutos."
  echo "PRONTO."
fi
