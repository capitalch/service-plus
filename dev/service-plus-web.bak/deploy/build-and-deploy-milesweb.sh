#!/usr/bin/env bash
#
# Build service-plus-web as a static export and push it to milesweb.in.
#
# Usage:
#   cp deploy/.env.deploy.example deploy/.env.deploy   # once, then fill in real values
#   ./deploy/build-and-deploy-milesweb.sh
#
# See deploy/README.md for the full runbook (domain vs subdomain, SSH vs FTP).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_DEPLOY_FILE="$SCRIPT_DIR/.env.deploy"

if [[ ! -f "$ENV_DEPLOY_FILE" ]]; then
  echo "Missing $ENV_DEPLOY_FILE — copy deploy/.env.deploy.example and fill it in first." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_DEPLOY_FILE"

: "${DEPLOY_METHOD:?Set DEPLOY_METHOD=ssh or ftp in deploy/.env.deploy}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found on PATH. Install it (corepack enable, or npm i -g pnpm) and retry." >&2
  exit 1
fi

cd "$PROJECT_DIR"

echo "==> Installing dependencies (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Building static export"
pnpm build

OUT_DIR="$PROJECT_DIR/out"
if [[ ! -d "$OUT_DIR" ]]; then
  echo "Build did not produce $OUT_DIR — check next.config.ts has output: 'export'." >&2
  exit 1
fi

echo "==> Writing .htaccess (https redirect + long cache for static assets)"
cat > "$OUT_DIR/.htaccess" <<'HTACCESS'
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Long cache for hashed Next.js assets
<IfModule mod_headers.c>
  <FilesMatch "\.(js|css|woff2)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>

# Static export 404 fallback
ErrorDocument 404 /404.html
HTACCESS

case "$DEPLOY_METHOD" in
  ssh)
    : "${DEPLOY_SSH_HOST:?Set DEPLOY_SSH_HOST}"
    : "${DEPLOY_SSH_USER:?Set DEPLOY_SSH_USER}"
    : "${DEPLOY_REMOTE_PATH:?Set DEPLOY_REMOTE_PATH}"
    PORT="${DEPLOY_SSH_PORT:-22}"
    SSH_OPTS=(-p "$PORT")
    RSYNC_SSH="ssh -p $PORT"
    if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
      SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")
      RSYNC_SSH="ssh -p $PORT -i $DEPLOY_SSH_KEY"
    fi

    echo "==> Syncing ./out/ to $DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:$DEPLOY_REMOTE_PATH/ via rsync"
    rsync -az --delete -e "$RSYNC_SSH" \
      "$OUT_DIR"/ "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:$DEPLOY_REMOTE_PATH/"
    ;;
  ftp)
    : "${DEPLOY_FTP_HOST:?Set DEPLOY_FTP_HOST}"
    : "${DEPLOY_FTP_USER:?Set DEPLOY_FTP_USER}"
    : "${DEPLOY_FTP_PASSWORD:?Set DEPLOY_FTP_PASSWORD}"
    : "${DEPLOY_FTP_REMOTE_PATH:?Set DEPLOY_FTP_REMOTE_PATH}"
    if ! command -v lftp >/dev/null 2>&1; then
      echo "lftp not found on PATH. Install it (apt install lftp) or switch DEPLOY_METHOD=ssh." >&2
      exit 1
    fi

    echo "==> Mirroring ./out/ to $DEPLOY_FTP_HOST:$DEPLOY_FTP_REMOTE_PATH/ via lftp"
    lftp -u "$DEPLOY_FTP_USER,$DEPLOY_FTP_PASSWORD" "$DEPLOY_FTP_HOST" <<LFTP
mirror -R --delete "$OUT_DIR" "$DEPLOY_FTP_REMOTE_PATH"
bye
LFTP
    ;;
  *)
    echo "Unknown DEPLOY_METHOD='$DEPLOY_METHOD' — expected 'ssh' or 'ftp'." >&2
    exit 1
    ;;
esac

echo "==> Deploy complete"

if [[ -n "${DEPLOY_SITE_URL:-}" ]]; then
  echo "==> Smoke-checking $DEPLOY_SITE_URL"
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$DEPLOY_SITE_URL")"
  echo "HTTP $code from $DEPLOY_SITE_URL"
  if [[ "$code" != "200" ]]; then
    echo "Warning: expected 200, got $code — check the site manually." >&2
  fi
else
  echo "Set DEPLOY_SITE_URL in deploy/.env.deploy to enable the post-deploy smoke check."
fi
