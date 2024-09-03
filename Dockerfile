FROM node:18-alpine AS client-builder

WORKDIR /app/client

COPY client/package.json ./
RUN npm install

COPY client/ .
RUN npm run build

FROM node:18-alpine

RUN apk add --no-cache \
    cairo-dev jpeg-dev libpng-dev ossp-uuid-dev ffmpeg-dev \
    pango-dev libvncserver-dev libwebp-dev openssl-dev freerdp-dev freerdp \
    autoconf automake libtool libpulse libogg libc-dev \
    && apk add --no-cache --virtual .build-deps build-base git

RUN git clone --depth=1 https://github.com/apache/guacamole-server.git \
    && cd guacamole-server \
    && autoreconf -fi \
    && ./configure --with-init-dir=/etc/init.d --enable-rdp \
    && make \
    && make install \
    && cd .. \
    && rm -rf guacamole-server

RUN apk del .build-deps \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production

WORKDIR /app

COPY --from=client-builder /app/client/dist ./dist

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server/ server/
COPY docker-start.sh .

RUN chmod +x docker-start.sh

EXPOSE 6989

CMD ["/bin/sh", "docker-start.sh"]