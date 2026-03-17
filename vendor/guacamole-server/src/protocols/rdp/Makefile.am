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

lib_LTLIBRARIES = libguac-client-rdp.la
SUBDIRS = . tests

#
# Main RDP client library
#

nodist_libguac_client_rdp_la_SOURCES =  \
    _generated_channel_entry_wrappers.c \
    _generated_keymaps.c

libguac_client_rdp_la_SOURCES =                  \
    argv.c                                       \
    beep.c                                       \
    channels/audio-input/audio-buffer.c          \
    channels/audio-input/audio-input.c           \
    channels/cliprdr.c                           \
    channels/common-svc.c                        \
    channels/disp.c                              \
    channels/pipe-svc.c                          \
    channels/rail.c                              \
    channels/rdpdr/rdpdr-fs-messages-dir-info.c  \
    channels/rdpdr/rdpdr-fs-messages-file-info.c \
    channels/rdpdr/rdpdr-fs-messages-vol-info.c  \
    channels/rdpdr/rdpdr-fs-messages.c           \
    channels/rdpdr/rdpdr-fs.c                    \
    channels/rdpdr/rdpdr-messages.c              \
    channels/rdpdr/rdpdr-printer.c               \
    channels/rdpdr/rdpdr.c                       \
    channels/rdpei.c                             \
    channels/rdpgfx.c                            \
    channels/rdpsnd/rdpsnd-messages.c            \
    channels/rdpsnd/rdpsnd.c                     \
    client.c                                     \
    color.c                                      \
    decompose.c                                  \
    download.c                                   \
    error.c                                      \
    fs.c                                         \
    gdi.c                                        \
    input.c                                      \
    input-queue.c                                \
    keyboard.c                                   \
    keymap.c                                     \
    log.c                                        \
    ls.c                                         \
    plugins/channels.c                           \
    plugins/ptr-string.c                         \
    pointer.c                                    \
    print-job.c                                  \
    rdp.c                                        \
    resolution.c                                 \
    settings.c                                   \
    unicode.c                                    \
    upload.c                                     \
    user.c

noinst_HEADERS =                                 \
    argv.h                                       \
    beep.h                                       \
    channels/audio-input/audio-buffer.h          \
    channels/audio-input/audio-input.h           \
    channels/cliprdr.h                           \
    channels/common-svc.h                        \
    channels/disp.h                              \
    channels/pipe-svc.h                          \
    channels/rail.h                              \
    channels/rdpdr/rdpdr-fs-messages-dir-info.h  \
    channels/rdpdr/rdpdr-fs-messages-file-info.h \
    channels/rdpdr/rdpdr-fs-messages-vol-info.h  \
    channels/rdpdr/rdpdr-fs-messages.h           \
    channels/rdpdr/rdpdr-fs.h                    \
    channels/rdpdr/rdpdr-messages.h              \
    channels/rdpdr/rdpdr-printer.h               \
    channels/rdpdr/rdpdr.h                       \
    channels/rdpei.h                             \
    channels/rdpgfx.h                            \
    channels/rdpsnd/rdpsnd-messages.h            \
    channels/rdpsnd/rdpsnd.h                     \
    client.h                                     \
    color.h                                      \
    decompose.h                                  \
    download.h                                   \
    error.h                                      \
    fs.h                                         \
    gdi.h                                        \
    input.h                                      \
    keyboard.h                                   \
    keymap.h                                     \
    log.h                                        \
    ls.h                                         \
    plugins/channels.h                           \
    plugins/guacai/guacai-messages.h             \
    plugins/guacai/guacai.h                      \
    plugins/ptr-string.h                         \
    pointer.h                                    \
    print-job.h                                  \
    rdp.h                                        \
    resolution.h                                 \
    settings.h                                   \
    unicode.h                                    \
    upload.h                                     \
    user.h

libguac_client_rdp_la_CFLAGS = \
    -Werror -Wall -Iinclude    \
    @COMMON_INCLUDE@           \
    @COMMON_SSH_INCLUDE@       \
    @LIBGUAC_INCLUDE@          \
    @RDP_CFLAGS@

libguac_client_rdp_la_LDFLAGS = \
    -version-info 0:0:0         \
    @CAIRO_LIBS@                \
    @PTHREAD_LIBS@              \
    @RDP_LIBS@

libguac_client_rdp_la_LIBADD = \
    @COMMON_LTLIB@             \
    @LIBGUAC_LTLIB@

#
# Plugins for FreeRDP
#

freerdp_LTLIBRARIES =            \
    libguac-common-svc-client.la \
    libguacai-client.la

