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

#
# Dockerfile for guacamole-server
#

# The Alpine Linux image that should be used as the basis for the guacd image
# NOTE: Using 3.18 because the required openssl1.1-compat-dev package was
# removed in more recent versions.
ARG ALPINE_BASE_IMAGE=3.18

# The target architecture of the build. Valid values are "ARM" and "X86". By
# default, this is detected automatically.
ARG BUILD_ARCHITECTURE

# The number of processes that may run simultaneously during the build. By
# default, this is detected automatically.
ARG BUILD_JOBS

# The directory that will house the guacamole-server source during the build 
ARG BUILD_DIR=/tmp/guacamole-server

# FreeRDP version (default to version 2)
ARG FREERDP_VERSION=2

# The final install location for guacamole-server and all dependencies. NOTE:
# This value is hard-coded in the entrypoint. Any change to this value must be
# propagated there.
ARG PREFIX_DIR=/opt/guacamole

#
# Automatically select the latest versions of each core protocol support
# library (these can be overridden at build time if a specific version is
# needed)
#
ARG WITH_FREERDP="${FREERDP_VERSION}(\.\d+)+"
ARG WITH_LIBSSH2='libssh2-\d+(\.\d+)+'
ARG WITH_LIBTELNET='\d+(\.\d+)+'
ARG WITH_LIBVNCCLIENT='LibVNCServer-\d+(\.\d+)+'
ARG WITH_LIBWEBSOCKETS='v\d+(\.\d+)+'

#
# Default build options for each core protocol support library, as well as
# guacamole-server itself (these can be overridden at build time if different
# options are needed)
#

ARG FREERDP_ARM_OPTS=""

ARG FREERDP_OPTS="\
    -DBUILTIN_CHANNELS=OFF \
    -DCHANNEL_URBDRC=OFF \
    -DWITH_ALSA=OFF \
    -DWITH_CAIRO=ON \
    -DWITH_CHANNELS=ON \
    -DWITH_CLIENT=ON \
    -DWITH_CUPS=OFF \
    -DWITH_DIRECTFB=OFF \
    -DWITH_FFMPEG=OFF \
    -DWITH_FUSE=OFF \
    -DWITH_GSM=OFF \
    -DWITH_GSSAPI=OFF \
    -DWITH_IPP=OFF \
    -DWITH_JPEG=ON \
    -DWITH_KRB5=ON \
    -DWITH_LIBSYSTEMD=OFF \
    -DWITH_MANPAGES=OFF \
    -DWITH_OPENH264=OFF \
    -DWITH_OPENSSL=ON \
    -DWITH_OSS=OFF \
    -DWITH_PCSC=OFF \
    -DWITH_PKCS11=OFF \
    -DWITH_PULSE=OFF \
    -DWITH_SERVER=OFF \
    -DWITH_SERVER_INTERFACE=OFF \
    -DWITH_SHADOW_MAC=OFF \
    -DWITH_SHADOW_X11=OFF \
    -DWITH_SWSCALE=OFF \
    -DWITH_WAYLAND=OFF \
    -DWITH_X11=OFF \
    -DWITH_X264=OFF \
    -DWITH_XCURSOR=ON \
    -DWITH_XEXT=ON \
    -DWITH_XI=OFF \
    -DWITH_XINERAMA=OFF \
    -DWITH_XKBFILE=ON \
    -DWITH_XRENDER=OFF \
    -DWITH_XTEST=OFF \
    -DWITH_XV=OFF \
    -DWITH_ZLIB=ON"

ARG FREERDP_X86_OPTS=""

ARG GUACAMOLE_SERVER_ARM_OPTS=""

ARG GUACAMOLE_SERVER_OPTS="\
    --disable-guaclog \
    CPPFLAGS=-Wno-error=deprecated-declarations"

ARG GUACAMOLE_SERVER_X86_OPTS=""

ARG LIBSSH2_ARM_OPTS=""

ARG LIBSSH2_OPTS="\
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_SHARED_LIBS=ON"

