# 🚀 Run preview

> [!CAUTION]
> Nexterm is currently in early development and subject to change. It is not recommended to use it in a production
> environment.

> [!WARNING]  
> Your password needs to be at least 8 characters long and contain at least one uppercase letter, one lowercase letter,
> one number and one special character.
> The current error message might be confusing, but it will be fixed in the future.

### 🐳 Docker

```sh
docker run -d -p 6989:6989 --name nexterm --restart always -v nexterm:/app/data germannewsmaker/nexterm:latest
```

### 📦 Docker Compose

```yaml
services:
  nexterm:
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