#!/bin/sh -e
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

##
## @fn autobuild.sh
##
## Automatically builds the source of guacamole-server or its various core
## protocol library dependencies. Usage of GNU Autotools vs. CMake is
## automatically detected. Additional build options may be provided using
## environment variables, including architecture-specific options.
##
## @param VAR_BASE
##     The text that should be used as the base for environment variables
##     that control the build. The following variables will be read:
##
##     - [VAR_BASE]_OPTS: Options that should be passed to the build regardless
##       of architecture.
##
##     - [VAR_BASE]_ARM_OPTS: Options that should be passed to the build only
##       if built for ARM CPUs.
##
##     - [VAR_BASE]_X86_OPTS: Options that should be passed to the build only
##       if built for x86 (Intel, AMD) CPUs.
##
##     - WITH_[VAR_BASE]: The git reference (tag, commit, etc.) that should be
##       built, or a regular expression that matches the version tag that
##       should be built (the largest-numbered tag will be chosen). This
##       variable is only applicable if the source is being pulled from a git
##       repository (the URL of a git repository is provided for LOCATION).
##
## @param LOCATION
##     The location of the source to be used for the build. This may be a
##     directory or the URL of a git repository.
##

VAR_BASE="$1"
LOCATION="$2"

# Pre-populate build control variables such that the custom build prefix is
# used for C headers, locating libraries, etc.
export CFLAGS="-I${PREFIX_DIR}/include"
export LDFLAGS="-L${PREFIX_DIR}/lib"
export PKG_CONFIG_PATH="${PREFIX_DIR}/lib/pkgconfig" 

# Ensure thread stack size will be 8 MB (glibc's default on Linux) rather than
# 128 KB (musl's default)
export LDFLAGS="$LDFLAGS -Wl,-z,stack-size=8388608"

PATTERN_VAR="WITH_${VAR_BASE}"
PATTERN="$(printenv "${PATTERN_VAR}" || true)"

# Allow dependencies to be manually omitted with the tag/commit pattern "NO"
if [ "$PATTERN" = "NO" ]; then
    echo "NOT building $REPO_DIR (explicitly skipped)"
    exit
fi

# Clone repository and change to top-level directory of source
if echo "$LOCATION" | grep -q '://'; then
    cd /tmp
    git clone "$LOCATION"
    SRC_DIR="$(basename "$LOCATION" .git)"
else
    SRC_DIR="$LOCATION"
fi

# Determine architecture that we're building on
if [ -z "$BUILD_ARCHITECTURE" ]; then
    case "$(uname -m)" in
        arm|armv6l|armv7l|armv8l|aarch64)
            BUILD_ARCHITECTURE="ARM"
            ;;
        i386|i686|x86_64)
            BUILD_ARCHITECTURE="X86"
            ;;
        *)
            BUILD_ARCHITECTURE="UNKNOWN"
            ;;
    esac
fi

# Determine how many procesess we can potentially run at once for the build
if [ -z "$BUILD_JOBS" ]; then
    BUILD_JOBS="$(nproc)"
fi

echo "Build architecture: $BUILD_ARCHITECTURE"
echo "Build parallelism: $BUILD_JOBS job(s)"
cd "$SRC_DIR/"

OPTION_VAR="${VAR_BASE}_OPTS"
ARCH_OPTION_VAR="${VAR_BASE}_${BUILD_ARCHITECTURE}_OPTS"
BUILD_OPTS="$(printenv "${OPTION_VAR}" || true) $(printenv "${ARCH_OPTION_VAR}" || true)"

# Download (if necessary) and log location of source
if [ -e .git ]; then

    # Locate tag/commit based on provided pattern
    VERSION="$(git tag -l --sort=-v:refname | grep -Px -m1 "$PATTERN" \
        || echo "$PATTERN")"

    # Switch to desired version of source
    echo "Building $SRC_DIR @ $VERSION ..."
    git -c advice.detachedHead=false checkout "$VERSION"

else
    echo "Building $SRC_DIR ..."
fi

# Configure build using CMake or GNU Autotools, whichever happens to be
# used by the library being built
if [ -e CMakeLists.txt ]; then
    cmake \
        -B "${SRC_DIR}-build" -S . \
        -DCMAKE_INSTALL_PREFIX:PATH="$PREFIX_DIR" \
        $BUILD_OPTS

    # Build and install
    cmake --build "${SRC_DIR}-build" --parallel "$BUILD_JOBS"
    cmake --install "${SRC_DIR}-build"
else
    [ -e configure ] || autoreconf -fi
    ./configure --prefix="$PREFIX_DIR" $BUILD_OPTS

    # Build and install
    make -j"$BUILD_JOBS" && make install
fi
