#!/usr/bin/env bash

set -e

BOLD=$'\033[1m'
DIM=$'\033[2m'
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

REPO_BASE="https://packages.buildkite.com/nexterm"
KEYRING_DIR="/etc/apt/keyrings"
APT_KEYRING="$KEYRING_DIR/nexterm_apt-archive-keyring.gpg"
APT_LIST="/etc/apt/sources.list.d/buildkite-nexterm-apt.list"
YUM_REPO="/etc/yum.repos.d/buildkite-nexterm.repo"

SERVER_ENV_FILE="/etc/nexterm-server/server.env"
ENGINE_CONFIG_FILE="/etc/nexterm-engine/config.yaml"

SPINNER_PID=""

print_header() {
    clear
    printf '%s' "$CYAN"
    cat <<'BANNER'
 /$$   /$$                       /$$
| $$$ | $$                      | $$
| $$$$| $$  /$$$$$$  /$$   /$$ /$$$$$$    /$$$$$$   /$$$$$$  /$$$$$$/$$$$
| $$ $$ $$ /$$__  $$|  $$ /$$/|_  $$_/   /$$__  $$ /$$__  $$| $$_  $$_  $$
| $$  $$$$| $$$$$$$$ \  $$$$/   | $$    | $$$$$$$$| $$  \__/| $$ \ $$ \ $$
| $$\  $$$| $$_____/  >$$  $$   | $$ /$$| $$_____/| $$      | $$ | $$ | $$
| $$ \  $$|  $$$$$$$ /$$/\  $$  |  $$$$/|  $$$$$$$| $$      | $$ | $$ | $$
|__/  \__/ \_______/|__/  \__/   \___/   \_______/|__/      |__/ |__/ |__/
BANNER
    printf '%s' "$RESET"
    printf '%s%s%s\n\n' "$DIM" "  Self-hosted server management" "$RESET"
}

ok()      { printf '%s✓%s %s\n' "$GREEN"  "$RESET" "$1"; }
warn()    { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
fail()    { printf '%sx%s %s\n' "$RED"    "$RESET" "$1" >&2; }
section() { printf '\n%s%s%s\n' "$BOLD" "$1" "$RESET"; }

die() {
    fail "$1"
    exit 1
}

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        die "Please run this installer as root (try sudo $0)."
    fi
}

start_spinner() {
    local msg="$1"
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    (
        local i=0
        while :; do
            printf '\r%s%s%s %s' "$CYAN" "${frames[$((i % 10))]}" "$RESET" "$msg"
            i=$((i + 1))
            sleep 0.1
        done
    ) &
    SPINNER_PID=$!
    disown "$SPINNER_PID" 2>/dev/null || true
}

stop_spinner() {
    local status="${1:-ok}"
    local msg="$2"
    if [ -n "$SPINNER_PID" ] && kill -0 "$SPINNER_PID" 2>/dev/null; then
        kill "$SPINNER_PID" 2>/dev/null || true
        wait "$SPINNER_PID" 2>/dev/null || true
    fi
    SPINNER_PID=""
    printf '\r\033[K'
    case "$status" in
        ok)   ok   "$msg" ;;
        warn) warn "$msg" ;;
        fail) fail "$msg" ;;
        *)    printf '%s\n' "$msg" ;;
    esac
}

run_step() {
    local msg="$1"
    shift
    start_spinner "$msg"
    local log
    log=$(mktemp)
    if "$@" >"$log" 2>&1; then
        stop_spinner ok "$msg"
        rm -f "$log"
    else
        stop_spinner fail "$msg"
        printf '%s\n' "${DIM}--- output ---${RESET}"
        cat "$log"
        rm -f "$log"
        exit 1
    fi
}

