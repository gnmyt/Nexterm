self:
{ config, lib, pkgs, ... }:

let
  cfg = config.services.nexterm;
in
{
  options.services.nexterm = {
    enable = lib.mkEnableOption "Nexterm server management";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.system}.nexterm;
      description = "The Nexterm server package to run.";
    };

    enginePackage = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.system}.engine;
      description = "The Nexterm engine package (SSH/VNC/RDP protocol backend).";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 6989;
      description = "HTTP port the server listens on.";
    };

    httpsPort = lib.mkOption {
      type = lib.types.port;
      default = 5878;
      description = "HTTPS port the server listens on (used when TLS certs are present).";
    };

    controlPlanePort = lib.mkOption {
      type = lib.types.port;
      default = 7800;
      description = "TCP port the control plane listens on for the engine (loopback only).";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Open the HTTP/HTTPS ports in the firewall.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/nexterm.env";
      description = ''
        Path to an environment file containing at least ENCRYPTION_KEY=<64 hex chars>.
        Keep this out of the Nix store (e.g. via agenix/sops or a manually managed file).
        The key encrypts stored passwords/SSH keys and is irrecoverable if lost.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [{
      assertion = cfg.environmentFile != null;
      message = "services.nexterm.environmentFile must be set and provide ENCRYPTION_KEY.";
    }];

    users.users.nexterm = {
      isSystemUser = true;
      group = "nexterm";
      home = "/var/lib/nexterm";
    };
    users.groups.nexterm = { };

    networking.firewall.allowedTCPPorts =
      lib.mkIf cfg.openFirewall [ cfg.port cfg.httpsPort ];

    systemd.tmpfiles.rules = [
      "d /var/lib/nexterm 0750 nexterm nexterm -"
    ];

    # Shared loopback token so the server accepts its bundled local engine.
    systemd.services.nexterm-local-engine-token = {
      description = "Generate Nexterm local engine token";
      wantedBy = [ "multi-user.target" ];
      before = [ "nexterm.service" "nexterm-engine.service" ];
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
      };
      script = ''
        umask 077
        if [ ! -f /var/lib/nexterm/local-engine.env ]; then
          tok=$(${pkgs.openssl}/bin/openssl rand -hex 32)
          printf 'LOCAL_ENGINE_TOKEN=%s\nREGISTRATION_TOKEN=%s\n' "$tok" "$tok" \
            > /var/lib/nexterm/local-engine.env
        fi
        chown nexterm:nexterm /var/lib/nexterm/local-engine.env
        chmod 600 /var/lib/nexterm/local-engine.env
      '';
    };

    systemd.services.nexterm = {
      description = "Nexterm server";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" "nexterm-local-engine-token.service" ];
      requires = [ "nexterm-local-engine-token.service" ];
      environment = {
        NODE_ENV = "production";
        SERVER_PORT = toString cfg.port;
        HTTPS_PORT = toString cfg.httpsPort;
        CONTROL_PLANE_PORT = toString cfg.controlPlanePort;
      };
      serviceConfig = {
        User = "nexterm";
        Group = "nexterm";
        WorkingDirectory = "/var/lib/nexterm";
        EnvironmentFile = [ "/var/lib/nexterm/local-engine.env" cfg.environmentFile ];
        ExecStart = "${cfg.package}/bin/nexterm";
        # The app writes to <app>/data; overlay a writable state dir there.
        BindPaths = [ "/var/lib/nexterm:${cfg.package}/lib/nexterm/data" ];
        Restart = "on-failure";
        RestartSec = 5;
      };
    };

    systemd.services.nexterm-engine = {
      description = "Nexterm engine (SSH/VNC/RDP backend)";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" "nexterm.service" "nexterm-local-engine-token.service" ];
      requires = [ "nexterm-local-engine-token.service" ];
      serviceConfig = {
        User = "nexterm";
        Group = "nexterm";
        WorkingDirectory = "/var/lib/nexterm";
        EnvironmentFile = [ "/var/lib/nexterm/local-engine.env" ];
        ExecStart = "${cfg.enginePackage}/bin/nexterm-engine --host 127.0.0.1 --port ${toString cfg.controlPlanePort} --log info";
        Restart = "on-failure";
        RestartSec = 5;
      };
    };
  };
}
