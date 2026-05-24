#!/bin/sh
set -eux

REPO_ROOT="${REPO_ROOT:-$(pwd)}"
GUAC_SRC="$REPO_ROOT/vendor/guacamole-server"
GUAC_DIST="$GUAC_SRC/dist"
ENGINE_SRC="$REPO_ROOT/engine"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/dist}"
ARCH="${ARCH:-$(uname -m)}"

if command -v apk >/dev/null 2>&1; then
    PKG_MGR="apk"
elif command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt"
else
    echo "no supported package manager found (need apk or apt-get)" >&2
    exit 1
fi

APK_GUAC="
    build-base autoconf automake libtool pkgconf
    cairo-dev jpeg-dev libpng-dev ossp-uuid-dev
    pango-dev libvncserver-dev libwebp-dev openssl-dev freerdp-dev
    pulseaudio-dev libvorbis-dev libogg-dev libssh2-dev
"
APK_ENGINE="
    build-base cmake git pkgconf
    libssh2-dev openssl-dev curl-dev
    cairo-dev jpeg-dev libpng-dev ossp-uuid-dev
    pango-dev libwebp-dev
    pulseaudio-dev libvorbis-dev libogg-dev
"

APT_GUAC="
    build-essential autoconf automake libtool pkg-config
    libcairo2-dev libjpeg-dev libpng-dev libossp-uuid-dev
    libpango1.0-dev libvncserver-dev libwebp-dev libssl-dev freerdp2-dev
    libpulse-dev libvorbis-dev libogg-dev libssh2-1-dev
"
APT_ENGINE="
    build-essential cmake git pkg-config ca-certificates
    libssh2-1-dev libssl-dev libcurl4-openssl-dev
    libcairo2-dev libjpeg-dev libpng-dev libossp-uuid-dev
    libpango1.0-dev libwebp-dev
    libpulse-dev libvorbis-dev libogg-dev
    file
"

pkg_install() {
    if [ "$PKG_MGR" = "apk" ]; then
        apk add --no-cache $1
    else
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y --no-install-recommends $1
    fi
}

deps_guac() {
    if [ "$PKG_MGR" = "apk" ]; then pkg_install "$APK_GUAC"; else pkg_install "$APT_GUAC"; fi
}

deps_engine() {
    if [ "$PKG_MGR" = "apk" ]; then pkg_install "$APK_ENGINE"; else pkg_install "$APT_ENGINE"; fi
}

deps_all() {
    deps_guac
    if [ "$PKG_MGR" = "apk" ]; then
        pkg_install "cmake git curl curl-dev ca-certificates patchelf tar"
    else
        pkg_install "cmake git curl libcurl4-openssl-dev file ca-certificates patchelf tar"
    fi
}