prompt_choice() {
    local prompt="$1"
    shift
    local options=("$@")
    local i
    while :; do
        printf '\n%s%s%s\n' "$BOLD" "$prompt" "$RESET"
        for i in "${!options[@]}"; do
            printf '  %s[%d]%s %s\n' "$CYAN" "$((i + 1))" "$RESET" "${options[$i]}"
        done
        printf '\n%sChoice >%s ' "$DIM" "$RESET"
        read -r reply
        case "$reply" in
            ''|*[!0-9]*) warn "Please enter a number." ;;
            *)
                if [ "$reply" -ge 1 ] && [ "$reply" -le "${#options[@]}" ]; then
                    CHOICE_INDEX=$((reply - 1))
                    return 0
                fi
                warn "Selection out of range."
                ;;
        esac
    done
}

prompt_yes_no() {
    local prompt="$1"
    local default="${2:-y}"
    local hint="[Y/n]"
    [ "$default" = "n" ] && hint="[y/N]"
    while :; do
        printf '\n%s%s%s %s ' "$BOLD" "$prompt" "$RESET" "$hint"
        read -r reply
        reply="${reply:-$default}"
        case "$reply" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            [Nn]|[Nn][Oo])     return 1 ;;
            *) warn "Please answer yes or no." ;;
        esac
    done
}

detect_os() {
    if [ ! -r /etc/os-release ]; then
        die "Couldn't detect your distribution (/etc/os-release is missing)."
    fi
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_LIKE="${ID_LIKE:-}"

    case "$OS_ID $OS_LIKE" in
        *debian*|*ubuntu*) PKG_FAMILY="deb" ;;
        *rhel*|*fedora*|*centos*|*rocky*|*almalinux*|*ol*) PKG_FAMILY="rpm" ;;
        *)
            warn "Distribution '$OS_ID' isn't officially supported."
            if prompt_yes_no "Treat it as Debian-based?" n; then
                PKG_FAMILY="deb"
            else
                PKG_FAMILY="rpm"
            fi
            ;;
    esac
}

ensure_command() {
    command -v "$1" >/dev/null 2>&1
}

install_prereqs_deb() {
    local missing=()
    ensure_command curl || missing+=(curl)
    ensure_command gpg  || missing+=(gpg)
    if [ "${#missing[@]}" -gt 0 ]; then
        run_step "Installing prerequisites (${missing[*]})" bash -c "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${missing[*]}"
    fi
}

install_prereqs_rpm() {
    local missing=()
    ensure_command curl || missing+=(curl)
    if [ "${#missing[@]}" -gt 0 ]; then
        if ensure_command dnf; then
            run_step "Installing prerequisites (${missing[*]})" dnf install -y "${missing[@]}"
        else
            run_step "Installing prerequisites (${missing[*]})" yum install -y "${missing[@]}"
        fi
    fi
}

configure_apt_repo() {
    if [ -f "$APT_KEYRING" ] && [ -f "$APT_LIST" ]; then
        ok "APT repository is already set up"
        return
    fi
    mkdir -p "$KEYRING_DIR"
    rm -f "$APT_KEYRING"
    run_step "Importing the signing key" bash -c "curl -fsSL '$REPO_BASE/apt/gpgkey' | gpg --dearmor --batch --yes -o '$APT_KEYRING'"
    chmod 0644 "$APT_KEYRING"
    cat > "$APT_LIST" <<EOF
deb [signed-by=$APT_KEYRING] $REPO_BASE/apt/any/ any main
deb-src [signed-by=$APT_KEYRING] $REPO_BASE/apt/any/ any main
EOF
    ok "Wrote APT source list"
    run_step "Refreshing the package index" apt-get update -qq
}

configure_yum_repo() {
    if [ -f "$YUM_REPO" ]; then
        ok "RPM repository is already set up"
        return
    fi
    cat > "$YUM_REPO" <<EOF
[nexterm]
name=Nexterm
baseurl=$REPO_BASE/rpm_any/rpm_any/\$basearch
enabled=1
repo_gpgcheck=1
gpgcheck=0
gpgkey=$REPO_BASE/rpm/gpgkey
EOF
    ok "Wrote RPM repository definition"
    if ensure_command dnf; then
        run_step "Refreshing the package index" dnf makecache -y
    else
        run_step "Refreshing the package index" yum makecache -y
    fi
}

