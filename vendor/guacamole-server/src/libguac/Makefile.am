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
# NOTE: Parts of this file (Makefile.am) are automatically transcluded verbatim
# into Makefile.in. Though the build system (GNU Autotools) automatically adds
# its own license boilerplate to the generated Makefile.in, that boilerplate
# does not apply to the transcluded portions of Makefile.am which are licensed
# to you by the ASF under the Apache License, Version 2.0, as described above.
#

AUTOMAKE_OPTIONS = foreign 
ACLOCAL_AMFLAGS = -I m4

lib_LTLIBRARIES = libguac.la
SUBDIRS = . tests

#
# Public headers
#

libguacincdir = $(includedir)/guacamole

libguacinc_HEADERS =                  \
    guacamole/argv.h                  \
    guacamole/argv-constants.h        \
    guacamole/argv-fntypes.h          \
    guacamole/assert.h                \
    guacamole/audio.h                 \
    guacamole/audio-fntypes.h         \
    guacamole/audio-types.h           \
    guacamole/client.h                \
    guacamole/client-constants.h      \
    guacamole/client-fntypes.h        \
    guacamole/client-types.h          \
    guacamole/display.h               \
    guacamole/display-constants.h     \
    guacamole/display-types.h         \
    guacamole/error.h                 \
    guacamole/error-types.h           \
    guacamole/fifo.h                  \
    guacamole/fifo-constants.h        \
    guacamole/fifo-types.h            \
    guacamole/fips.h                  \
    guacamole/flag.h                  \
    guacamole/flag-types.h            \
    guacamole/hash.h                  \
    guacamole/layer.h                 \
    guacamole/layer-types.h           \
    guacamole/mem.h                   \
    guacamole/object.h                \
    guacamole/object-types.h          \
    guacamole/parser-constants.h      \
    guacamole/parser.h                \
    guacamole/parser-types.h          \
    guacamole/plugin-constants.h      \
    guacamole/plugin.h                \
    guacamole/pool.h                  \
    guacamole/pool-types.h            \
    guacamole/protocol.h              \
    guacamole/protocol-constants.h    \
    guacamole/protocol-types.h        \
    guacamole/recording.h             \
    guacamole/rect.h                  \
    guacamole/rect-types.h            \
    guacamole/rwlock.h                \
    guacamole/socket.h                \
    guacamole/socket-constants.h      \
    guacamole/socket-fntypes.h        \
    guacamole/socket-types.h          \
    guacamole/stream.h                \
    guacamole/stream-types.h          \
    guacamole/string.h                \
    guacamole/tcp.h                   \
    guacamole/timestamp.h             \
    guacamole/timestamp-types.h       \
    guacamole/unicode.h               \
    guacamole/user.h                  \
    guacamole/user-constants.h        \
    guacamole/user-fntypes.h          \
    guacamole/user-types.h            \
    guacamole/wol.h                   \
    guacamole/wol-constants.h

#
# Private, installed headers
#

libguacprivincdir = $(includedir)/guacamole/private

libguacprivinc_HEADERS =              \
    guacamole/private/mem.h

#
# Private, non-installed headers
#

noinst_HEADERS =              \
    display-builtin-cursors.h \
    display-plan.h            \
    display-priv.h            \
    encode-jpeg.h             \
    encode-png.h              \
    id.h                      \
    palette.h                 \
    raw_encoder.h             \
    user-handlers.h           \
    wait-fd.h

libguac_la_SOURCES =          \
    argv.c                    \
    audio.c                   \
    client.c                  \
    display.c                 \
    display-builtin-cursors.c \
    display-cursor.c          \
    display-flush.c           \
    display-layer.c           \
    display-layer-list.c      \
    display-plan.c            \
    display-plan-combine.c    \
    display-plan-rect.c       \
    display-plan-search.c     \
    display-render-thread.c   \
    display-worker.c          \
    encode-jpeg.c             \
    encode-png.c              \
    error.c                   \
    fifo.c                    \
    fips.c                    \
    flag.c                    \
    hash.c                    \
    id.c                      \
    mem.c                     \
    rwlock.c                  \
    palette.c                 \
    parser.c                  \
    pool.c                    \
    protocol.c                \
    raw_encoder.c             \
    recording.c               \
    rect.c                    \
    socket.c                  \
    socket-broadcast.c        \
    socket-fd.c               \
    socket-nest.c             \
    socket-tee.c              \
    string.c                  \
    tcp.c                     \
    timestamp.c               \
    unicode.c                 \
    user.c                    \
    user-handlers.c           \
    user-handshake.c          \
    wait-fd.c	              \
    wol.c

# Compile WebP support if available
if ENABLE_WEBP
libguac_la_SOURCES += encode-webp.c
noinst_HEADERS += encode-webp.h
endif

# SSL support
if ENABLE_SSL
libguac_la_SOURCES += socket-ssl.c
libguacinc_HEADERS += guacamole/socket-ssl.h
endif

# Winsock support
if ENABLE_WINSOCK
libguac_la_SOURCES += socket-wsa.c
libguacinc_HEADERS += guacamole/socket-wsa.h
endif

libguac_la_CFLAGS = \
    -Werror -Wall -pedantic

libguac_la_LDFLAGS =     \
    -version-info 25:0:0 \
    -no-undefined        \
    @CAIRO_LIBS@         \
    @DL_LIBS@            \
    @JPEG_LIBS@          \
    @PNG_LIBS@           \
    @PTHREAD_LIBS@       \
    @RT_LIBS@            \
    @SSL_LIBS@           \
    @UUID_LIBS@          \
    @VORBIS_LIBS@        \
    @WEBP_LIBS@          \
    @WINSOCK_LIBS@

