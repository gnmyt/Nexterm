#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GUACD_SRC="$PROJECT_ROOT/vendor/guacamole-server"
GUACD_PID=""

GUACD_LOG_LEVEL=${LOG_LEVEL:-debug}
case "$GUACD_LOG_LEVEL" in
    error)   GUACD_ARGS="-L error" ;;
    warn)    GUACD_ARGS="-L warning" ;;
    system|info) GUACD_ARGS="-L info" ;;
    verbose) GUACD_ARGS="-L debug" ;;
    debug)   GUACD_ARGS="-L trace" ;;
    *)       GUACD_ARGS="-L info" ;;
esac

cleanup() {
    [ -n "$GUACD_PID" ] && kill $GUACD_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

build() {
    echo "[guacd] Building..."
    cd "$GUACD_SRC"
    
    DIST_DIR="$GUACD_SRC/dist"
    CONFIGURE_OPTS="--prefix=$DIST_DIR --with-freerdp-plugin-dir=$DIST_DIR/lib/freerdp2"
    
    if [ -f Makefile ]; then
        CURRENT_PREFIX=$(grep "^prefix = " Makefile | sed 's/prefix = //')
        if [ "$CURRENT_PREFIX" != "$DIST_DIR" ]; then
            echo "[guacd] Prefix mismatch, reconfiguring..."
            make distclean 2>/dev/null || true
            autoreconf -fi && ./configure $CONFIGURE_OPTS
        fi
    else
        autoreconf -fi && ./configure $CONFIGURE_OPTS
    fi
    
    make -j$(nproc)
    echo "[guacd] Installing to dist..."
    make install
}

start_guacd() {
    [ -n "$GUACD_PID" ] && kill $GUACD_PID 2>/dev/null && sleep 1
    echo "[guacd] Starting (log level: $GUACD_LOG_LEVEL)..."

    export LD_LIBRARY_PATH="$GUACD_SRC/dist/lib:$LD_LIBRARY_PATH"
    export GUACD_HOME="$GUACD_SRC/dist"
    
    "$GUACD_SRC/src/guacd/guacd" -b 0.0.0.0 -f $GUACD_ARGS &
    GUACD_PID=$!
}

build && start_guacd

echo "[guacd] Watching for changes..."
while inotifywait -r -e modify,create,delete "$GUACD_SRC/src" 2>/dev/null; do
    echo "[guacd] Changes detected, rebuilding..."
    build && start_guacd
done
