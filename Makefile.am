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

ACLOCAL_AMFLAGS = -I m4

# Subprojects
DIST_SUBDIRS =               \
    src/libguac              \
    src/common               \
    src/common-ssh           \
    src/terminal             \
    src/guacd                \
    src/guacenc              \
    src/guaclog              \
    src/pulse                \
    src/protocols/kubernetes \
    src/protocols/rdp        \
    src/protocols/ssh        \
    src/protocols/telnet     \
    src/protocols/vnc

SUBDIRS =        \
    src/libguac  \
    src/common

if ENABLE_COMMON_SSH
SUBDIRS += src/common-ssh
endif

if ENABLE_TERMINAL
SUBDIRS += src/terminal
endif

if ENABLE_PULSE
SUBDIRS += src/pulse
endif

if ENABLE_KUBERNETES
SUBDIRS += src/protocols/kubernetes
endif

if ENABLE_RDP
SUBDIRS += src/protocols/rdp
endif

if ENABLE_SSH
SUBDIRS += src/protocols/ssh
endif

if ENABLE_TELNET
SUBDIRS += src/protocols/telnet
endif

if ENABLE_VNC
SUBDIRS += src/protocols/vnc
endif

if ENABLE_GUACD
SUBDIRS += src/guacd
endif

if ENABLE_GUACENC
SUBDIRS += src/guacenc
endif

if ENABLE_GUACLOG
SUBDIRS += src/guaclog
endif

EXTRA_DIST =                         \
    .dockerignore                    \
    CONTRIBUTING                     \
    Dockerfile                       \
    LICENSE                          \
    NOTICE                           \
    bin/guacctl                      \
    doc/libguac/Doxyfile.in          \
    doc/libguac-terminal/Doxyfile.in \
    src/guacd-docker                 \
    util/generate-test-runner.pl

