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

lib_LTLIBRARIES = libguac-client-ssh.la

libguac_client_ssh_la_SOURCES = \
    argv.c                      \
    client.c                    \
    clipboard.c                 \
    input.c                     \
    pipe.c                      \
    settings.c                  \
    sftp.c                      \
    ssh.c                       \
    ttymode.c                   \
    user.c

noinst_HEADERS =                \
    argv.h                      \
    client.h                    \
    clipboard.h                 \
    input.h                     \
    pipe.h                      \
    settings.h                  \
    sftp.h                      \
    ssh.h                       \
    ttymode.h                   \
    user.h

# Add agent sources if enabled
if ENABLE_SSH_AGENT
libguac_client_ssh_la_SOURCES += ssh_agent.c
noinst_HEADERS += ssh_agent.h
endif

libguac_client_ssh_la_CFLAGS = \
    -Werror -Wall -Iinclude    \
    @COMMON_SSH_INCLUDE@       \
    @LIBGUAC_INCLUDE@          \
    @TERMINAL_INCLUDE@

libguac_client_ssh_la_LIBADD = \
    @COMMON_LTLIB@             \
    @COMMON_SSH_LTLIB@         \
    @LIBGUAC_LTLIB@            \
    @TERMINAL_LTLIB@

libguac_client_ssh_la_LDFLAGS = \
    -version-info 0:0:0         \
    @PTHREAD_LIBS@              \
    @SSH_LIBS@                  \
    @SSL_LIBS@

