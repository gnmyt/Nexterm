FROM node:22-alpine AS client-builder

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

FROM node:22-alpine

# This is required as the newest version (1.6.0) breaks compatibility with the Proxmox integration.
# Related issue: https://issues.apache.org/jira/browse/GUACAMOLE-1877
ARG GUACD_COMMIT=daffc29a958e8d07af32def00d2d98d930df317a

RUN apk add --no-cache \
    cairo-dev jpeg-dev libpng-dev ossp-uuid-dev ffmpeg-dev \
    pango-dev libvncserver-dev libwebp-dev openssl-dev freerdp2-dev \
    libpulse libogg libc-dev \
    && apk add --no-cache --virtual .build-deps \
    build-base git autoconf automake libtool \
    && git clone https://github.com/apache/guacamole-server.git \
    && cd guacamole-server \
    && git checkout $GUACD_COMMIT \
    && autoreconf -fi \
    && ./configure --with-init-dir=/etc/init.d \
    && make -j$(nproc) \
    && make install \
    && cd .. \
    && rm -rf guacamole-server \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production

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
