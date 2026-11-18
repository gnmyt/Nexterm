#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIBVNC_DIST=${LIBVNC_DIST:-"$ROOT/vendor/libvncserver/dist"}
export PKG_CONFIG_PATH="$LIBVNC_DIST/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="$LIBVNC_DIST/lib:${LD_LIBRARY_PATH:-}"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM

# Do not use NDEBUG: assertions are part of this test harness.
${CC:-cc} -std=c99 -Wall -Wextra -Werror \
    "$ROOT/scripts/tests/vnc-clipboard.c" -o "$WORK/vnc-clipboard" \
    $(pkg-config --cflags --libs libvncclient) -lz
"$WORK/vnc-clipboard"