pkg_install() {
    local pkgs=("$@")
    if [ "$PKG_FAMILY" = "deb" ]; then
        run_step "Installing ${pkgs[*]}" bash -c "DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgs[*]}"
    elif ensure_command dnf; then
        run_step "Installing ${pkgs[*]}" dnf install -y "${pkgs[@]}"
    else
        run_step "Installing ${pkgs[*]}" yum install -y "${pkgs[@]}"
    fi
}

generate_token() {
    if ensure_command openssl; then
        openssl rand -hex 32
    else
        head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
    fi
}

write_engine_config() {
    local token="$1"
    local host="${2:-127.0.0.1}"
    local port="${3:-7800}"
    local tls="${4:-false}"

    mkdir -p "$(dirname "$ENGINE_CONFIG_FILE")"
    cat > "$ENGINE_CONFIG_FILE" <<EOF
server_host: "$host"
server_port: $port
registration_token: "$token"
tls: $tls
EOF
    chown root:nexterm "$ENGINE_CONFIG_FILE" 2>/dev/null || true
    chmod 0660 "$ENGINE_CONFIG_FILE"
}

set_server_env_var() {
    local key="$1"
    local value="$2"

    mkdir -p "$(dirname "$SERVER_ENV_FILE")"
    touch "$SERVER_ENV_FILE"

    if [ -s "$SERVER_ENV_FILE" ] && [ "$(tail -c 1 "$SERVER_ENV_FILE" | wc -l)" -eq 0 ]; then
        printf '\n' >> "$SERVER_ENV_FILE"
    fi

    if grep -qE "^${key}=" "$SERVER_ENV_FILE" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$SERVER_ENV_FILE"
    elif grep -qE "^#[[:space:]]*${key}=" "$SERVER_ENV_FILE" 2>/dev/null; then
        sed -i "s|^#[[:space:]]*${key}=.*|${key}=${value}|" "$SERVER_ENV_FILE"
    else
        printf '%s=%s\n' "$key" "$value" >> "$SERVER_ENV_FILE"
    fi

    chown root:nexterm "$SERVER_ENV_FILE" 2>/dev/null || true
    chmod 0640 "$SERVER_ENV_FILE"
}

start_service() {
    local svc="$1"
    if ensure_command systemctl; then
        run_step "Starting $svc" systemctl restart "$svc"
        systemctl enable "$svc" >/dev/null 2>&1 || true
    else
        warn "systemctl isn't available, so you'll need to start $svc by hand."
    fi
}

service_status_hint() {
    local svc="$1"
    printf '  %s%s%s  %ssystemctl status %s%s\n' "$BOLD" "$svc" "$RESET" "$DIM" "$svc" "$RESET"
}

ensure_docker() {
    if ensure_command docker; then
        ok "Docker is already installed"
    else
        if prompt_yes_no "Docker isn't installed. Pull it from get.docker.com?" y; then
            run_step "Installing Docker" bash -c "curl -fsSL https://get.docker.com | sh"
        else
            die "Docker is required for this option."
        fi
    fi

    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    elif ensure_command docker-compose; then
        DOCKER_COMPOSE="docker-compose"
    else
        die "Couldn't find Docker Compose. Install the docker-compose-plugin package and run this again."
    fi
}

write_aio_compose() {
    local dir="$1"
    local key="$2"
    mkdir -p "$dir"
    cat > "$dir/docker-compose.yml" <<EOF
services:
  nexterm:
    image: nexterm/aio:latest
    container_name: nexterm
    restart: unless-stopped
    network_mode: host
    environment:
      - ENCRYPTION_KEY=$key
    volumes:
      - ./data:/app/data
EOF
}