ARG LIBSSH2_X86_OPTS=""

ARG LIBTELNET_ARM_OPTS=""

ARG LIBTELNET_OPTS="\
    --disable-static \
    --disable-util"

ARG LIBTELNET_X86_OPTS=""

ARG LIBVNCCLIENT_ARM_OPTS=""

ARG LIBVNCCLIENT_OPTS=""

ARG LIBVNCCLIENT_X86_OPTS=""

ARG LIBWEBSOCKETS_ARM_OPTS=""

ARG LIBWEBSOCKETS_OPTS="\
    -DDISABLE_WERROR=ON \
    -DLWS_WITHOUT_SERVER=ON \
    -DLWS_WITHOUT_TESTAPPS=ON \
    -DLWS_WITHOUT_TEST_CLIENT=ON \
    -DLWS_WITHOUT_TEST_PING=ON \
    -DLWS_WITHOUT_TEST_SERVER=ON \
    -DLWS_WITHOUT_TEST_SERVER_EXTPOLL=ON \
    -DLWS_WITH_STATIC=OFF"

ARG LIBWEBSOCKETS_X86_OPTS=""

#
# Base builder image that will be used by subsequent build stages, including
# for building dependencies of guacamole-server.
#

FROM alpine:${ALPINE_BASE_IMAGE} AS builder
ARG BUILD_DIR

# Install build dependencies
RUN apk add --no-cache                \
        autoconf                      \
        automake                      \
        build-base                    \
        cairo-dev                     \
        cjson-dev                     \
        cmake                         \
        cunit-dev                     \
        git                           \
        grep                          \
        krb5-dev                      \
        libjpeg-turbo-dev             \
        libpng-dev                    \
        libtool                       \
        libwebp-dev                   \
        make                          \
        openssl1.1-compat-dev         \
        pango-dev                     \
        pulseaudio-dev                \
        sdl2-dev                      \
        sdl2_ttf-dev                  \
        util-linux-dev                \
        webkit2gtk-dev

# Copy generic, automatic build script
COPY ./src/guacd-docker/bin/autobuild.sh ${BUILD_DIR}/src/guacd-docker/bin/

#
# Build dependency: libssh2
#

FROM builder AS libssh2
ARG BUILD_DIR
ARG LIBSSH2_ARM_OPTS
ARG LIBSSH2_OPTS
ARG LIBSSH2_X86_OPTS
ARG PREFIX_DIR
ARG WITH_LIBSSH2

RUN ${BUILD_DIR}/src/guacd-docker/bin/autobuild.sh "LIBSSH2" \
    "https://github.com/libssh2/libssh2"

#
# Build dependency: libtelnet
#

FROM builder AS libtelnet
ARG BUILD_DIR
ARG LIBTELNET_ARM_OPTS
ARG LIBTELNET_OPTS
ARG LIBTELNET_X86_OPTS
ARG PREFIX_DIR
ARG WITH_LIBTELNET

RUN ${BUILD_DIR}/src/guacd-docker/bin/autobuild.sh "LIBTELNET" \
    "https://github.com/seanmiddleditch/libtelnet"

#
# Build dependency: libvncclient
#

FROM builder AS libvncclient
ARG BUILD_DIR
ARG LIBVNCCLIENT_ARM_OPTS
ARG LIBVNCCLIENT_OPTS
ARG LIBVNCCLIENT_X86_OPTS
ARG PREFIX_DIR
ARG WITH_LIBVNCCLIENT

RUN ${BUILD_DIR}/src/guacd-docker/bin/autobuild.sh "LIBVNCCLIENT" \
    "https://github.com/LibVNC/libvncserver"

#
# Build dependency: libwebsockets
#

FROM builder AS libwebsockets
ARG BUILD_DIR
ARG LIBWEBSOCKETS_ARM_OPTS
ARG LIBWEBSOCKETS_OPTS
ARG LIBWEBSOCKETS_X86_OPTS
ARG PREFIX_DIR
ARG WITH_LIBWEBSOCKETS

