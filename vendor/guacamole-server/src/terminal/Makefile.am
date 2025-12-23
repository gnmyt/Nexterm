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

lib_LTLIBRARIES = libguac-terminal.la

libguac_terminalincdir = $(includedir)/guacamole/terminal

noinst_HEADERS =                 \
    terminal/buffer.h            \
    terminal/char-mappings.h     \
    terminal/common.h            \
    terminal/color-scheme.h      \
    terminal/display.h           \
    terminal/named-colors.h      \
    terminal/palette.h           \
    terminal/scrollbar.h         \
    terminal/select.h            \
    terminal/terminal-priv.h     \
    terminal/terminal-handlers.h \
    terminal/types.h             \
    terminal/typescript.h        \
    terminal/xparsecolor.h

libguac_terminalinc_HEADERS =    \
    terminal/terminal.h

libguac_terminal_la_SOURCES =   \
    buffer.c                    \
    char-mappings.c             \
    color-scheme.c              \
    common.c                    \
    display.c                   \
    named-colors.c              \
    palette.c                   \
    scrollbar.c                 \
    select.c                    \
    terminal.c                  \
    terminal-handlers.c         \
    terminal-stdin-stream.c     \
    typescript.c                \
    xparsecolor.c

libguac_terminal_la_CFLAGS = \
    -Werror -Wall            \
    @COMMON_INCLUDE@         \
    @LIBGUAC_INCLUDE@        \
    @PANGO_CFLAGS@           \
    @PANGOCAIRO_CFLAGS@

libguac_terminal_la_LIBADD = \
    @COMMON_LTLIB@           \
    @LIBGUAC_LTLIB@

libguac_terminal_la_LDFLAGS = \
    -version-info 2:0:0       \
    -no-undefined             \
    @CAIRO_LIBS@              \
    @MATH_LIBS@               \
    @PANGO_LIBS@              \
    @PANGOCAIRO_LIBS@         \
    @PTHREAD_LIBS@

