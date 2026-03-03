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

AC_PREREQ([2.61])
AC_INIT([guacamole-server], [1.6.0])
AC_CONFIG_AUX_DIR([build-aux])
AM_INIT_AUTOMAKE([-Wall -Werror foreign subdir-objects])
AM_SILENT_RULES([yes])

LT_PREREQ([2.2])
LT_INIT([dlopen])

AC_CONFIG_HEADER([config.h])
AC_CONFIG_MACRO_DIR([m4])

# Use TAP test driver for tests (part of automake)
AC_REQUIRE_AUX_FILE([tap-driver.sh])

# Programs
AC_PROG_CC
AC_PROG_CC_C99
AC_PROG_LIBTOOL

# Initialize pkg-config support
PKG_PROG_PKG_CONFIG()

# Headers
AC_CHECK_HEADERS([fcntl.h stdlib.h string.h sys/socket.h time.h sys/time.h syslog.h unistd.h cairo/cairo.h pngstruct.h])

# Source characteristics
AC_DEFINE([_GNU_SOURCE],   [1], [Uses GNU-specific APIs (if available)])
AC_DEFINE([_XOPEN_SOURCE], [700], [Uses X/Open and POSIX APIs])
AC_DEFINE([__BSD_VISIBLE], [1], [Uses BSD-specific APIs (if available)])

# Check for availability of non-portable sched_getaffinity() function (one of
# several possible routes for determining the number of available processors)
AC_CHECK_FUNCS([sched_getaffinity])