write_server_compose() {
    local dir="$1"
    local key="$2"
    mkdir -p "$dir"
    cat > "$dir/docker-compose.yml" <<EOF
services:
  nexterm-server:
    image: nexterm/server:latest
    container_name: nexterm-server
    restart: unless-stopped
    ports:
      - "6989:6989"
    environment:
      - ENCRYPTION_KEY=$key
    volumes:
      - ./data:/app/data
EOF
}

write_engine_compose() {
    local dir="$1"
    local host="$2"
    local port="$3"
    local token="$4"
    mkdir -p "$dir"
    cat > "$dir/config.yaml" <<EOF
server_host: "$host"
server_port: $port
registration_token: "$token"
tls: false
EOF
    cat > "$dir/docker-compose.yml" <<EOF
services:
  nexterm-engine:
    image: nexterm/engine:latest
    container_name: nexterm-engine
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./config.yaml:/etc/nexterm/config.yaml
EOF
}

prompt_install_dir() {
    local default="$1"
    printf '\n%sInstallation directory%s %s[%s]%s: ' "$BOLD" "$RESET" "$DIM" "$default" "$RESET"
    read -r reply
    INSTALL_DIR="${reply:-$default}"
}

prompt_engine_target() {
    printf '\n%sEngine connection settings%s\n' "$BOLD" "$RESET"
    printf '  Server host %s[127.0.0.1]%s: ' "$DIM" "$RESET"
    read -r ENGINE_HOST
    ENGINE_HOST="${ENGINE_HOST:-127.0.0.1}"
    printf '  Server port %s[7800]%s: ' "$DIM" "$RESET"
    read -r ENGINE_PORT
    ENGINE_PORT="${ENGINE_PORT:-7800}"
    printf '  Registration token (leave blank to fill in later): '
    read -r ENGINE_TOKEN
}

run_docker_flow() {
    section "Docker deployment"

    prompt_choice "Which Nexterm component do you want to deploy?" \
        "All-in-One (recommended): server and engine bundled together" \
        "Server only: web UI and API" \
        "Engine only: connection engine"
    local component_index=$CHOICE_INDEX

    ensure_docker

    case "$component_index" in
        0)
            prompt_install_dir "/opt/nexterm"
            local key
            key=$(generate_token)
            write_aio_compose "$INSTALL_DIR" "$key"
            ok "Wrote $INSTALL_DIR/docker-compose.yml"
            (cd "$INSTALL_DIR" && run_step "Pulling images" $DOCKER_COMPOSE pull)
            (cd "$INSTALL_DIR" && run_step "Bringing the stack up" $DOCKER_COMPOSE up -d)
            print_docker_summary "All-in-One" "$INSTALL_DIR" "http://localhost:6989" "$key"
            ;;
        1)
            prompt_install_dir "/opt/nexterm-server"
            local key
            key=$(generate_token)
            write_server_compose "$INSTALL_DIR" "$key"
            ok "Wrote $INSTALL_DIR/docker-compose.yml"
            (cd "$INSTALL_DIR" && run_step "Pulling images" $DOCKER_COMPOSE pull)
            (cd "$INSTALL_DIR" && run_step "Bringing the stack up" $DOCKER_COMPOSE up -d)
            print_docker_summary "Server" "$INSTALL_DIR" "http://localhost:6989" "$key"
            ;;
        2)
            prompt_install_dir "/opt/nexterm-engine"
            prompt_engine_target
            write_engine_compose "$INSTALL_DIR" "$ENGINE_HOST" "$ENGINE_PORT" "$ENGINE_TOKEN"
            ok "Wrote $INSTALL_DIR/docker-compose.yml and config.yaml"
            (cd "$INSTALL_DIR" && run_step "Pulling images" $DOCKER_COMPOSE pull)
            (cd "$INSTALL_DIR" && run_step "Bringing the stack up" $DOCKER_COMPOSE up -d)
            print_docker_summary "Engine" "$INSTALL_DIR" "" ""
            ;;
    esac
}

