#!/bin/sh
set -e

if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload || true
fi

ldconfig 2>/dev/null || true

exit 0
