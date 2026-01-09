# 🔐 Enabling SSL/HTTPS

> [!NOTE]
> HTTPS is required for RDP clipboard sharing to work.



## 📁 Certificate Setup

Place your SSL certificate files in the `data/certs` folder:

- `cert.pem` - Your SSL certificate
- `key.pem` - Your private key

Nexterm will automatically detect them and start an HTTPS server.

## 🔌 Ports

- HTTP runs on port `6989` (default)
- HTTPS runs on port `5878` by default

You can change the HTTPS port by setting the `HTTPS_PORT` environment variable.

## 🐳 Docker Setup

Add the following to your existing `docker-compose.yml`:

```diff
services:
  nexterm:
    environment:
+     HTTPS_PORT: 5878 # optional, this is the default
    ports:
+     - "5878:5878"
    volumes:
+     - ./certs:/app/data/certs
```

## 🔧 Generating Self-Signed Certs

For testing purposes, you can generate a self-signed certificate:

```sh
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

Then move `cert.pem` and `key.pem` into your `data/certs` folder.

> [!WARNING]
> Self-signed certificates will show a browser warning. For production, use certificates from Let's Encrypt or your CA.

## 🚀 Let's Encrypt with Certbot

To obtain certificates from Let's Encrypt:

```sh
sudo certbot certonly --standalone -d yourdomain.com
```

Then copy the generated files:

```sh
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./data/certs/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./data/certs/key.pem
```

Restart Nexterm to apply the changes.
