# Shared by the development engine and standalone guacd launchers.
# SCRIPT_DIR and PROJECT_ROOT must be set by the caller before sourcing.
LIBVNC_LIB="$PROJECT_ROOT/vendor/libvncserver/dist/lib"
LIBVNC_STAMP="$LIBVNC_LIB/../.nexterm-patches"

ensure_libvnc_built() {
    local expected
    expected=$(cat "$PROJECT_ROOT/vendor/patches/libvncclient-accept-screen-id-zero.patch" \
        "$PROJECT_ROOT/vendor/patches/libvncclient-extended-clipboard.patch" | cksum)
    if [[ -f "$LIBVNC_LIB/libvncclient.so.1" && -f "$LIBVNC_STAMP" ]] && \
            [[ "$(cat "$LIBVNC_STAMP")" == "$expected" ]]; then
        return 0
    fi

    echo "[vnc] Building patched libvncclient..."
    if ! REPO_ROOT="$PROJECT_ROOT" sh "$SCRIPT_DIR/build-engine-release.sh" libvnc \
            > "$PROJECT_ROOT/vendor/libvncserver-build.log" 2>&1; then
        echo "[vnc] Build failed; falling back to the system library."
        echo "[vnc] TigerVNC clipboard/resize fixes require the patched library."
        echo "[vnc] See vendor/libvncserver-build.log"
    fi
}

use_patched_libvnc() {
    if [[ -f "$LIBVNC_LIB/libvncclient.so.1" ]]; then
        export CPPFLAGS="-I$LIBVNC_LIB/../include ${CPPFLAGS:-}"
        export LDFLAGS="-L$LIBVNC_LIB ${LDFLAGS:-}"
        export PKG_CONFIG_PATH="$LIBVNC_LIB/pkgconfig:${PKG_CONFIG_PATH:-}"
        export LD_LIBRARY_PATH="$LIBVNC_LIB:${LD_LIBRARY_PATH:-}"
    fi
}
