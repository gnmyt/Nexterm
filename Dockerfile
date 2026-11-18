ARG SERVER_IMAGE=nexterm/server:latest
ARG ENGINE_IMAGE=nexterm/engine:latest

FROM ${ENGINE_IMAGE} AS engine
FROM ${SERVER_IMAGE}

RUN apk add --no-cache \
    cairo jpeg libpng ossp-uuid \
    pango libwebp openssl \
    libpulse libvorbis libogg libssh2 \
    libvncserver freerdp-libs libcurl \
    util-linux samba-client

COPY scripts/install-browser-runtime.sh /tmp/install-browser-runtime.sh
RUN sh /tmp/install-browser-runtime.sh && rm -f /tmp/install-browser-runtime.sh

COPY --from=engine /usr/lib/dri/ /usr/lib/dri/
COPY --from=engine /usr/lib/gbm/ /usr/lib/gbm/
COPY --from=engine /usr/lib/libEGL.so* /usr/lib/libGL.so* /usr/lib/libGLESv2.so* \
     /usr/lib/libgbm.so* /usr/lib/libgallium-*.so /usr/lib/

COPY --from=engine /usr/lib/libvncclient.so.1 /usr/lib/

COPY --from=engine /usr/local/lib/ /usr/local/lib/

COPY --from=engine /usr/local/bin/nexterm-engine /usr/local/bin/nexterm-engine

COPY --from=engine /usr/local/bin/nexterm-webview /usr/local/bin/nexterm-webview

COPY --from=engine /usr/local/lib/freerdp3/ /usr/lib/freerdp3/

RUN ldconfig /usr/lib /usr/local/lib 2>/dev/null || true

EXPOSE 6989

CMD ["/bin/sh", "docker-start.sh"]
