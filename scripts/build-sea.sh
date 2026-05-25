#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/build/sea"
STAGE_DIR="$BUILD_DIR/stage"
PAYLOAD_DIR="$STAGE_DIR/app"
BIN_NAME="${BIN_NAME:-nexterm-server}"

NODE_BIN="${NODE_BIN:-$(command -v node)}"
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 26 ]; then
    echo "Node 26+ required for --build-sea (have $($NODE_BIN --version))" >&2
    exit 1
fi

VERSION="$("$NODE_BIN" -p 'require("'"$ROOT"'/package.json").version')"

echo "[build-sea] node $($NODE_BIN --version) version=$VERSION"
rm -rf "$BUILD_DIR"
mkdir -p "$PAYLOAD_DIR"

echo "[build-sea] staging app payload"
cp -r "$ROOT/server" "$PAYLOAD_DIR/server"
rm -rf "$PAYLOAD_DIR/server/data"
cp "$ROOT/package.json" "$ROOT/yarn.lock" "$PAYLOAD_DIR/"

if [ ! -d "$ROOT/client/dist" ]; then
    (cd "$ROOT/client" && yarn build)
fi
cp -r "$ROOT/client/dist" "$PAYLOAD_DIR/dist"

(cd "$PAYLOAD_DIR" && yarn install --production --frozen-lockfile --ignore-engines --non-interactive)

find "$PAYLOAD_DIR/node_modules" \
    \( -name '*.map' -o -name '*.md' -o -name '*.markdown' \
       -o -name '*.ts' ! -name '*.d.ts' \
       -o -name 'CHANGELOG*' -o -name 'LICENSE*' -o -name 'AUTHORS*' \
       -o -name '.github' -o -name 'test' -o -name 'tests' -o -name '__tests__' \
       -o -name 'example' -o -name 'examples' -o -name 'docs' \
    \) -prune -exec rm -rf {} + 2>/dev/null || true

TARBALL="$STAGE_DIR/app-payload.tar.gz"
tar -C "$STAGE_DIR" --format=ustar -cf - app | gzip -9 > "$TARBALL"
du -sh "$TARBALL"

MANIFEST="$STAGE_DIR/app-manifest.json"
printf '{"version":"%s"}' "$VERSION" > "$MANIFEST"

CONFIG_FILE="$STAGE_DIR/sea-config.json"
if command -v cygpath >/dev/null 2>&1; then
    to_native() { cygpath -m "$1"; }
else
    to_native() { printf '%s' "$1"; }
fi

MAIN_PATH="$(to_native "$ROOT/scripts/sea-launcher.js")"
OUTPUT_PATH="$(to_native "$BUILD_DIR/$BIN_NAME")"
TARBALL_PATH="$(to_native "$TARBALL")"
MANIFEST_PATH="$(to_native "$MANIFEST")"

cat > "$CONFIG_FILE" <<EOF
{
    "main": "$MAIN_PATH",
    "output": "$OUTPUT_PATH",
    "disableExperimentalSEAWarning": true,
    "assets": {
        "app-payload.tar.gz": "$TARBALL_PATH",
        "app-manifest.json": "$MANIFEST_PATH"
    }
}
EOF

"$NODE_BIN" --build-sea="$CONFIG_FILE"
chmod +x "$BUILD_DIR/$BIN_NAME"

rm -rf "$STAGE_DIR"
ls -lh "$BUILD_DIR/$BIN_NAME"
