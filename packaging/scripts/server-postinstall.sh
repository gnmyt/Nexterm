#!/bin/sh
set -e

if ! getent group nexterm >/dev/null 2>&1; then
    groupadd --system nexterm
fi
if ! getent passwd nexterm >/dev/null 2>&1; then
    useradd --system --gid nexterm --home-dir /var/lib/nexterm-server \
        --shell /usr/sbin/nologin --comment "Nexterm" nexterm
fi

mkdir -p /var/lib/nexterm-server
chown -R nexterm:nexterm /var/lib/nexterm-server
chmod 0750 /var/lib/nexterm-server

mkdir -p /etc/nexterm-server
chown root:nexterm /etc/nexterm-server
chmod 0750 /etc/nexterm-server
if [ -f /etc/nexterm-server/server.env ]; then
    chown root:nexterm /etc/nexterm-server/server.env
    chmod 0640 /etc/nexterm-server/server.env
fi

if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload || true
    systemctl enable nexterm-server.service || true
fi

if ! grep -qE '^ENCRYPTION_KEY=..' /etc/nexterm-server/server.env 2>/dev/null; then
    if command -v openssl >/dev/null 2>&1; then
        KEY=$(openssl rand -hex 32)
    else
        KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    fi

    if [ -f /etc/nexterm-server/server.env ] && grep -q '^#\s*ENCRYPTION_KEY=' /etc/nexterm-server/server.env; then
        sed -i "s|^#\s*ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$KEY|" /etc/nexterm-server/server.env
    else
        printf '\nENCRYPTION_KEY=%s\n' "$KEY" >> /etc/nexterm-server/server.env
    fi
    chown root:nexterm /etc/nexterm-server/server.env
    chmod 0640 /etc/nexterm-server/server.env
    echo "Auto-generated ENCRYPTION_KEY in /etc/nexterm-server/server.env"
fi

exit 0