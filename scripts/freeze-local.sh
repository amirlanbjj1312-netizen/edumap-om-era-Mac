#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +"%Y%m%d-%H%M%S")"
OUT_DIR="$ROOT_DIR/tmp/freeze-$STAMP"
ARCHIVE="$ROOT_DIR/tmp/edumap-freeze-$STAMP.tar.gz"

mkdir -p "$OUT_DIR"
mkdir -p "$ROOT_DIR/tmp"

cat > "$OUT_DIR/manifest.txt" <<EOF
Freeze created: $STAMP
Root: $ROOT_DIR

Included:
- admin-web
- server
- app
- root config files

Not included automatically:
- production database dump
- production .env files from VPS
- nginx config from VPS
- SSL certs from VPS
- external uploads outside repo
EOF

cp "$ROOT_DIR/package.json" "$OUT_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/package-lock.json" "$OUT_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/app.json" "$OUT_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/babel.config.js" "$OUT_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/tailwind.config.js" "$OUT_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/FREEZE_PROJECT.md" "$OUT_DIR/" 2>/dev/null || true

tar -czf "$ARCHIVE" \
  -C "$ROOT_DIR" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='ios/Pods' \
  --exclude='android/.gradle' \
  --exclude='tmp' \
  admin-web \
  server \
  app \
  package.json \
  package-lock.json \
  app.json \
  babel.config.js \
  tailwind.config.js \
  FREEZE_PROJECT.md

echo "Created archive: $ARCHIVE"
echo "Manifest: $OUT_DIR/manifest.txt"
