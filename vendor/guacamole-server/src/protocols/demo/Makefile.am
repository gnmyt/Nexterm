AUTOMAKE_OPTIONS = foreign
ACLOCAL_AMFLAGS = -I m4

lib_LTLIBRARIES = libguac-client-demo.la

libguac_client_demo_la_SOURCES = \
    client.c                     \
    demo.c                       \
    hud.c                        \
    input.c                      \
    logo.c                       \
    user.c

noinst_HEADERS = \
    client.h     \
    demo.h       \
    hud.h        \
    input.h      \
    logo.h       \
    logo_png.h   \
    user.h

EXTRA_DIST = logo.png

libguac_client_demo_la_CFLAGS = \
    -Werror -Wall -Iinclude     \
    @LIBGUAC_INCLUDE@

libguac_client_demo_la_LIBADD = \
    @LIBGUAC_LTLIB@

libguac_client_demo_la_LDFLAGS = \
    -version-info 0:0:0          \
    @CAIRO_LIBS@                 \
    @PTHREAD_LIBS@
