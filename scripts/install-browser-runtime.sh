#!/bin/sh
set -eux

apk add --no-cache \
    tigervnc webkit2gtk-6.0 gtk4.0 \
    font-dejavu xkeyboard-config libxkbcommon

rm -rf /usr/lib/gallium-pipe /usr/lib/libLLVM.so* /usr/lib/libgallium-*.so

rm -f /usr/bin/vncserver /usr/bin/vncpasswd /usr/bin/vncconfig /usr/bin/x0vncserver
rm -rf /usr/lib/perl5 /usr/share/perl5

rm -rf /usr/lib/girepository-1.0 /usr/share/gir-1.0

rm -rf /usr/lib/gstreamer-1.0 /usr/lib/libgtk-3.so*

rm -rf /usr/lib/pkgconfig /usr/share/pkgconfig /usr/share/man /usr/share/doc \
       /usr/share/aclocal /usr/share/gtk-doc

find /usr/share/fonts/dejavu -type f \
    ! -name "DejaVuSans.ttf" ! -name "DejaVuSans-Bold.ttf" \
    ! -name "DejaVuSansMono.ttf" ! -name "DejaVuSansMono-Bold.ttf" \
    ! -name "DejaVuSerif.ttf" -delete
