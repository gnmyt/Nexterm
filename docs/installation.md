# 🚀 Installation

> [!WARNING]
> Nexterm is still in beta. Please back up your data regularly and report any issues on [GitHub](https://github.com/gnmyt/Nexterm/issues).

## 🔐 Generate Encryption Key

Nexterm requires an encryption key to securely store your data. You can generate a strong key using the following command:

```sh
openssl rand -hex 32
```

## 🐳 Docker

::: code-group

```shell [Host Network (Recommended)]
docker run -d \
  -e ENCRYPTION_KEY=aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a \
  --network host \
  --name nexterm \
  --restart always \
  -v nexterm:/app/data \
  germannewsmaker/nexterm:latest
```

```shell [Bridge Network]
docker run -d \
  -e ENCRYPTION_KEY=aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a \
  -p 6989:6989 \
  --name nexterm \
  --restart always \
  -v nexterm:/app/data \
  germannewsmaker/nexterm:latest
```

:::

> [!NOTE]
> **Host Network** is strongly recommended. It allows Nexterm to access your host's network stack directly, which is required for features like Wake-on-LAN and connecting to servers via `localhost`. Only use **Bridge Network** if you specifically need network isolation.

## 📦 Docker Compose

::: code-group

```yaml [Host Network (Recommended)]
services:
  nexterm:
    environment:
      ENCRYPTION_KEY: "aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a" # Replace with your generated key
    network_mode: host
    restart: always
    volumes:
      - nexterm:/app/data
    image: germannewsmaker/nexterm:latest
volumes:
  nexterm:
```

```yaml [Bridge Network]
services:
  nexterm:
    environment:
      ENCRYPTION_KEY: "aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a" # Replace with your generated key
    ports:
      - "6989:6989"
    restart: always
    volumes:
      - nexterm:/app/data
    image: germannewsmaker/nexterm:latest
volumes:
  nexterm:
```

:::

```sh
docker-compose up -d
```

### 🌐 IPv6 Support

To connect to IPv6 servers from within the container using bridge networking, add the following to your existing `docker-compose.yml` (not needed for host network):

```diff
services:
  nexterm:
+   networks:
+     - nexterm-net

+networks:
+  nexterm-net:
+    enable_ipv6: true
```