build_guac() {
    cd "$GUAC_SRC"
    autoreconf -fi
    ./configure \
        --prefix="$GUAC_DIST" \
        --with-freerdp-plugin-dir="$GUAC_DIST/lib/freerdp2" \
        --disable-guacenc \
        --disable-guaclog \
        --without-libavcodec \
        --without-libavformat \
        --without-libavutil \
        --without-libswscale
    make -j"$(nproc)"
    make install
    rm -f "$GUAC_DIST/lib"/*.a
    rm -f "$GUAC_DIST/lib"/*.la
    strip "$GUAC_DIST/lib"/*.so.* 2>/dev/null || true
    strip "$GUAC_DIST/lib/freerdp2"/*.so 2>/dev/null || true
    strip "$GUAC_DIST/sbin"/* 2>/dev/null || true
}

build_engine() {
    cd "$ENGINE_SRC"
    mkdir -p build
    cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release
    make -j"$(nproc)"
    strip nexterm-engine 2>/dev/null || true
    file nexterm-engine || true
}

is_system_lib() {
    case "$1" in
        libc.so.*|libm.so.*|libpthread.so.*|libdl.so.*|librt.so.*) return 0 ;;
        libresolv.so.*|libnsl.so.*|libutil.so.*|libcrypt.so.*) return 0 ;;
        ld-linux*.so.*|linux-vdso.so.*|linux-gate.so.*) return 0 ;;
    esac
    return 1
}

collect_deps_into() {
    target="$1"; dest="$2"
    ldd "$target" 2>/dev/null | awk '/=> \// {print $3}' | while read -r lib; do
        [ -f "$lib" ] || continue
        base=$(basename "$lib")
        if is_system_lib "$base"; then continue; fi
        if [ ! -e "$dest/$base" ]; then
            cp -L "$lib" "$dest/$base"
        fi
    done
}

package() {
    rm -rf "$OUT_DIR"
    STAGE="$OUT_DIR/nexterm-engine-linux-$ARCH"
    mkdir -p "$STAGE/lib"

    cp "$ENGINE_SRC/build/nexterm-engine" "$STAGE/nexterm-engine"
    cp -P "$GUAC_DIST/lib"/*.so* "$STAGE/lib/" 2>/dev/null || true
    if [ -d "$GUAC_DIST/lib/freerdp2" ]; then
        cp -rP "$GUAC_DIST/lib/freerdp2" "$STAGE/lib/"
    fi

    pass=0
    while [ "$pass" -lt 6 ]; do
        before=$(find "$STAGE/lib" -name '*.so*' | wc -l)
        collect_deps_into "$STAGE/nexterm-engine" "$STAGE/lib"
        find "$STAGE/lib" -name '*.so*' -type f | while read -r so; do
            collect_deps_into "$so" "$STAGE/lib"
        done
        after=$(find "$STAGE/lib" -name '*.so*' | wc -l)
        [ "$before" = "$after" ] && break
        pass=$((pass + 1))
    done

    patchelf --set-rpath '$ORIGIN/lib:$ORIGIN/lib/freerdp2' "$STAGE/nexterm-engine"
    find "$STAGE/lib" -maxdepth 1 -name '*.so*' -type f | while read -r so; do
        patchelf --set-rpath '$ORIGIN:$ORIGIN/freerdp2' "$so" || true
    done
    if [ -d "$STAGE/lib/freerdp2" ]; then
        find "$STAGE/lib/freerdp2" -name '*.so*' -type f | while read -r so; do
            patchelf --set-rpath '$ORIGIN:$ORIGIN/..' "$so" || true
        done
    fi

    tar -czf "$OUT_DIR/nexterm-engine-linux-$ARCH.tar.gz" \
        -C "$OUT_DIR" "nexterm-engine-linux-$ARCH"
    ls -la "$STAGE/" "$STAGE/lib/" "$OUT_DIR/"
}

pkg() {
    : "${PKG_VERSION:?PKG_VERSION must be set (e.g. 1.2.3)}"
    PKG_ARCH="${PKG_ARCH:-amd64}"
    export PKG_VERSION PKG_ARCH

    if ! command -v nfpm >/dev/null 2>&1; then
        echo "nfpm not found; install from https://nfpm.goreleaser.com/" >&2
        exit 1
    fi
    if ! command -v patchelf >/dev/null 2>&1; then
        echo "patchelf required" >&2
        exit 1
    fi

    PKG_STAGE="$REPO_ROOT/stage/engine"
    rm -rf "$REPO_ROOT/stage"
    mkdir -p "$PKG_STAGE/lib" "$PKG_STAGE/freerdp2"

    cp "$ENGINE_SRC/build/nexterm-engine" "$PKG_STAGE/nexterm-engine"
    patchelf --set-rpath '/usr/lib/nexterm-engine' "$PKG_STAGE/nexterm-engine"

    cp -P "$GUAC_DIST/lib"/libguac*.so* "$PKG_STAGE/lib/" 2>/dev/null || true

    for jpeg in \
        /usr/lib/x86_64-linux-gnu/libjpeg.so.62 \
        /usr/lib/aarch64-linux-gnu/libjpeg.so.62 \
        /usr/lib/x86_64-linux-gnu/libjpeg.so.8 \
        /usr/lib/aarch64-linux-gnu/libjpeg.so.8 \
        /usr/lib64/libjpeg.so.62 \
        /usr/lib64/libjpeg.so.8 ; do
        if [ -f "$jpeg" ]; then
            cp -L "$jpeg" "$PKG_STAGE/lib/$(basename "$jpeg")"
            break
        fi
    done
    find "$PKG_STAGE/lib" -maxdepth 1 -name '*.so*' -type f | while read -r so; do
        patchelf --set-rpath '$ORIGIN' "$so" || true
    done

    if [ -d "$GUAC_DIST/lib/freerdp2" ]; then
        cp -L "$GUAC_DIST/lib/freerdp2"/*.so "$PKG_STAGE/freerdp2/" 2>/dev/null || true
        find "$PKG_STAGE/freerdp2" -name '*.so*' -type f | while read -r so; do
            patchelf --set-rpath '/usr/lib/nexterm-engine' "$so" || true
        done
    fi

    case "$ARCH" in
        x64|amd64|x86_64)  DEB_ARCH=amd64;  RPM_ARCH=x86_64 ;;
        arm64|aarch64)     DEB_ARCH=arm64;  RPM_ARCH=aarch64 ;;
        *)                  DEB_ARCH="$ARCH"; RPM_ARCH="$ARCH" ;;
    esac

    cd "$REPO_ROOT"

    PKG_ARCH="$DEB_ARCH" nfpm pkg \
        --config packaging/nfpm-engine.yaml \
        --packager deb \
        --target "$OUT_DIR/nexterm-engine_${PKG_VERSION}_${DEB_ARCH}.deb"

    PKG_ARCH="$RPM_ARCH" nfpm pkg \
        --config packaging/nfpm-engine.yaml \
        --packager rpm \
        --target "$OUT_DIR/nexterm-engine-${PKG_VERSION}-1.${RPM_ARCH}.rpm"

    ls -la "$OUT_DIR"/*.deb "$OUT_DIR"/*.rpm
}

install_nfpm() {
    if command -v nfpm >/dev/null 2>&1; then return 0; fi
    NFPM_VERSION="${NFPM_VERSION:-2.43.0}"
    case "$(uname -m)" in
        x86_64|amd64) NFPM_HOST_ARCH=x86_64 ;;
        aarch64|arm64) NFPM_HOST_ARCH=arm64 ;;
        *) NFPM_HOST_ARCH=x86_64 ;;
    esac
    URL="https://github.com/goreleaser/nfpm/releases/download/v${NFPM_VERSION}/nfpm_${NFPM_VERSION}_Linux_${NFPM_HOST_ARCH}.tar.gz"
    TMP="$(mktemp -d)"
    curl -fsSL "$URL" -o "$TMP/nfpm.tar.gz"
    tar -xzf "$TMP/nfpm.tar.gz" -C "$TMP" nfpm
    install -m 0755 "$TMP/nfpm" /usr/local/bin/nfpm
    rm -rf "$TMP"
}

case "${1:-}" in
    deps-guac)   deps_guac ;;
    deps-engine) deps_engine ;;
    deps-all)    deps_all ;;
    guac)        build_guac ;;
    engine)      build_engine ;;
    package)     package ;;
    pkg)         install_nfpm; pkg ;;
    install-nfpm) install_nfpm ;;
    all)         deps_all; build_guac; build_engine; package ;;
    all-with-pkg) deps_all; build_guac; build_engine; package; install_nfpm; pkg ;;
    *)
        echo "usage: $0 {deps-guac|deps-engine|deps-all|guac|engine|package|pkg|install-nfpm|all|all-with-pkg}" >&2
        exit 1
        ;;
esac