freerdpdir = @FREERDP_PLUGIN_DIR@

#
# Common SVC plugin (shared by RDPDR, RDPSND, etc.)
#

libguac_common_svc_client_la_SOURCES =        \
    plugins/guac-common-svc/guac-common-svc.c

libguac_common_svc_client_la_CFLAGS = \
    -Werror -Wall -Iinclude           \
    @LIBGUAC_INCLUDE@                 \
    @RDP_CFLAGS@

libguac_common_svc_client_la_LDFLAGS = \
    -module -avoid-version -shared     \
    @RDP_LIBS@

libguac_common_svc_client_la_LIBADD = \
    @LIBGUAC_LTLIB@

#
# Audio Input
#

libguacai_client_la_SOURCES =           \
    channels/audio-input/audio-buffer.c \
    plugins/guacai/guacai-messages.c    \
    plugins/guacai/guacai.c             \
    plugins/ptr-string.c

libguacai_client_la_CFLAGS = \
    -Werror -Wall -Iinclude  \
    @COMMON_INCLUDE@         \
    @COMMON_SSH_INCLUDE@     \
    @LIBGUAC_INCLUDE@        \
    @RDP_CFLAGS@

libguacai_client_la_LDFLAGS =      \
    -module -avoid-version -shared \
    @PTHREAD_LIBS@                 \
    @RDP_LIBS@

libguacai_client_la_LIBADD = \
    @COMMON_LTLIB@           \
    @LIBGUAC_LTLIB@

#
# Optional SFTP support
#

if ENABLE_COMMON_SSH
libguac_client_rdp_la_SOURCES += sftp.c
noinst_HEADERS                += sftp.h
libguac_client_rdp_la_LIBADD  += @COMMON_SSH_LTLIB@
endif

#
# Autogenerated keymaps and channel wrapper functions
#

CLEANFILES =                            \
    _generated_channel_entry_wrappers.c \
    _generated_keymaps.c

BUILT_SOURCES =                         \
    _generated_channel_entry_wrappers.c \
    _generated_keymaps.c

rdp_keymaps =                                \
    $(srcdir)/keymaps/base.keymap            \
    $(srcdir)/keymaps/base_altgr.keymap      \
    $(srcdir)/keymaps/failsafe.keymap        \
    $(srcdir)/keymaps/cs-cz-qwertz.keymap    \
    $(srcdir)/keymaps/de_de_qwertz.keymap    \
    $(srcdir)/keymaps/de_ch_qwertz.keymap    \
    $(srcdir)/keymaps/en_gb_qwerty.keymap    \
    $(srcdir)/keymaps/en_us_qwerty.keymap    \
    $(srcdir)/keymaps/es_es_qwerty.keymap    \
    $(srcdir)/keymaps/es_latam_qwerty.keymap \
    $(srcdir)/keymaps/fr_be_azerty.keymap    \
    $(srcdir)/keymaps/fr_ca_qwerty.keymap    \
    $(srcdir)/keymaps/fr_ch_qwertz.keymap    \
    $(srcdir)/keymaps/fr_fr_azerty.keymap    \
    $(srcdir)/keymaps/hu_hu_qwertz.keymap    \
    $(srcdir)/keymaps/it_it_qwerty.keymap    \
    $(srcdir)/keymaps/ja_jp_qwerty.keymap    \
    $(srcdir)/keymaps/no_no_qwerty.keymap    \
    $(srcdir)/keymaps/pl_pl_qwerty.keymap    \
    $(srcdir)/keymaps/pt_br_qwerty.keymap    \
    $(srcdir)/keymaps/pt_pt_qwerty.keymap    \
    $(srcdir)/keymaps/ro_ro_qwerty.keymap    \
    $(srcdir)/keymaps/sv_se_qwerty.keymap    \
    $(srcdir)/keymaps/da_dk_qwerty.keymap    \
    $(srcdir)/keymaps/tr_tr_qwerty.keymap

_generated_keymaps.c: $(rdp_keymaps) $(srcdir)/keymaps/generate.pl
	$(AM_V_GEN) $(srcdir)/keymaps/generate.pl $(rdp_keymaps)

_generated_channel_entry_wrappers.c: $(srcdir)/plugins/channels.h $(srcdir)/plugins/generate-entry-wrappers.pl
	$(AM_V_GEN) $(srcdir)/plugins/generate-entry-wrappers.pl $(srcdir)/plugins/channels.h

EXTRA_DIST =                           \
    $(rdp_keymaps)                     \
    keymaps/generate.pl                \
    plugins/generate-entry-wrappers.pl
