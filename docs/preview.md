# 🚀 Run preview

> [!CAUTION]
> Nexterm is currently in early development and subject to change. It is not recommended to use it in a production
> environment.
 
## 📦 Installation

Since 1.0.3-OPEN-PREVIEW, you are required to set an encryption key in **hexadecimal format** (64 characters using only 0-9 and a-f). **Do not use arbitrary text or alphanumeric strings.** You can generate one with `openssl rand -hex 32`.

### 🐳 Docker

```shell
docker run -d \
  -e ENCRYPTION_KEY=aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a \
  -p 6989:6989 \
  --name nexterm \
  --restart always \
  -v nexterm:/app/data \
  germannewsmaker/nexterm:latest
```

### 📦 Docker Compose

```yaml
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

```sh
docker-compose up -d
```

### 🌐 IPv6 Support

To connect to IPv6 servers from within the container, add the following to your existing `docker-compose.yml`:

```diff
services:
  nexterm:
+   networks:
+     - nexterm-net

+networks:
+  nexterm-net:
+    enable_ipv6: true
```
