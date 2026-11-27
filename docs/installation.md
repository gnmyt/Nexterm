# 🚀 Installation

> [!WARNING]
> Nexterm is still in beta. Please back up your data regularly and report any issues on [GitHub](https://github.com/gnmyt/Nexterm/issues).

## 🔐 Generate Encryption Key

Nexterm requires an encryption key to securely store your data. You can generate a strong key using the following command:

```sh
openssl rand -hex 32
```

## Docker Images

Nexterm is distributed as three Docker images:

| Image            | Description                                                                        |
|------------------|------------------------------------------------------------------------------------|
| `nexterm/aio`    | **All-In-One** - server, client, and engine in a single container. Simplest setup. |
| `nexterm/server` | **Server only** - Node.js backend + web client. Requires a separate engine.        |
| `nexterm/engine` | **Engine only** - Connection service (SSH, VNC, RDP, Telnet).                      |

For simple deployments, use `nexterm/aio`. For multi-network or distributed setups, deploy `nexterm/server` with one or
more `nexterm/engine` instances on different networks.

## 🐳 All-In-One (Simple Setup)

::: code-group

```shell [Host Network (Recommended)]
docker run -d \
  -e ENCRYPTION_KEY=aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a \ # Replace with your generated key
  --network host \
  --name nexterm \
  --restart always \
  -v nexterm:/app/data \
  nexterm/aio:latest
```

```shell [Bridge Network]
docker run -d \
  -e ENCRYPTION_KEY=aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a \ # Replace with your generated key
  -p 6989:6989 \
  --name nexterm \
  --restart always \
  -v nexterm:/app/data \
  nexterm/aio:latest
```

:::

> [!NOTE]
> **Host Network** is strongly recommended. It allows Nexterm to access your host's network stack directly, which is required for features like Wake-on-LAN and connecting to servers via `localhost`. Only use **Bridge Network** if you specifically need network isolation.

## 📦 Docker Compose

### All-In-One

::: code-group

```yaml [Host Network (Recommended)]
services:
  nexterm:
    image: nexterm/aio:latest
    environment:
      ENCRYPTION_KEY: "aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a" # Replace with your generated key
    network_mode: host
    restart: always
    volumes:
      - nexterm:/app/data
volumes:
  nexterm:
```

```yaml [Bridge Network]
services:
  nexterm:
    image: nexterm/aio:latest
    environment:
      ENCRYPTION_KEY: "aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a" # Replace with your generated key
    ports:
      - "6989:6989"
    restart: always
    volumes:
      - nexterm:/app/data
volumes:
  nexterm:
```

:::

### Split Deployment (Server + Engine)

Use this when you need the engine on a different network or want to run multiple engines.

First, create a `config.yaml` for the engine:

```yaml
server_host: "server"
server_port: 7800
registration_token: ""
```

Then create your `docker-compose.yml`:

```yaml
services:
  server:
    image: nexterm/server:latest
    environment:
      ENCRYPTION_KEY: "aba3aa8e29b9904d5d8d705230b664c053415c54be20ad13be99af0057dfa23a" # Replace with your generated key
    ports:
      - "6989:6989"
    restart: always
    volumes:
      - nexterm:/app/data

  engine:
    image: nexterm/engine:latest
    restart: always
    volumes:
      - ./config.yaml:/etc/nexterm/config.yaml

volumes:
  nexterm:
```

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

## ❄️ NixOS

Nexterm ships a flake with a NixOS module that runs the server and a bundled local engine as systemd services.

Add it to your system flake:

```nix
{
  inputs.nexterm.url = "github:gnmyt/Nexterm";

  outputs = { nixpkgs, nexterm, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        nexterm.nixosModules.default
        {
          services.nexterm = {
            enable = true;
            openFirewall = true;
            environmentFile = "/etc/nexterm.env"; # must define ENCRYPTION_KEY
          };
        }
      ];
    };
  };
}
```

Create the environment file (kept out of the Nix store) with your generated key:

```sh
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" | sudo tee /etc/nexterm.env >/dev/null
sudo chmod 600 /etc/nexterm.env
```

Then run `sudo nixos-rebuild switch`. The web UI is served on port 6989 (`services.nexterm.port`), and state is stored in `/var/lib/nexterm`, which persists across service restarts and rebuilds.

> [!NOTE]
> Two systemd units are created: `nexterm` (server) and `nexterm-engine` (connection backend). Manage them together with `systemctl status/restart/stop nexterm nexterm-engine`, and follow logs via `journalctl -u nexterm -u nexterm-engine -f`. The module generates a loopback token so the bundled engine registers automatically. To run an engine on a separate host, deploy `packages.engine` there and point its `config.yaml` at your server instead.

### Updating

Bump the pinned input and rebuild:

```sh
nix flake update nexterm
sudo nixos-rebuild switch
```

Your data in `/var/lib/nexterm` is preserved and database migrations run automatically on start. To pin a fixed release instead of tracking the latest, use a tagged input such as `github:gnmyt/Nexterm/v1.2.2-BETA`. If an update misbehaves, roll back with `sudo nixos-rebuild switch --rollback` or by selecting the previous generation at boot.
