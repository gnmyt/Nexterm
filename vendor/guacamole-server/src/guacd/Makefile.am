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

sbin_PROGRAMS = guacd

man_MANS =           \
    man/guacd.8      \
    man/guacd.conf.5

noinst_HEADERS =  \
    conf.h        \
    conf-args.h   \
    conf-file.h   \
    conf-parse.h  \
    connection.h  \
    log.h         \
    move-fd.h     \
    proc.h        \
    proc-map.h

guacd_SOURCES =  \
    conf-args.c  \
    conf-file.c  \
    conf-parse.c \
    connection.c \
    daemon.c     \
    log.c        \
    move-fd.c    \
    proc.c       \
    proc-map.c

guacd_CFLAGS =              \
    -Werror -Wall -pedantic \
    @COMMON_INCLUDE@        \
    @LIBGUAC_INCLUDE@

guacd_LDADD =        \
    @COMMON_LTLIB@   \
    @LIBGUAC_LTLIB@

guacd_LDFLAGS =    \
    @PTHREAD_LIBS@ \
    @SSL_LIBS@

EXTRA_DIST =            \
    init.d/guacd.in          \
    systemd/guacd.service.in \
    man/guacd.8.in           \
    man/guacd.conf.5.in

CLEANFILES = $(init_SCRIPTS) $(systemd_UNITS)

# Init script
if ENABLE_INIT
initdir = @init_dir@
init_SCRIPTS = init.d/guacd

init.d/guacd: init.d/guacd.in
	sed -e 's,[@]sbindir[@],$(sbindir),g' < init.d/guacd.in > init.d/guacd
	chmod +x init.d/guacd
endif

# Systemd service
if ENABLE_SYSTEMD
systemddir = @systemd_dir@
systemd_DATA = systemd/guacd.service

systemd/guacd.service: systemd/guacd.service.in
	sed -e 's,[@]sbindir[@],$(sbindir),g' < systemd/guacd.service.in > systemd/guacd.service
endif