print_docker_summary() {
    local kind="$1"
    local dir="$2"
    local url="$3"
    local key="$4"

    section "All done"
    printf '  Deployment:  %s (Docker)\n' "$kind"
    printf '  Directory:   %s\n' "$dir"
    [ -n "$url" ] && printf '  Web UI:      %s\n' "$url"
    if [ -n "$key" ]; then
        printf '  Encryption:  %skeep this secret. It lives in docker-compose.yml%s\n' "$DIM" "$RESET"
    fi
    printf '\n  Tail the logs: %scd %s && %s logs -f%s\n' "$DIM" "$dir" "$DOCKER_COMPOSE" "$RESET"
}

run_package_flow() {
    section "Package manager deployment"

    prompt_choice "Which Nexterm component do you want to install?" \
        "All-in-One (recommended): server and engine on this host" \
        "Server only: web UI and API" \
        "Engine only: connection engine"
    local component_index=$CHOICE_INDEX

    require_root
    detect_os

    if [ "$PKG_FAMILY" = "deb" ]; then
        install_prereqs_deb
        configure_apt_repo
    else
        install_prereqs_rpm
        configure_yum_repo
    fi

    case "$component_index" in
        0)
            pkg_install nexterm-server nexterm-engine
            local token
            token=$(generate_token)
            set_server_env_var LOCAL_ENGINE_TOKEN "$token"
            write_engine_config "$token" "127.0.0.1" "7800" "false"
            ok "Paired the server and engine with a fresh token"
            start_service nexterm-engine
            start_service nexterm-server
            print_package_summary aio
            ;;
        1)
            pkg_install nexterm-server
            start_service nexterm-server
            print_package_summary server
            ;;
        2)
            pkg_install nexterm-engine
            prompt_engine_target
            local token="${ENGINE_TOKEN}"
            [ -z "$token" ] && warn "No registration token was provided. Drop one into $ENGINE_CONFIG_FILE before the engine can connect."
            write_engine_config "$token" "$ENGINE_HOST" "$ENGINE_PORT" "false"
            start_service nexterm-engine
            print_package_summary engine
            ;;
    esac
}

print_package_summary() {
    local kind="$1"
    section "All done"
    case "$kind" in
        aio)
            printf '  Components: nexterm-server, nexterm-engine\n'
            printf '  Web UI:     http://localhost:6989\n'
            printf '  Engine cfg: %s\n' "$ENGINE_CONFIG_FILE"
            printf '  Server env: %s\n\n' "$SERVER_ENV_FILE"
            service_status_hint nexterm-server
            service_status_hint nexterm-engine
            ;;
        server)
            printf '  Component:  nexterm-server\n'
            printf '  Web UI:     http://localhost:6989\n'
            printf '  Server env: %s\n\n' "$SERVER_ENV_FILE"
            service_status_hint nexterm-server
            ;;
        engine)
            printf '  Component:  nexterm-engine\n'
            printf '  Engine cfg: %s\n\n' "$ENGINE_CONFIG_FILE"
            service_status_hint nexterm-engine
            ;;
    esac
}

main() {
    print_header

    prompt_choice "How would you like to install Nexterm?" \
        "Docker (compose file is written and started for you)" \
        "Package manager (native .deb or .rpm from the Nexterm repository)"

    case "$CHOICE_INDEX" in
        0) run_docker_flow ;;
        1) run_package_flow ;;
    esac

    printf '\n%sThanks for using Nexterm.%s\n' "$GREEN" "$RESET"
    printf '%sDocs:%s https://docs.nexterm.dev/\n' "$DIM" "$RESET"
}

trap 'stop_spinner fail "Aborted"; exit 130' INT TERM

main "$@"
