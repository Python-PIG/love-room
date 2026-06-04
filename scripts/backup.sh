#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/love-room}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/love-room-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"

mkdir -p "$DEST"

if [ -f "$APP_DIR/data/app.sqlite" ]; then
  sqlite3 "$APP_DIR/data/app.sqlite" ".backup '$DEST/app.sqlite'"
elif [ -f "$APP_DIR/data/app.sqlite" ]; then
  cp "$APP_DIR/data/app.sqlite" "$DEST/app.sqlite"
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
videos=not-included
EOF

echo "Backup created: $DEST"
