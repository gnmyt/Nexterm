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

bin_PROGRAMS = guacenc

man_MANS =        \
    man/guacenc.1

noinst_HEADERS =    \
    buffer.h        \
    cursor.h        \
    display.h       \
    encode.h        \
    ffmpeg-compat.h \
    guacenc.h       \
    image-stream.h  \
    instructions.h  \
    jpeg.h          \
    layer.h         \
    log.h           \
    parse.h         \
    png.h           \
    video.h

guacenc_SOURCES =           \
    buffer.c                \
    cursor.c                \
    display.c               \
    display-buffers.c       \
    display-image-streams.c \
    display-flatten.c       \
    display-layers.c        \
    display-sync.c          \
    encode.c                \
    ffmpeg-compat.c         \
    guacenc.c               \
    image-stream.c          \
    instructions.c          \
    instruction-blob.c      \
    instruction-cfill.c     \
    instruction-copy.c      \
    instruction-cursor.c    \
    instruction-dispose.c   \
    instruction-end.c       \
    instruction-img.c       \
    instruction-mouse.c     \
    instruction-move.c      \
    instruction-rect.c      \
    instruction-shade.c     \
    instruction-size.c      \
    instruction-sync.c      \
    instruction-transfer.c  \
    jpeg.c                  \
    layer.c                 \
    log.c                   \
    parse.c                 \
    png.c                   \
    video.c

# Compile WebP support if available
if ENABLE_WEBP
guacenc_SOURCES += webp.c
noinst_HEADERS  += webp.h
endif

guacenc_CFLAGS =            \
    -Werror -Wall           \
    @AVCODEC_CFLAGS@        \
    @AVFORMAT_CFLAGS@       \
    @AVUTIL_CFLAGS@         \
    @LIBGUAC_INCLUDE@       \
    @SWSCALE_CFLAGS@

guacenc_LDADD =     \
    @LIBGUAC_LTLIB@

guacenc_LDFLAGS =   \
    @AVCODEC_LIBS@  \
    @AVFORMAT_LIBS@ \
    @AVUTIL_LIBS@   \
    @CAIRO_LIBS@    \
    @JPEG_LIBS@     \
    @SWSCALE_LIBS@  \
    @WEBP_LIBS@

EXTRA_DIST =         \
    man/guacenc.1.in

