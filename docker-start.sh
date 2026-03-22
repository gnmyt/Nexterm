#!/bin/bash

set -e

ENGINE_LOG_LEVEL=${LOG_LEVEL:-info}

if [ -x /usr/local/bin/nexterm-engine ]; then
    LOCAL_ENGINE_TOKEN=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    export LOCAL_ENGINE_TOKEN

    echo "[nexterm] Starting server..."
    node server/index.js &
    SERVER_PID=$!

    sleep 2

    echo "[nexterm] Starting local engine..."
    mkdir -p /tmp/nexterm-engine
    cat > /tmp/nexterm-engine/config.yaml <<EOF
server_host: "127.0.0.1"
server_port: ${CONTROL_PLANE_PORT:-7800}
registration_token: "$LOCAL_ENGINE_TOKEN"
tls: false
EOF
    cd /tmp/nexterm-engine && /usr/local/bin/nexterm-engine &
    ENGINE_PID=$!
    cd /app

    cleanup() {
        [ -n "$ENGINE_PID" ] && kill "$ENGINE_PID" 2>/dev/null
        [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
        wait
        exit 0
    }
    trap cleanup SIGINT SIGTERM

    wait -n
    cleanup
else
    echo "[nexterm] Starting server..."
    exec node server/index.js
fi
