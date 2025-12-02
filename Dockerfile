FROM node:22-alpine AS client-builder

WORKDIR /app

COPY vendor/guacamole-client/guacamole-common-js/ ./vendor/guacamole-client/guacamole-common-js/

WORKDIR /app/client

COPY client/package.json client/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 100000

COPY client/ .
RUN yarn build

FROM node:22-alpine AS server-builder

WORKDIR /app

RUN apk add --no-cache \
    python3 py3-pip py3-setuptools \
    make g++ gcc build-base

COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile --network-timeout 100000

COPY server/ server/

FROM node:22-alpine AS guacd-builder

RUN apk add --no-cache \
    cairo-dev jpeg-dev libpng-dev ossp-uuid-dev ffmpeg-dev \
    pango-dev libvncserver-dev libwebp-dev openssl-dev freerdp2-dev \
    libpulse libogg libc-dev libssh2-dev \
    build-base autoconf automake libtool

WORKDIR /build

COPY vendor/guacamole-server/ ./guacamole-server/

RUN cd guacamole-server \
    && autoreconf -fi \
    && ./configure --with-init-dir=/etc/init.d --prefix=/usr/local \
    && make -j$(nproc) \
    && make DESTDIR=/install install

FROM node:22-alpine

RUN apk add --no-cache \
    cairo jpeg libpng ossp-uuid ffmpeg-libs \
    pango libvncserver libwebp openssl freerdp2 \
    libpulse libogg libssh2 util-linux

COPY --from=guacd-builder /install/usr/local/ /usr/local/

RUN ldconfig /usr/local/lib 2>/dev/null || true

ENV NODE_ENV=production
ENV LOG_LEVEL=system

WORKDIR /app

COPY --from=client-builder /app/client/dist ./dist

COPY --from=server-builder /app/server ./server
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package.json ./
COPY --from=server-builder /app/yarn.lock ./

COPY docker-start.sh .

RUN chmod +x docker-start.sh

EXPOSE 6989

CMD ["/bin/sh", "docker-start.sh"]
