#!/bin/sh
set -e

if command -v systemctl >/dev/null 2>&1; then
    systemctl stop nexterm-server.service 2>/dev/null || true
    systemctl disable nexterm-server.service 2>/dev/null || true
fi

exit 0