RUN ${BUILD_DIR}/src/guacd-docker/bin/autobuild.sh "LIBWEBSOCKETS" \
    "https://github.com/warmcat/libwebsockets"

#
# Build dependency: FreeRDP
#

FROM builder AS freerdp
ARG BUILD_DIR
ARG FREERDP_ARM_OPTS
ARG FREERDP_OPTS
ARG FREERDP_X86_OPTS
ARG PREFIX_DIR
ARG WITH_FREERDP

RUN ${BUILD_DIR}/src/guacd-docker/bin/autobuild.sh "FREERDP" \
    "https://github.com/FreeRDP/FreeRDP"

#
# STAGE 7: Collect dependencies built by previous stages and build
# guacamole-server.
#

FROM builder AS guacamole-server
ARG BUILD_DIR
ARG FREERDP_VERSION
ARG GUACAMOLE_SERVER_ARM_OPTS
ARG GUACAMOLE_SERVER_OPTS
ARG GUACAMOLE_SERVER_X86_OPTS
ARG PREFIX_DIR

# Copy dependencies built in previous stages
COPY --from=freerdp ${PREFIX_DIR} ${PREFIX_DIR}
COPY --from=libssh2 ${PREFIX_DIR} ${PREFIX_DIR}
COPY --from=libtelnet ${PREFIX_DIR} ${PREFIX_DIR}
COPY --from=libvncclient ${PREFIX_DIR} ${PREFIX_DIR}
COPY --from=libwebsockets ${PREFIX_DIR} ${PREFIX_DIR}

# Use guacamole-server source from build context
COPY . ${BUILD_DIR}

RUN ${BUILD_DIR}/src/guacd-docker/bin/autobuild.sh "GUACAMOLE_SERVER" "${BUILD_DIR}"

# Determine location of the FREERDP library based on the version.
ARG FREERDP_LIB_PATH=${PREFIX_DIR}/lib/freerdp${FREERDP_VERSION}

# Record the packages of all runtime library dependencies
RUN ${BUILD_DIR}/src/guacd-docker/bin/list-dependencies.sh \
        ${PREFIX_DIR}/sbin/guacd               \
        ${PREFIX_DIR}/lib/libguac-client-*.so  \
        ${FREERDP_LIB_PATH}/*guac*.so   \
        > ${PREFIX_DIR}/DEPENDENCIES

#
# STAGE 8: Final, runtime image.
#

# Use same Alpine version as the base for the runtime image
FROM alpine:${ALPINE_BASE_IMAGE} AS runtime
ARG PREFIX_DIR

# Copy build artifacts into this stage
COPY --from=guacamole-server ${PREFIX_DIR} ${PREFIX_DIR}

# Bring runtime environment up to date and install runtime dependencies
RUN apk add --no-cache                \
        ca-certificates               \
        font-noto-cjk                 \
        ghostscript                   \
        netcat-openbsd                \
        shadow                        \
        terminus-font                 \
        ttf-dejavu                    \
        ttf-liberation                \
        util-linux-login && \
    xargs apk add --no-cache < ${PREFIX_DIR}/DEPENDENCIES

# Runtime environment
ENV LC_ALL=C.UTF-8
ENV LD_LIBRARY_PATH=${PREFIX_DIR}/lib

# Checks the operating status every 5 minutes with a timeout of 5 seconds
HEALTHCHECK --interval=5m --timeout=5s CMD nc -z 127.0.0.1 4822 || exit 1

# Create a new user guacd
ARG UID=1000
ARG GID=1000
RUN groupadd --gid $GID guacd
RUN useradd --system --create-home --shell /sbin/nologin --uid $UID --gid $GID guacd

# Run with user guacd
USER guacd

# Expose the default listener port
EXPOSE 4822

COPY ./src/guacd-docker/bin/entrypoint.sh /opt/guacamole/
ENTRYPOINT [ "/opt/guacamole/entrypoint.sh" ]
