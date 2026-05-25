#!/bin/sh
set -e

if ! getent group nexterm >/dev/null 2>&1; then
    groupadd --system nexterm
fi
if ! getent passwd nexterm >/dev/null 2>&1; then
    useradd --system --gid nexterm --home-dir /var/lib/nexterm-server \
        --shell /usr/sbin/nologin --comment "Nexterm" nexterm
fi

mkdir -p /etc/nexterm-engine
chown root:nexterm /etc/nexterm-engine
chmod 0770 /etc/nexterm-engine
if [ -f /etc/nexterm-engine/config.yaml ]; then
    chown nexterm:nexterm /etc/nexterm-engine/config.yaml
    chmod 0660 /etc/nexterm-engine/config.yaml
fi

if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload || true
    systemctl enable nexterm-engine.service || true
fi

ldconfig 2>/dev/null || true

exit 0
