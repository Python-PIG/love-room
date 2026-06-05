#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/love-room}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/love-room-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"

mkdir -p "$DEST"

if [ -f "$APP_DIR/data/app.sqlite" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$APP_DIR/data/app.sqlite" ".backup '$DEST/app.sqlite'"
  else
    cp "$APP_DIR/data/app.sqlite" "$DEST/app.sqlite"
    [ -f "$APP_DIR/data/app.sqlite-wal" ] && cp "$APP_DIR/data/app.sqlite-wal" "$DEST/app.sqlite-wal"
    [ -f "$APP_DIR/data/app.sqlite-shm" ] && cp "$APP_DIR/data/app.sqlite-shm" "$DEST/app.sqlite-shm"
  fi
fi

[ -f "$APP_DIR/.env" ] && cp "$APP_DIR/.env" "$DEST/.env"

if [ -d "$APP_DIR/uploads/drawings" ]; then
  tar -C "$APP_DIR" -czf "$DEST/drawings.tgz" uploads/drawings
fi

cat > "$DEST/manifest.txt" <<EOF
created_at=$STAMP
app_dir=$APP_DIR
backup_root=$BACKUP_ROOT
includes=app.sqlite,.env,uploads/drawings
sqlite_backup_tool=$(command -v sqlite3 >/dev/null 2>&1 && echo sqlite3 || echo cp)
videos=not-included
EOF

echo "Backup created: $DEST"