# Check for whether math library is required
AC_CHECK_LIB([m], [cos],
             [MATH_LIBS=-lm],
             [AC_CHECK_DECL([cos],,
                            AC_MSG_ERROR("Complex math functions are missing and no libm was found")
                            [#include <math.h>])])

# libpng
AC_CHECK_LIB([png], [png_write_png], [PNG_LIBS=-lpng],
             AC_MSG_ERROR("libpng is required for writing png messages"))

# libjpeg
AC_CHECK_LIB([jpeg], [jpeg_start_compress], [JPEG_LIBS=-ljpeg],
             AC_MSG_ERROR("libjpeg is required for writing jpeg messages"))

# Cairo
AC_CHECK_LIB([cairo], [cairo_create], [CAIRO_LIBS=-lcairo],
             AC_MSG_ERROR("Cairo is required for drawing instructions"))

# libpthread
AC_CHECK_LIB([pthread], [pthread_create], [PTHREAD_LIBS=-lpthread
              AC_DEFINE([HAVE_LIBPTHREAD],,
                        [Whether libpthread was found])])

# librt
AC_CHECK_FUNC([timer_create], [AC_MSG_RESULT([timer_create was found without librt.])],
              [AC_CHECK_LIB([rt], [timer_create],
                            [AC_MSG_RESULT([timer_create was found in librt.])
                                           RT_LIBS=-lrt],
                            [AC_MSG_ERROR([timer_create could not be found.])])
              ])

# Include libdl for dlopen() if necessary
AC_CHECK_LIB([dl], [dlopen],
             [DL_LIBS=-ldl],
             [AC_CHECK_DECL([dlopen],,
                            AC_MSG_ERROR("libdl is required on systems which do not otherwise provide dlopen()"),
                            [#include <dlfcn.h>])])

#
# libuuid
#

have_libuuid=disabled
AC_ARG_WITH([libuuid],
            [AS_HELP_STRING([--with-libuuid],
                            [use libuuid to generate unique identifiers @<:@default=check@:>@])],
            [],
            [with_libuuid=check])

if test "x$with_libuuid" != "xno"
then
    have_libuuid=yes
    AC_CHECK_LIB([uuid], [uuid_generate],
                 [UUID_LIBS=-luuid]
                 [AC_DEFINE([HAVE_LIBUUID],, [Whether libuuid is available])],
                 [have_libuuid=no])
fi

# OSSP UUID (if libuuid is unavilable)
if test "x${have_libuuid}" != "xyes"
then

    AC_CHECK_LIB([ossp-uuid], [uuid_make], [UUID_LIBS=-lossp-uuid],
                 AC_CHECK_LIB([uuid], [uuid_make], [UUID_LIBS=-luuid],
                              AC_MSG_ERROR([
  --------------------------------------------
   Unable to find libuuid or the OSSP UUID library.
   Either libuuid (from util-linux) or the OSSP UUID library is required for
   guacamole-server to be built.
  --------------------------------------------])))

    # Check for and validate OSSP uuid.h header
    AC_CHECK_HEADERS([ossp/uuid.h])
    AC_CHECK_DECL([uuid_make],,
                  AC_MSG_ERROR("No OSSP uuid.h found in include path"),
                  [#ifdef HAVE_OSSP_UUID_H
                   #include <ossp/uuid.h>
                   #else
                   #include <uuid.h>
                   #endif
                   ])
fi

# cunit
AC_CHECK_LIB([cunit], [CU_run_test], [CUNIT_LIBS=-lcunit])

AC_SUBST(DL_LIBS)
AC_SUBST(MATH_LIBS)
AC_SUBST(PNG_LIBS)
AC_SUBST(JPEG_LIBS)
AC_SUBST(CAIRO_LIBS)
AC_SUBST(RT_LIBS)
AC_SUBST(PTHREAD_LIBS)
AC_SUBST(UUID_LIBS)
AC_SUBST(CUNIT_LIBS)

# Library functions
AC_CHECK_FUNCS([clock_gettime gettimeofday memmove memset select strdup nanosleep])

AC_CHECK_DECL([png_get_io_ptr],
    [AC_DEFINE([HAVE_PNG_GET_IO_PTR],,
               [Whether png_get_io_ptr() is defined])],,
    [#include <png.h>])

AC_CHECK_DECL([cairo_format_stride_for_width],
    [AC_DEFINE([HAVE_CAIRO_FORMAT_STRIDE_FOR_WIDTH],,
               [Whether cairo_format_stride_for_width() is defined])],,
    [#include <cairo/cairo.h>])

AC_CHECK_DECL([poll],
    [AC_DEFINE([HAVE_POLL],,
               [Whether poll() is defined])],,
    [#include <poll.h>])

AC_CHECK_DECL([strlcpy],
    [AC_DEFINE([HAVE_STRLCPY],,
               [Whether strlcpy() is defined])],,
    [#include <string.h>])

AC_CHECK_DECL([strlcat],
    [AC_DEFINE([HAVE_STRLCAT],,
               [Whether strlcat() is defined])],,
    [#include <string.h>])

AC_CHECK_DECL([strnstr],
    [AC_DEFINE([HAVE_STRNSTR],,
               [Whether strnstr() is defined])],,
    [#include <string.h>])

# Typedefs
AC_TYPE_SIZE_T
AC_TYPE_SSIZE_T

# Bundled libguac
AC_SUBST([LIBGUAC_LTLIB],   '$(top_builddir)/src/libguac/libguac.la')
AC_SUBST([LIBGUAC_INCLUDE], '-I$(top_srcdir)/src/libguac')

# Common non-libguac utility library
AC_SUBST([COMMON_LTLIB],   '$(top_builddir)/src/common/libguac_common.la')
AC_SUBST([COMMON_INCLUDE], '-I$(top_srcdir)/src/common')

# Common PulseAudio utility library
AC_SUBST([PULSE_LTLIB],   '$(top_builddir)/src/pulse/libguac_pulse.la')
AC_SUBST([PULSE_INCLUDE], '-I$(top_srcdir)/src/pulse')

# Common base SSH client
AC_SUBST([COMMON_SSH_LTLIB],   '$(top_builddir)/src/common-ssh/libguac_common_ssh.la')
AC_SUBST([COMMON_SSH_INCLUDE], '-I$(top_srcdir)/src/common-ssh')

# Kubernetes support
AC_SUBST([LIBGUAC_CLIENT_KUBERNETES_LTLIB],   '$(top_builddir)/src/protocols/kubernetes/libguac-client-kubernetes.la')
AC_SUBST([LIBGUAC_CLIENT_KUBERNETES_INCLUDE], '-I$(top_srcdir)/src/protocols/kubernetes')

# RDP support
AC_SUBST([LIBGUAC_CLIENT_RDP_LTLIB],   '$(top_builddir)/src/protocols/rdp/libguac-client-rdp.la')
AC_SUBST([LIBGUAC_CLIENT_RDP_INCLUDE], '-I$(top_srcdir)/src/protocols/rdp')

# Terminal emulator
AC_SUBST([TERMINAL_LTLIB],   '$(top_builddir)/src/terminal/libguac-terminal.la')
AC_SUBST([TERMINAL_INCLUDE], '-I$(top_srcdir)/src/terminal $(PANGO_CFLAGS) $(PANGOCAIRO_CFLAGS) $(COMMON_INCLUDE)')

# Init directory
AC_ARG_WITH(init_dir,
            [AS_HELP_STRING([--with-init-dir=<path>],
                            [install init scripts to the given directory])
            ],init_dir=$withval)
AM_CONDITIONAL([ENABLE_INIT], [test "x${init_dir}" != "x"])
AC_SUBST(init_dir)

# Systemd directory
AC_ARG_WITH(systemd_dir,
            [AS_HELP_STRING([--with-systemd-dir=<path>],
                            [install systemd units to the given directory])
            ],systemd_dir=$withval)
AM_CONDITIONAL([ENABLE_SYSTEMD], [test "x${systemd_dir}" != "x"])
AC_SUBST(systemd_dir)

# guacd config file
AC_ARG_WITH(guacd_conf,
            [AS_HELP_STRING([--with-guacd-conf=<path>],
                            [the full path to the guacd config file @<:@default=/etc/guacamole/guacd.conf@:>@])],
            [guacd_conf=$withval],
            [guacd_conf=/etc/guacamole/guacd.conf])
AC_DEFINE_UNQUOTED([GUACD_CONF_FILE], ["$guacd_conf"], [The full path to the guacd config file])

#
# libavcodec
#

have_libavcodec=disabled
AC_ARG_WITH([libavcodec],
            [AS_HELP_STRING([--with-libavcodec],
                            [use libavcodec when encoding video @<:@default=check@:>@])],
            [],
            [with_libavcodec=check])

if test "x$with_libavcodec" != "xno"
then
    have_libavcodec=yes
    PKG_CHECK_MODULES([AVCODEC], [libavcodec],, [have_libavcodec=no]);
fi

AM_CONDITIONAL([ENABLE_AVCODEC], [test "x${have_libavcodec}" = "xyes"])

#
# libavformat
#

have_libavformat=disabled
AC_ARG_WITH([libavformat],
            [AS_HELP_STRING([--with-libavformat],
                            [use libavformat when encoding video @<:@default=check@:>@])],
            [],
            [with_libavformat=check])

if test "x$with_libavformat" != "xno"
then
    have_libavformat=yes
    PKG_CHECK_MODULES([AVFORMAT], [libavformat],, [have_libavformat=no]);
fi

AM_CONDITIONAL([ENABLE_AVFORMAT], [test "x${have_libavformat}" = "xyes"])

#
# libavutil
#

have_libavutil=disabled
AC_ARG_WITH([libavutil],
            [AS_HELP_STRING([--with-libavutil],
                            [use libavutil when encoding video @<:@default=check@:>@])],
            [],
            [with_libavutil=check])

if test "x$with_libavutil" != "xno"
then
    have_libavutil=yes
    PKG_CHECK_MODULES([AVUTIL], [libavutil],, [have_libavutil=no]);
fi

AM_CONDITIONAL([ENABLE_AVUTIL], [test "x${have_libavutil}" = "xyes"])

#
# libswscale
#

have_libswscale=disabled
AC_ARG_WITH([libswscale],
            [AS_HELP_STRING([--with-libswscale],
                            [use libswscale when encoding video @<:@default=check@:>@])],
            [],
            [with_libswscale=check])

if test "x$with_libswscale" != "xno"
then
    have_libswscale=yes
    PKG_CHECK_MODULES([SWSCALE], [libswscale],, [have_libswscale=no]);
fi

AM_CONDITIONAL([ENABLE_SWSCALE], [test "x${have_libswscale}" = "xyes"])

#
# libssl
#

have_ssl=disabled
SSL_LIBS=
AC_ARG_WITH([ssl],
            [AS_HELP_STRING([--with-ssl],
                            [support SSL encryption @<:@default=check@:>@])],
            [],
            [with_ssl=check])

if test "x$with_ssl" != "xno"
then
    have_ssl=yes

    AC_CHECK_HEADER(openssl/ssl.h,, [have_ssl=no])
    AC_CHECK_LIB([ssl], [SSL_CTX_new], [SSL_LIBS="$SSL_LIBS -lssl -lcrypto"], [have_ssl=no])

    if test "x${have_ssl}" = "xno"
    then
        AC_MSG_WARN([
  --------------------------------------------
   Unable to find libssl.
   guacd will not support SSL connections.
  --------------------------------------------])
    else
        AC_DEFINE([ENABLE_SSL],, [Whether SSL-related support is enabled])

        # OpenSSL 1.1 does away with explicit threading callbacks
        AC_MSG_CHECKING([whether libssl requires threading callbacks])
        AC_COMPILE_IFELSE([AC_LANG_SOURCE([[

            #include <openssl/opensslv.h>

            #if OPENSSL_VERSION_NUMBER < 0x10100000L
            #error Threading callbacks required.
            #endif

            int main() {
                return 0;
            }

          ]])],
          [AC_MSG_RESULT([no])],
          [AC_MSG_RESULT([yes])
           AC_DEFINE([OPENSSL_REQUIRES_THREADING_CALLBACKS],,
                     [Whether OpenSSL requires explicit threading callbacks for threadsafety])])

    fi
fi

AM_CONDITIONAL([ENABLE_SSL], [test "x${have_ssl}" = "xyes"])
AC_SUBST(SSL_LIBS)

#
# Winsock
#

have_winsock=disabled
WINSOCK_LIBS=
AC_ARG_WITH([winsock],
            [AS_HELP_STRING([--with-winsock],
                            [support Windows Sockets API @<:@default=check@:>@])],
            [],
            [with_winsock=check])

if test "x$with_winsock" != "xno"
then
    have_winsock=yes
    AC_CHECK_LIB([wsock32], [main],
                 [WINSOCK_LIBS="-lwsock32"]
                 [AC_DEFINE([ENABLE_WINSOCK],,
                            [Whether Windows Socket API support is enabled])],
                 [have_winsock=no])
fi

AM_CONDITIONAL([ENABLE_WINSOCK], [test "x${have_winsock}" = "xyes"])
AC_SUBST(WINSOCK_LIBS)

#
# Ogg Vorbis
#

have_vorbis=disabled
VORBIS_LIBS=
AC_ARG_WITH([vorbis],
            [AS_HELP_STRING([--with-vorbis],
                            [support Ogg Vorbis @<:@default=check@:>@])],
            [],
            [with_vorbis=check])

if test "x$with_vorbis" != "xno"
then
    have_vorbis=yes

    AC_CHECK_HEADER(vorbis/vorbisenc.h,, [have_vorbis=no])
    AC_CHECK_LIB([ogg], [ogg_stream_init], [VORBIS_LIBS="$VORBIS_LIBS -logg"], [have_vorbis=no])
    AC_CHECK_LIB([vorbis], [vorbis_block_init], [VORBIS_LIBS="$VORBIS_LIBS -lvorbis"], [have_vorbis=no])
    AC_CHECK_LIB([vorbisenc], [vorbis_encode_init], [VORBIS_LIBS="$VORBIS_LIBS -lvorbisenc"], [have_vorbis=no])

    if test "x${have_vorbis}" = "xno"
    then
        AC_MSG_WARN([
  --------------------------------------------
   Unable to find libogg / libvorbis / libvorbisenc.
   Sound will not be encoded with Ogg Vorbis.
  --------------------------------------------])
    else
        AC_DEFINE([ENABLE_OGG],,
                  [Whether support for Ogg Vorbis is enabled])
    fi
fi

AM_CONDITIONAL([ENABLE_OGG], [test "x${have_vorbis}" = "xyes"])
AC_SUBST(VORBIS_LIBS)

#
# PulseAudio
#

have_pulse=disabled
PULSE_LIBS=
AC_ARG_WITH([pulse],
            [AS_HELP_STRING([--with-pulse],
                            [support PulseAudio @<:@default=check@:>@])],
            [],
            [with_pulse=check])

if test "x$with_pulse" != "xno"
then
    have_pulse=yes

    AC_CHECK_LIB([pulse], [pa_context_new], [PULSE_LIBS="$PULSE_LIBS -lpulse"], [have_pulse=no])

    if test "x${have_pulse}" = "xno"
    then
        AC_MSG_WARN([
  --------------------------------------------
   Unable to find libpulse
   Sound support for VNC will be disabled
  --------------------------------------------])
    else
        AC_DEFINE([ENABLE_PULSE],, [Whether PulseAudio support is enabled])
    fi
fi

AM_CONDITIONAL([ENABLE_PULSE], [test "x${have_pulse}" = "xyes"])
AC_SUBST(PULSE_LIBS)

#
# PANGO
#

have_pango=disabled
AC_ARG_WITH([pango],
            [AS_HELP_STRING([--with-pango],
                            [support Pango text layout @<:@default=check@:>@])],
            [],
            [with_pango=check])

if test "x$with_pango" != "xno"
then
    have_pango=yes
    PKG_CHECK_MODULES([PANGO], [pango],, [have_pango=no]);
    PKG_CHECK_MODULES([PANGOCAIRO], [pangocairo],, [have_pango=no]);
fi

#
# Terminal emulator
#

have_terminal=disabled
AC_ARG_WITH([terminal],
            [AS_HELP_STRING([--with-terminal],
                            [support text-based protocols @<:@default=check@:>@])],
            [],
            [with_terminal=check])

if test "x$with_terminal" != "xno"
then
    have_terminal=yes
    if test "x${have_pango}" != "xyes"
    then
        have_terminal=no
    fi
fi

AM_CONDITIONAL([ENABLE_TERMINAL], [test "x${have_terminal}" = "xyes"])

#
# libVNCServer
#

have_libvncserver=disabled
VNC_LIBS=
AC_ARG_WITH([vnc],
            [AS_HELP_STRING([--with-vnc],
                            [support VNC @<:@default=check@:>@])],
            [],
            [with_vnc=check])

if test "x$with_vnc" != "xno"
then
    have_libvncserver=yes
    AC_CHECK_LIB([vncclient], [rfbInitClient], [VNC_LIBS="$VNC_LIBS -lvncclient"], [have_libvncserver=no])
fi

#
# Underlying libvncserver usage of gcrypt
#

if test "x${have_libvncserver}" = "xyes"
then

    # Whether libvncserver was built against libgcrypt
    AC_CHECK_DECL([LIBVNCSERVER_WITH_CLIENT_GCRYPT],
                         [AC_CHECK_HEADER(gcrypt.h,,
                                          [AC_MSG_WARN([
  --------------------------------------------
   libvncserver appears to be built against
   libgcrypt, but the libgcrypt headers
   could not be found. VNC will be disabled.
  --------------------------------------------])
                                           have_libvncserver=no])],,
                    [[#include <rfb/rfbconfig.h>]])

fi

AM_CONDITIONAL([ENABLE_VNC], [test "x${have_libvncserver}" = "xyes"])
AC_SUBST(VNC_LIBS)

#
# Repeater support within libVNCServer
#

if test "x${have_libvncserver}" = "xyes"
then

    have_vnc_repeater=yes
    AC_CHECK_MEMBERS([rfbClient.destHost, rfbClient.destPort],
                     [], [have_vnc_repeater=no],
                      [[#include <rfb/rfbclient.h>]])

    if test "x${have_vnc_repeater}" = "xno"
    then
        AC_MSG_WARN([
      --------------------------------------------
       No repeater support found in libvncclient.
       Support for VNC repeaters will not be built.
      --------------------------------------------])
    else
        AC_DEFINE([ENABLE_VNC_REPEATER],,
                  [Whether support for VNC repeaters is enabled.])
    fi

fi

#
# Listening support within libVNCServer
#

if test "x${have_libvncserver}" = "xyes"
then

    have_vnc_listen=yes
    AC_CHECK_DECL([listenForIncomingConnectionsNoFork],
                  [], [have_vnc_listen=no],
                  [[#include <rfb/rfbclient.h>]])

    if test "x${have_vnc_listen}" = "xno"
    then
        AC_MSG_WARN([
      --------------------------------------------
       No listening support found in libvncclient.
       Support for listen-mode connections will not be built.
      --------------------------------------------])
    else
        AC_DEFINE([ENABLE_VNC_LISTEN],,
                  [Whether support for listen-mode VNC connections is enabled.])
    fi

fi

#
# TLS Locking Support within libVNCServer
#

if test "x${have_libvncserver}" = "xyes"
then

    have_vnc_tls_locking=yes
    AC_CHECK_MEMBERS([rfbClient.LockWriteToTLS, rfbClient.UnlockWriteToTLS],
                     [], [have_vnc_tls_locking=no],
                     [[#include <rfb/rfbclient.h>]])

    if test "x${have_vnc_tls_locking}" = "xno"
    then
        AC_MSG_WARN([
      --------------------------------------------
       This version of libvncclient lacks support
       for TLS locking.  VNC connections that use
       TLS may experience instability as documented
       in GUACAMOLE-414])
    else
        AC_DEFINE([ENABLE_VNC_TLS_LOCKING],,
                  [Whether support for TLS locking within VNC is enabled.])
    fi

fi

#
# Generic credential support within libVNCServer (authentication beyond
# basic, standard VNC passwords)
#

if test "x${have_libvncserver}" = "xyes"
then

    have_vnc_creds=yes
    AC_CHECK_MEMBERS([rfbClient.GetCredential],
                     [], [have_vnc_creds=no],
                     [[#include <rfb/rfbclient.h>]])

    if test "x${have_vnc_creds}" = "xno"
    then
        AC_MSG_WARN([
      --------------------------------------------
       No generic credential support found in libvncclient.
       VNC authentication support will be limited to passwords.
      --------------------------------------------])
    else
        AC_DEFINE([ENABLE_VNC_GENERIC_CREDENTIALS],,
                  [Whether support for generic VNC credentials is available.])
    fi

fi

#
# libVNCserver support for the rfbSetDesktopSizeMsg message and the screen
# data structure, both of which are required in order to properly request that
# a remote server resize its screen to match the dimensions that the client
# sends. If libvnc lacks either this message or the screen data structure
# remote resize will be completely disabled.
#

if test "x${have_libvncserver}" = "xyes"
then

    have_vnc_resize_support=yes
    AC_CHECK_TYPE([rfbSetDesktopSizeMsg],
                     [], [have_vnc_resize_support=no],
                     [[#include <rfb/rfbproto.h>]])

    AC_CHECK_MEMBERS([rfbClient.screen],
                     [], [have_vnc_resize_support=no],
                     [[#include <rfb/rfbclient.h>]])

    if test "x${have_vnc_resize_support}" = "xno"
    then
        AC_MSG_WARN([
      --------------------------------------------------------
       The libvncclient library lacks support for either the
       rfbSetDesktopSizeMsg message or for extended screen
       support. Resizing of remote displays will be disabled.
      --------------------------------------------------------])
    else
        AC_DEFINE([LIBVNC_HAS_RESIZE_SUPPORT],,
                  [Whether VNC client will support sending desktop size messages.])
    fi

fi

#
# libVNCserver support for the requestedResize member, which enables the 
# client to pause frame buffer updates during a resize operation. If support
# for this is missing, Guacamole may still attempt to send the resize requests
# to the remote display, but there may be odd display behavior just before,
# during, or just after the resize, if a display update message happens to
# coincide closely enough with a display resize message.
#

if test "x${have_libvncserver}" = "xyes"
then

    have_vnc_requestedresize=yes
    AC_CHECK_MEMBERS([rfbClient.requestedResize],
                     [], [have_vnc_requestedresize=no],
                     [[#include <rfb/rfbclient.h>]])

    if test "x${have_vnc_requestedresize}" = "xyes"
    then
        AC_DEFINE([LIBVNC_CLIENT_HAS_REQUESTED_RESIZE],,
                  [Whether rfbClient contains the requestedResize member.])
    fi

fi

#
# libVNCserver support for extended key events (SendExtendedKeyEvent).
# This allows sending XT scancodes alongside keysyms for proper keyboard
# layout support with QEMU.
#

if test "x${have_libvncserver}" = "xyes"
then

    have_vnc_extended_key_event=yes
    AC_CHECK_DECL([SendExtendedKeyEvent],
                  [], [have_vnc_extended_key_event=no],
                  [[#include <rfb/rfbclient.h>]])

    if test "x${have_vnc_extended_key_event}" = "xyes"
    then
        AC_DEFINE([LIBVNC_HAS_EXTENDED_KEY_EVENT],,
                  [Whether libvncclient supports SendExtendedKeyEvent.])
    fi

fi

#
# FreeRDP (libfreerdpX, libfreerdp-clientX, and libwinprX)
#

freerdp_version=
have_freerdp=disabled
FREERDP_PLUGIN_DIR=

AC_ARG_WITH([rdp],
            [AS_HELP_STRING([--with-rdp],
                            [support RDP @<:@default=check@:>@])],
            [],
            [with_rdp=check])

# FreeRDP plugin directory
AC_ARG_WITH(freerdp_plugin_dir,
            [AS_HELP_STRING([--with-freerdp-plugin-dir=<path>],
                            [install FreeRDP plugins to the given directory @<:@default=check@:>@])
            ],FREERDP_PLUGIN_DIR=$withval)

# Preserve CPPFLAGS so it can be restored later, following the addition of
# options specific to FreeRDP tests
OLDCPPFLAGS="$CPPFLAGS"

if test "x$with_rdp" != "xno"
then
    freerdp_version="(2.x)"
    have_freerdp=yes
    PKG_CHECK_MODULES([RDP], [freerdp2 freerdp-client2 winpr2],
                      [CPPFLAGS="${RDP_CFLAGS} -Werror $CPPFLAGS"]
                      [AS_IF([test "x${FREERDP_PLUGIN_DIR}" = "x"],
                             [FREERDP_PLUGIN_DIR="`$PKG_CONFIG --variable=libdir freerdp2`/freerdp2"])],
                      [freerdp_version=
                       have_freerdp=no])
fi

if test "x$with_rdp" != "xno" -a "x${have_freerdp}" = "xno"
then
    freerdp_version="(3.x)"
    have_freerdp=yes
    PKG_CHECK_MODULES([RDP], [freerdp3 freerdp-client3 winpr3],
                      [CPPFLAGS="${RDP_CFLAGS} -Werror $CPPFLAGS"]
                      [AS_IF([test "x${FREERDP_PLUGIN_DIR}" = "x"],
                             [FREERDP_PLUGIN_DIR="`$PKG_CONFIG --variable=libdir freerdp3`/freerdp3"])],
                      [AC_MSG_WARN([
  --------------------------------------------
   Unable to find FreeRDP.
   RDP will be disabled.
  --------------------------------------------])
                       freerdp_version=
                       have_freerdp=no])
fi

# Available color conversion functions
if test "x${have_freerdp}" = "xyes"
then

    # FreeRDP 2.0.0-rc3 and older referred to FreeRDPConvertColor() as
    # ConvertColor()
    AC_CHECK_DECL([FreeRDPConvertColor],
                  [AC_DEFINE([HAVE_FREERDPCONVERTCOLOR],,
                             [Whether FreeRDPConvertColor() is defined])],,
                  [#include <freerdp/codec/color.h>])

fi

# It is difficult or impossible to test for variations in FreeRDP behavior in
# between releases, as the change in behavior may not (yet) be associated with
# a corresponding change in version number and may not have any detectable
# effect on the FreeRDP API

AC_ARG_ENABLE(allow_freerdp_snapshots,
              [AS_HELP_STRING([--enable-allow-freerdp-snapshots],
                              [allow building against unknown development snapshots of FreeRDP])
              ],allow_freerdp_snapshots=yes)

if test "x${have_freerdp}" = "xyes" -a "x${allow_freerdp_snapshots}" != "xyes"
then

    AC_MSG_CHECKING([whether FreeRDP appears to be a development version])
    AC_EGREP_CPP([\"[0-9]+\\.[0-9]+\\.[0-9]+(-rc[0-9]+)?\"], [

        #include <freerdp/version.h>
        FREERDP_VERSION_FULL

    ],
    [AC_MSG_RESULT([no])],
    [AC_MSG_RESULT([yes])]
    [AC_MSG_ERROR([
  --------------------------------------------
   You are building against a development version of FreeRDP. Non-release
   versions of FreeRDP may have differences in behavior that are impossible to
   check for at build time. This may result in memory leaks or other strange
   behavior.

   *** PLEASE USE A RELEASED VERSION OF FREERDP IF POSSIBLE ***

   If you are ABSOLUTELY CERTAIN that building against this version of FreeRDP
   is OK, rerun configure with the --enable-allow-freerdp-snapshots
  --------------------------------------------])])

fi

# Variation in memory internal allocation/free behavior for bitmaps
if test "x${have_freerdp}" = "xyes"
then

    # FreeRDP 2.0.0-rc0 and older automatically free rdpBitmap and its
    # associated data member within Bitmap_Free(), relying on the
    # implementation-specific free handler to free only implementation-specific
    # data. This changed in commit 2cf10cc, and implementations must now
    # manually free all data associated with the rdpBitmap, even data which
    # was not allocated by the implementation.
    AC_MSG_CHECKING([whether Bitmap_Free() frees the rdpBitmap and its image data])
    AC_EGREP_CPP([\"2\\.0\\.0-dev\"], [

        #include <freerdp/version.h>
        FREERDP_VERSION_FULL

    ],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([FREERDP_BITMAP_FREE_FREES_BITMAP],,
               [Whether Bitmap_Free() frees the rdpBitmap and its image data])],
    [AC_MSG_RESULT([no])])

fi

# Variation in memory internal allocation/free behavior for channel streams
if test "x${have_freerdp}" = "xyes"
then

    # FreeRDP 2.0.0-rc3 through 2.0.0-rc4 automatically free the wStream
    # provided to pVirtualChannelWriteEx(). This changed in commit 1b78b59, and
    # implementations must manually free the wStream after it is no longer
    # needed (after the write is complete or cancelled).
    AC_MSG_CHECKING([whether pVirtualChannelWriteEx() frees the wStream upon completion])
    AC_EGREP_CPP([\"2\\.0\\.0-(rc|dev)[3-4]\"], [

        #include <freerdp/version.h>
        FREERDP_VERSION_FULL

    ],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([FREERDP_SVC_CORE_FREES_WSTREAM],,
               [Whether pVirtualChannelWriteEx() frees the wStream upon completion])],
    [AC_MSG_RESULT([no])])

fi

# Glyph callback variants
if test "x${have_freerdp}" = "xyes"
then

    # FreeRDP 2.0.0-rc3 and older used UINT32 for integer parameters to all
    # rdpGlyph callbacks
    AC_MSG_CHECKING([whether rdpGlyph callbacks accept INT32 integer parameters])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[

        #include <freerdp/freerdp.h>
        #include <freerdp/graphics.h>
        #include <winpr/wtypes.h>

        BOOL test_begindraw(rdpContext* context, INT32 x, INT32 y,
                INT32 width, INT32 height, UINT32 fgcolor, UINT32 bgcolor,
                BOOL redundant);

        rdpGlyph glyph = {
            .BeginDraw = test_begindraw
        };

        int main() {
            return (int) glyph.BeginDraw(NULL, 0, 0, 0, 0, 0, 0, FALSE);
        }

    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([FREERDP_GLYPH_CALLBACKS_ACCEPT_INT32],,
               [Whether rdpGlyph callbacks accept INT32 integer parameters])],
    [AC_MSG_RESULT([no])])

fi

# CLIPRDR callback variants
if test "x${have_freerdp}" = "xyes"
then

    # FreeRDP 2.0.0-rc3 and older did not use const for CLIPRDR callbacks
    AC_MSG_CHECKING([whether CLIPRDR callbacks require const for their final parameter])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[

        #include <freerdp/client/cliprdr.h>
        #include <winpr/wtypes.h>

        UINT test_monitor_ready(CliprdrClientContext* cliprdr,
                const CLIPRDR_MONITOR_READY* monitor_ready);

        CliprdrClientContext context = {
            .MonitorReady = test_monitor_ready
        };

        int main() {
            return (int) context.MonitorReady(NULL, NULL);
        }

    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([FREERDP_CLIPRDR_CALLBACKS_REQUIRE_CONST],,
               [Whether CLIPRDR callbacks require const for the final parameter])],
    [AC_MSG_RESULT([no])])

fi

# RAIL callback variants
if test "x${have_freerdp}" = "xyes"
then

    # FreeRDP 2.0.0-rc3 and older did not use const for RAIL callbacks
    AC_MSG_CHECKING([whether RAIL callbacks require const for their final parameter])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[

        #include <freerdp/client/rail.h>
        #include <winpr/wtypes.h>

        UINT test_server_handshake(RailClientContext* rail,
                const RAIL_HANDSHAKE_ORDER* handshake);

        RailClientContext context = {
            .ServerHandshake = test_server_handshake
        };

        int main() {
            return (int) context.ServerHandshake(NULL, NULL);
        }

    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([FREERDP_RAIL_CALLBACKS_REQUIRE_CONST],,
               [Whether RAIL callbacks require const for the final parameter])],
    [AC_MSG_RESULT([no])])

fi

# Support for receiving unannounced orders from the RDP server
if test "x${have_freerdp}" = "xyes"
then
    AC_CHECK_MEMBERS([rdpSettings.AllowUnanouncedOrdersFromServer],,
                     [AC_MSG_WARN([
  --------------------------------------------
   This version of FreeRDP does not support relaxed order checks. RDP servers
   that send orders that the client did not announce as supported (such as the
   VirtualBox RDP server) will likely not be usable.

   See: https://issues.apache.org/jira/browse/GUACAMOLE-962
  --------------------------------------------])],
                     [[#include <freerdp/freerdp.h>]])
fi

# Updated certificate verification callback (introduced with 2.0.0, not present
# in 2.0.0-rc4 or earlier)
if test "x${have_freerdp}" = "xyes"
then
    AC_CHECK_MEMBERS([freerdp.VerifyCertificateEx],,,
                      [[#include <freerdp/freerdp.h>]])
fi

if test "x${have_freerdp}" = "xyes"
then
    AC_CHECK_DECLS([winpr_aligned_free],
                   [AC_DEFINE([HAVE_WINPR_ALIGNED],,
                              [Defined if winpr_aligned_free() and winpr_aligned_malloc() are available])],,
                   [#include <winpr/crt.h>])
fi

if test "x${have_freerdp}" = "xyes"
then
    AC_MSG_CHECKING([whether CLIPRDR structs have a common CLIPRDR_HEADER])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[
        #include <freerdp/client/cliprdr.h>
        int main() {
            CLIPRDR_FORMAT_LIST list;
            list.common.msgType = 0;
            (void)list;
            return 0;
        }
        ]])],
        [AC_MSG_RESULT([yes])]
        [AC_DEFINE([HAVE_CLIPRDR_HEADER],,
                   [Defined if CLIPRDR structs have a common CLIPRDR_HEADER])],
        [AC_MSG_RESULT([no])])
fi

if test "x${have_freerdp}" = "xyes"
then
    AC_CHECK_DECLS([FreeRDPReadColor],
                   [AC_DEFINE([USE_UPDATED_RW_COLOR_FUNCS],,
                              [Defined if FreeRDPReadColor() and FreeRDPWriteColor() are available])],,
                   [#include <freerdp/codec/color.h>])
fi

if test "x${have_freerdp}" = "xyes"
then
    AC_CHECK_DECLS([freerdp_settings_set_pointer],
                   [AC_DEFINE([HAVE_SETTERS_GETTERS],,
                              [Defined if freerdp_settings_set_pointer is available])],,
                   [#include <freerdp/settings.h>])
fi

if test "x${have_freerdp}" = "xyes"
then
    AC_MSG_CHECKING([whether freerdp structs have a context])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[
        #include <freerdp/freerdp.h>
        int main() {
            freerdp* instance = freerdp_new();
            /* We cast to void to prevent unused variable warnings */
            (void)instance->context->input;
            (void)instance->context->settings;
            freerdp_free(instance);
            return 0;
        }
    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([FREERDP_HAS_CONTEXT],,
               [FreeRDP structs have a context])],
    [AC_MSG_RESULT([no])])
fi

if test "x${have_freerdp}" = "xyes"
then
    AC_CHECK_DECL([freerdp_shall_disconnect_context],
                  [AC_DEFINE([HAVE_DISCONNECT_CONTEXT],,
                             [Defined if 'freerdp_shall_disconnect_context' is available in FreeRDP])],,
                  [#include <freerdp/freerdp.h>])
fi
if test "x${have_freerdp}" = "xyes"
then
    # Check whether FreeRDP 3.x requires const for GetPluginData
    AC_MSG_CHECKING([whether GetPluginData requires const for the returned args])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[
        #include <freerdp/dvc.h>
        /* A dummy function that matches the expected signature of GetPluginData */
        const ADDIN_ARGV* dummy_GetPluginData(IDRDYNVC_ENTRY_POINTS* pEntryPoints) {
            return NULL;
        }

        int main() {
            /* Create a dummy IDRDYNVC_ENTRY_POINTS struct */
            IDRDYNVC_ENTRY_POINTS entryPoints;

            /* Manually set the GetPluginData pointer for testing */
            entryPoints.GetPluginData = dummy_GetPluginData;
            const ADDIN_ARGV* result = entryPoints.GetPluginData(&entryPoints);

            /* Casting to void to avoid unused variable warning */
            (void)result;

            return 0;
        }
    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([PLUGIN_DATA_CONST],,
               [Defined if GetPluginData returns a pointer to a const ADDIN_ARGV])],
    [AC_MSG_RESULT([no])])
fi

if test "x${have_freerdp}" = "xyes"
then
    # Check whether glyph.New expects a const rdpGlyph* parameter
    AC_MSG_CHECKING([whether glyph.New expects a const rdpGlyph* parameter])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[
        #include <freerdp/graphics.h>
        BOOL mock_glyph_new(rdpContext* context, const rdpGlyph* glyph) {
            return TRUE;
        }

        int main() {
            rdpGlyph* glyph = (rdpGlyph*) malloc(sizeof(rdpGlyph));
            glyph->New = mock_glyph_new;
            free(glyph);
            return 0;
        }
    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([RDP_GLYPH_NEW_REQUIRES_CONST],,
               [Defined if glyph.New expects a const rdpGlyph* parameter])],
    [AC_MSG_RESULT([no])])
fi

if test "x${have_freerdp}" = "xyes"
then
    # Check whether pointer.Set expects a const rdpPointer* parameter
    AC_MSG_CHECKING([whether pointer.Set expects a const rdpPointer* parameter])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[
        #include <freerdp/graphics.h>

        BOOL mock_pointer_set(rdpContext* context, const rdpPointer* pointer) {
            return TRUE;
        }

        int main() {
            rdpPointer* pointer = (rdpPointer*) malloc(sizeof(rdpPointer));
            pointer->Set = mock_pointer_set;
            free(pointer);
            return 0;
        }
    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([RDP_POINTER_SET_REQUIRES_CONST],,
               [Defined if pointer.Set expects a const rdpPointer* parameter])],
    [AC_MSG_RESULT([no])])
fi

if test "x${have_freerdp}" = "xyes"
then
    AC_MSG_CHECKING([whether freerdp instance supports LoadChannels])
    AC_COMPILE_IFELSE([AC_LANG_SOURCE([[
        #include <freerdp/freerdp.h>

        /* Mock LoadChannels function with the expected signature */
        BOOL load_channels(freerdp* instance) {
            return TRUE;
        }

        int main() {
            freerdp* instance = freerdp_new();
            instance->LoadChannels = load_channels;
            freerdp_free(instance);
            return 0;
        }
    ]])],
    [AC_MSG_RESULT([yes])]
    [AC_DEFINE([RDP_INST_HAS_LOAD_CHANNELS],,
               [Defined if freerdp instance supports LoadChannels])],
    [AC_MSG_RESULT([no])])
fi

# Restore CPPFLAGS, removing FreeRDP-specific options needed for testing
CPPFLAGS="$OLDCPPFLAGS"

AC_SUBST(FREERDP_PLUGIN_DIR)
AM_CONDITIONAL([ENABLE_RDP], [test "x${have_freerdp}" = "xyes"])

#
# libssh2
#

have_libssh2=disabled
SSH_LIBS=
AC_ARG_WITH([ssh],
            [AS_HELP_STRING([--with-ssh],
                            [support SSH @<:@default=check@:>@])],
            [],
            [with_ssh=check])

AC_ARG_ENABLE(ssh_agent,
              [AS_HELP_STRING([--enable-ssh-agent],
                              [enable built-in ssh-agent])
              ],enable_ssh_agent=yes)

if test "x$with_ssh" != "xno"
then
    have_libssh2=yes

    AC_CHECK_LIB([ssh2], [libssh2_userauth_publickey_frommemory],
                         [SSH_LIBS="$SSH_LIBS -lssh2"],
                         [have_libssh2=no])
fi

AM_CONDITIONAL([ENABLE_COMMON_SSH], [test "x${have_libssh2}"  = "xyes" \
                                       -a "x${have_ssl}"      = "xyes"])
AM_COND_IF([ENABLE_COMMON_SSH],
           [AC_DEFINE([ENABLE_COMMON_SSH],,
                      [Whether support for the common SSH core is enabled])])

AM_CONDITIONAL([ENABLE_SSH], [test "x${have_libssh2}"  = "xyes" \
                                -a "x${have_terminal}" = "xyes" \
                                -a "x${have_ssl}"      = "xyes"])

AC_SUBST(SSH_LIBS)

#
# Underlying crypto library usage of libssh2
#

if test "x${have_libssh2}" = "xyes"
then

    # Whether libssh2 was built against libgcrypt
    AC_CHECK_LIB([ssh2], [gcry_control],
                         [AC_CHECK_HEADER(gcrypt.h,
                                          [AC_DEFINE([LIBSSH2_USES_GCRYPT],,
                                                     [Whether libssh2 was built against libgcrypt])],
                                          [AC_MSG_WARN([
  --------------------------------------------
   libssh2 appears to be built against libgcrypt, but the libgcrypt headers
   could not be found. SSH will be disabled.
  --------------------------------------------])
                                           have_libssh2=no])])

fi

#
# Agent forwarding support within libssh2
#

have_ssh_agent=no
if test "x${have_libssh2}" = "xyes" -a "x${enable_ssh_agent}" = "xyes"
then

    AC_CHECK_DECL([libssh2_channel_request_auth_agent],
                  [have_ssh_agent=yes], [],
                  [[#include <libssh2.h>]])

    if test "x${have_ssh_agent}" = "xno"
    then
        AC_MSG_ERROR([
      --------------------------------------------
       Agent forwarding support was requested but no such support was found
       in libssh2.
      --------------------------------------------])
    else
        AC_DEFINE([ENABLE_SSH_AGENT],,
                  [Whether agent forwarding support for SSH is enabled])
    fi

fi

AM_CONDITIONAL([ENABLE_SSH_AGENT], [test "x${have_ssh_agent}"   = "xyes" \
                                      -a "x${enable_ssh_agent}" = "xyes"])

#
# libtelnet
#

have_libtelnet=disabled
TELNET_LIBS=
AC_ARG_WITH([telnet],
            [AS_HELP_STRING([--with-telnet],
                            [support Telnet @<:@default=check@:>@])],
            [],
            [with_telnet=check])

if test "x$with_telnet" != "xno"
then
    have_libtelnet=yes
    AC_CHECK_LIB([telnet], [telnet_init],
                           [TELNET_LIBS="$TELNET_LIBS -ltelnet"],
                           [have_libtelnet=no])
fi

AM_CONDITIONAL([ENABLE_TELNET], [test "x${have_libtelnet}"  = "xyes" \
                                   -a "x${have_terminal}" = "xyes"])

AC_SUBST(TELNET_LIBS)

#
# libwebp
#

have_webp=disabled
WEBP_LIBS=
AC_ARG_WITH([webp],
            [AS_HELP_STRING([--with-webp],
                            [support WebP image encoding @<:@default=check@:>@])],
            [],
            [with_webp=check])

if test "x$with_webp" != "xno"
then
    have_webp=yes

    AC_CHECK_HEADER(webp/encode.h,, [have_webp=no])
    AC_CHECK_LIB([webp], [WebPEncode], [WEBP_LIBS="$WEBP_LIBS -lwebp"], [have_webp=no])

    if test "x${have_webp}" = "xno"
    then
        AC_MSG_WARN([
  --------------------------------------------
   Unable to find libwebp.
   Images will not be encoded using WebP.
  --------------------------------------------])
    else
        AC_DEFINE([ENABLE_WEBP],, [Whether WebP support is enabled])
    fi
fi

AM_CONDITIONAL([ENABLE_WEBP], [test "x${have_webp}" = "xyes"])
AC_SUBST(WEBP_LIBS)

#
# libwebsockets
#

have_libwebsockets=disabled
WEBSOCKETS_LIBS=
AC_ARG_WITH([websockets],
            [AS_HELP_STRING([--with-websockets],
                            [support WebSockets @<:@default=check@:>@])],
            [],
            [with_websockets=check])

if test "x$with_websockets" != "xno"
then
    have_libwebsockets=yes
    AC_CHECK_LIB([websockets],
                 [lws_create_context],
                 [WEBSOCKETS_LIBS="$WEBSOCKETS_LIBS -lwebsockets"],
                 [AC_MSG_WARN([
  --------------------------------------------
   Unable to find libwebsockets.
   Support for Kubernetes will be disabled.
  --------------------------------------------])
                 have_libwebsockets=no])
fi

if test "x$with_websockets" != "xno"
then

    # Check for client-specific closed event, which must be used in favor of
    # the generic closed event if libwebsockets is recent enough to provide
    # this
    AC_CHECK_DECL([LWS_CALLBACK_CLIENT_CLOSED],
        [AC_DEFINE([HAVE_LWS_CALLBACK_CLIENT_CLOSED],,
                   [Whether LWS_CALLBACK_CLIENT_CLOSED is defined])],,
        [#include <libwebsockets.h>])

    # Older versions of libwebsockets may not define a flag for requesting
    # global initialization of OpenSSL, instead performing that initialization
    # by default
    AC_CHECK_DECL([LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT],
        [AC_DEFINE([HAVE_LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT],,
                   [Whether LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT is defined])],,
        [#include <libwebsockets.h>])

    # Older versions of libwebsockets do not define special macros for SSL
    # connection flags, instead relying on documented integer values
    AC_CHECK_DECL([LCCSCF_USE_SSL],
        [AC_DEFINE([HAVE_LCCSCF_USE_SSL],,
                   [Whether LCCSCF_USE_SSL is defined])],,
        [#include <libwebsockets.h>])

    # Older versions of libwebsockets do not define a dummy callback which
    # must be invoked after the main event callback is invoked; the main event
    # callback must instead manually return zero
    AC_CHECK_DECL([lws_callback_http_dummy],
        [AC_DEFINE([HAVE_LWS_CALLBACK_HTTP_DUMMY],,
                   [Whether lws_callback_http_dummy() is defined])],,
        [#include <libwebsockets.h>])

fi

AM_CONDITIONAL([ENABLE_WEBSOCKETS],
               [test "x${have_libwebsockets}"  = "xyes"])

AC_SUBST(WEBSOCKETS_LIBS)

#
# Kubernetes
#

AC_ARG_ENABLE([kubernetes],
              [AS_HELP_STRING([--disable-kubernetes],
                              [do not build support for attaching to Kubernetes pods])],
              [],
              [enable_kubernetes=yes])

AM_CONDITIONAL([ENABLE_KUBERNETES], [test "x${enable_kubernetes}"  = "xyes" \
                                       -a "x${have_libwebsockets}" = "xyes" \
                                       -a "x${have_ssl}"           = "xyes" \
                                       -a "x${have_terminal}"      = "xyes"])

#
# guacd
#

AC_ARG_ENABLE([guacd],
              [AS_HELP_STRING([--disable-guacd],
                              [do not build the Guacamole proxy daemon])],
              [],
              [enable_guacd=yes])

AM_CONDITIONAL([ENABLE_GUACD], [test "x${enable_guacd}"  = "xyes"])

#
# guacenc
#

AC_ARG_ENABLE([guacenc],
              [AS_HELP_STRING([--disable-guacenc],
                              [do not build the Guacamole video encoding tool])],
              [],
              [enable_guacenc=yes])

AM_CONDITIONAL([ENABLE_GUACENC], [test "x${enable_guacenc}"   = "xyes" \
                                    -a "x${have_libavcodec}"  = "xyes" \
                                    -a "x${have_libavutil}"   = "xyes" \
                                    -a "x${have_libswscale}"  = "xyes" \
                                    -a "x${have_libavformat}" = "xyes"])

#
# guaclog
#

AC_ARG_ENABLE([guaclog],
              [AS_HELP_STRING([--disable-guaclog],
                              [do not build the Guacamole input logging tool])],
              [],
              [enable_guaclog=yes])

AM_CONDITIONAL([ENABLE_GUACLOG], [test "x${enable_guaclog}"  = "xyes"])

#
# Output Makefiles
#

AC_CONFIG_FILES([Makefile
                 doc/libguac/Doxyfile
                 doc/libguac-terminal/Doxyfile
                 src/common/Makefile
                 src/common/tests/Makefile
                 src/common-ssh/Makefile
                 src/common-ssh/tests/Makefile
                 src/terminal/Makefile
                 src/libguac/Makefile
                 src/libguac/tests/Makefile
                 src/guacd/Makefile
                 src/guacd/man/guacd.8
                 src/guacd/man/guacd.conf.5
                 src/guacenc/Makefile
                 src/guacenc/man/guacenc.1
                 src/guaclog/Makefile
                 src/guaclog/man/guaclog.1
                 src/pulse/Makefile
                 src/protocols/kubernetes/Makefile
                 src/protocols/kubernetes/tests/Makefile
                 src/protocols/rdp/Makefile
                 src/protocols/rdp/tests/Makefile
                 src/protocols/ssh/Makefile
                 src/protocols/telnet/Makefile
                 src/protocols/vnc/Makefile])
AC_OUTPUT

#
# Protocol build status
#

AM_COND_IF([ENABLE_KUBERNETES], [build_kubernetes=yes], [build_kubernetes=no])
AM_COND_IF([ENABLE_RDP],        [build_rdp=yes],        [build_rdp=no])
AM_COND_IF([ENABLE_SSH],        [build_ssh=yes],        [build_ssh=no])
AM_COND_IF([ENABLE_TELNET],     [build_telnet=yes],     [build_telnet=no])
AM_COND_IF([ENABLE_VNC],        [build_vnc=yes],        [build_vnc=no])

#
# Service / tool build status
#

AM_COND_IF([ENABLE_GUACD],   [build_guacd=yes],   [build_guacd=no])
AM_COND_IF([ENABLE_GUACENC], [build_guacenc=yes], [build_guacenc=no])
AM_COND_IF([ENABLE_GUACLOG], [build_guaclog=yes], [build_guaclog=no])

#
# Init scripts
#

AM_COND_IF([ENABLE_INIT], [build_init="${init_dir}"], [build_init=no])

#
# Systemd units
#

AM_COND_IF([ENABLE_SYSTEMD], [build_systemd="${systemd_dir}"], [build_systemd=no])

#
# FreeRDP plugins
#

AM_COND_IF([ENABLE_RDP], [build_rdp_plugins="${FREERDP_PLUGIN_DIR}"], [build_rdp_plugins=no])

#
# Display summary
#

echo "
------------------------------------------------
$PACKAGE_NAME version $PACKAGE_VERSION
------------------------------------------------

   Library status:

     freerdp ............. ${have_freerdp} ${freerdp_version}
     pango ............... ${have_pango}
     libavcodec .......... ${have_libavcodec}
     libavformat ......... ${have_libavformat}
     libavutil ........... ${have_libavutil}
     libssh2 ............. ${have_libssh2}
     libssl .............. ${have_ssl}
     libswscale .......... ${have_libswscale}
     libtelnet ........... ${have_libtelnet}
     libVNCServer ........ ${have_libvncserver}
     libvorbis ........... ${have_vorbis}
     libpulse ............ ${have_pulse}
     libwebsockets ....... ${have_libwebsockets}
     libwebp ............. ${have_webp}
     wsock32 ............. ${have_winsock}

   Protocol support:

      Kubernetes .... ${build_kubernetes}
      RDP ........... ${build_rdp}
      SSH ........... ${build_ssh}
      Telnet ........ ${build_telnet}
      VNC ........... ${build_vnc}

   Services / tools:

      guacd ...... ${build_guacd}
      guacenc .... ${build_guacenc}
      guaclog .... ${build_guaclog}

   FreeRDP plugins: ${build_rdp_plugins}
   Init scripts: ${build_init}
   Systemd units: ${build_systemd}

Type \"make\" to compile $PACKAGE_NAME.
"

if test "x$freerdp_version" = "x(3.x)"
then
    AC_MSG_WARN([
  --------------------------------------------
    Support for FreeRDP 3.x is currently experimental. Some features, like
    RemoteApp, have known issues. If not testing, consider using FreeRDP 2.x.
  --------------------------------------------])
fi
