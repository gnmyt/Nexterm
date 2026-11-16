#!/usr/bin/env bash
set -euo pipefail

VT_VERSION=1.0.1
ZIG_VERSION=0.17.1
API=26
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${WORK:-$ROOT/build/libghostty}"
NDK="${ANDROID_NDK_HOME:-$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/ndk/* | sort -V | tail -1)}"
REL="https://release.files.ghostty.org/libghostty-vt/$VT_VERSION"

mkdir -p "$WORK" && cd "$WORK"
fetch() { [ -f "$2" ] || curl -fsSL "$1" -o "$2"; }

fetch "$REL/SHA256SUMS" SHA256SUMS
for f in libghostty-vt-$VT_VERSION.tar.gz libghostty-vt-$VT_VERSION-deps.tar.gz ghostty-vt-$VT_VERSION.xcframework.zip; do
  fetch "$REL/$f" "$f"
done
sha256sum -c SHA256SUMS --ignore-missing

ZIG_TAR=zig-x86_64-linux-$ZIG_VERSION.tar.xz
fetch "https://ziglang.org/download/$ZIG_VERSION/$ZIG_TAR" "$ZIG_TAR"
echo "3581863e3cbcfd0fce0efc682ce7e9e93da96668a977791d356a26d2a7e9b17a  $ZIG_TAR" | sha256sum -c

[ -d libghostty-vt-$VT_VERSION ] || tar xzf libghostty-vt-$VT_VERSION.tar.gz
[ -d libghostty-vt-$VT_VERSION-deps ] || tar xzf libghostty-vt-$VT_VERSION-deps.tar.gz
[ -d zig-x86_64-linux-$ZIG_VERSION ] || tar xJf "$ZIG_TAR"
ZIG="$WORK/zig-x86_64-linux-$ZIG_VERSION/zig"
export ZIG_GLOBAL_CACHE_DIR="$WORK/zig-cache" ZIG_LOCAL_CACHE_DIR="$WORK/zig-cache" ANDROID_NDK_HOME="$NDK"

build_vt() { # $1 = zig target
  (cd libghostty-vt-$VT_VERSION && "$ZIG" build --prefix "$WORK/out/$1" --system ../libghostty-vt-$VT_VERSION-deps \
    -Doptimize=ReleaseFast -Dcpu=baseline -Dstrip=true -Dtarget="$1")
}

SHIM=("$ROOT/shared/native/nexterm_vt.c" "$ROOT/shared/native/nexterm_vt_jni.c")
LDFLAGS=(-shared -fPIC -O2 -fvisibility=hidden -Wl,--gc-sections -s)
CLANG_BIN="$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin"

for spec in arm64-v8a:aarch64-linux-android:aarch64-linux-android x86_64:x86_64-linux-android:x86_64-linux-android; do
  IFS=: read -r abi zt cc <<<"$spec"
  build_vt "$zt.$API"
  dst="$ROOT/shared/src/androidMain/jniLibs/$abi"
  mkdir -p "$dst"
  "$CLANG_BIN/$cc$API-clang" "${LDFLAGS[@]}" -Wl,--exclude-libs,ALL -Wl,-z,max-page-size=16384 -I"$WORK/out/$zt.$API/include" "${SHIM[@]}" \
    "$WORK/out/$zt.$API/lib/libghostty-vt.a" -lm -o "$dst/libnexterm_vt.so"
done

rm -rf "$ROOT/shared/native/ghostty-vt.xcframework"
unzip -q -o ghostty-vt-$VT_VERSION.xcframework.zip -d "$ROOT/shared/native/"
rm -rf "$ROOT/shared/native/ghostty-vt.xcframework/macos-arm64_x86_64"
cp libghostty-vt-$VT_VERSION/LICENSE "$ROOT/shared/native/LICENSE-libghostty-vt"
ls -la "$ROOT"/shared/src/androidMain/jniLibs/*/
