#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENGINE_SRC="$PROJECT_ROOT/engine"
ENGINE_BUILD="$ENGINE_SRC/build"
GUACD_SRC="$PROJECT_ROOT/vendor/guacamole-server"
ENGINE_PID=""

ENGINE_LOG_LEVEL=${LOG_LEVEL:-info}
ENGINE_HOST=${ENGINE_HOST:-127.0.0.1}
ENGINE_PORT=${ENGINE_PORT:-7800}

cleanup() {
    [ -n "$ENGINE_PID" ] && kill $ENGINE_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

ensure_guacd_built() {
    local DIST_DIR="$GUACD_SRC/dist"
    if [ ! -f "$DIST_DIR/lib/libguac.so" ] && [ ! -f "$DIST_DIR/lib/libguac.dylib" ]; then
        echo "[engine] Building guacamole-server first..."
        cd "$GUACD_SRC"
        CONFIGURE_OPTS="--prefix=$DIST_DIR --with-freerdp-plugin-dir=$DIST_DIR/lib/freerdp2"

        if [ ! -f Makefile ]; then
            autoreconf -fi && ./configure $CONFIGURE_OPTS
        fi

        make -j$(nproc)
        make install
        echo "[engine] guacamole-server built successfully"
    fi
}

build() {
    echo "[engine] Building nexterm-engine..."

    ensure_guacd_built

    mkdir -p "$ENGINE_BUILD"
    cd "$ENGINE_BUILD"

    cmake "$ENGINE_SRC" \
        -DCMAKE_BUILD_TYPE=${BUILD_TYPE:-Debug}

    make -j$(nproc)
    echo "[engine] Build complete"
}

start_engine() {
    [ -n "$ENGINE_PID" ] && kill $ENGINE_PID 2>/dev/null && sleep 1
    echo "[engine] Starting (log level: $ENGINE_LOG_LEVEL, server: $ENGINE_HOST:$ENGINE_PORT)..."

    export LD_LIBRARY_PATH="$GUACD_SRC/dist/lib:$LD_LIBRARY_PATH"

    "$ENGINE_BUILD/nexterm-engine" \
        --host "$ENGINE_HOST" \
        --port "$ENGINE_PORT" \
        --log "$ENGINE_LOG_LEVEL" &
    ENGINE_PID=$!
}

build && start_engine

echo "[engine] Watching for changes..."
while inotifywait -r -e modify,create,delete "$ENGINE_SRC/src" "$PROJECT_ROOT/schema" 2>/dev/null; do
    echo "[engine] Changes detected, rebuilding..."
    build && start_engine
done
