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

COPY --from=engine /usr/local/lib/ /usr/local/lib/

COPY --from=engine /usr/local/bin/nexterm-engine /usr/local/bin/nexterm-engine

COPY --from=engine /usr/local/lib/freerdp2/ /usr/lib/freerdp2/

RUN ldconfig /usr/local/lib 2>/dev/null || true

EXPOSE 6989

CMD ["/bin/sh", "docker-start.sh"]
