#!/bin/sh

set -e

ENGINE_LOG_LEVEL=${LOG_LEVEL:-info}

if [ -x /usr/local/bin/nexterm-engine ]; then
    LOCAL_ENGINE_TOKEN=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    export LOCAL_ENGINE_TOKEN

    LOGS_DIR=/app/data/logs
    CRASH_DIR="$LOGS_DIR/crashes"
    ENGINE_LOG="$LOGS_DIR/engine.log"
    MAX_CORES=${NEXTERM_MAX_CORES:-10}
    mkdir -p "$CRASH_DIR"
    ulimit -c unlimited 2>/dev/null || true

    echo "[nexterm] Starting server..."
    node server/index.js &
    SERVER_PID=$!

    sleep 2

    cat > "$CRASH_DIR/config.yaml" <<EOF
server_host: "127.0.0.1"
server_port: ${CONTROL_PLANE_PORT:-7800}
registration_token: "$LOCAL_ENGINE_TOKEN"
tls: false
EOF

    STOPPING=false
    ENGINE_PID=

    preserve_core() {
        ts=$(date +%Y%m%d-%H%M%S 2>/dev/null || echo unknown)
        if [ -f "$CRASH_DIR/core" ]; then
            core_file="$CRASH_DIR/core.$ts.$1"
            mv "$CRASH_DIR/core" "$core_file" 2>/dev/null || true
            echo "[nexterm] Preserved engine core dump: $core_file"
            echo "$ts [SUPERVISOR] engine (pid $1) crashed; core dump saved to $core_file" >> "$ENGINE_LOG"
            core_count=$(ls -1 "$CRASH_DIR"/core.* 2>/dev/null | wc -l)
            if [ "$core_count" -gt "$MAX_CORES" ]; then
                ls -1 "$CRASH_DIR"/core.* 2>/dev/null | sort | head -n "$((core_count - MAX_CORES))" | while read -r old; do
                    rm -f "$old"
                done
            fi
        else
            echo "[nexterm] Engine (pid $1) exited without a core dump"
            echo "$ts [SUPERVISOR] engine (pid $1) exited unexpectedly; no core dump was produced" >> "$ENGINE_LOG"
        fi
    }

    start_engine() {
        echo "[nexterm] Starting local engine..."
        cd "$CRASH_DIR" && /usr/local/bin/nexterm-engine 2>> "$ENGINE_LOG" &
        ENGINE_PID=$!
        cd /app
    }

    cleanup() {
        STOPPING=true
        [ -n "$ENGINE_PID" ] && kill "$ENGINE_PID" 2>/dev/null
        [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
        wait
        exit 0
    }
    trap cleanup INT TERM

    start_engine

    while true; do
        sleep 1

        if [ "$STOPPING" = true ]; then
            break
        fi

        if ! kill -0 "$SERVER_PID" 2>/dev/null; then
            echo "[nexterm] Server exited, shutting down..."
            cleanup
        fi

        if ! kill -0 "$ENGINE_PID" 2>/dev/null; then
            echo "[nexterm] Engine crashed, restarting in 3 seconds..."
            wait "$ENGINE_PID" 2>/dev/null || true
            preserve_core "$ENGINE_PID"
            sleep 3
            start_engine
        fi
    done
else
    echo "[nexterm] Starting server..."
    exec node server/index.js
fi
