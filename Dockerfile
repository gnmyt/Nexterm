FROM node:18 AS client-builder

WORKDIR /app/client

COPY client/package.json ./
RUN npm install

COPY client/ .
RUN npm run build

FROM node:18

RUN apt-get update && \
    apt-get install -y \
    libcairo2-dev libjpeg62-turbo-dev libpng-dev libossp-uuid-dev \
    libavcodec-dev libavutil-dev libswscale-dev \
    libpango1.0-dev libpulse-dev libssh2-1-dev libtelnet-dev \
    libvncserver-dev libwebp-dev libwebsockets-dev libssl-dev \
    libvorbis-dev libwebp-dev \
    freerdp2-dev libfreerdp-client2-2 libfreerdp2-2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y build-essential autoconf libtool && \
    git clone https://github.com/apache/guacamole-server.git && \
    cd guacamole-server && \
    autoreconf -fi && \
    ./configure --with-init-dir=/etc/init.d --enable-rdp && \
    make && \
    make install && \
    ldconfig && \
    cd .. && \
    rm -rf guacamole-server

ENV NODE_ENV=production

WORKDIR /app

COPY --from=client-builder /app/client/dist ./dist

COPY package.json ./
RUN npm install

COPY server/ server/
COPY docker-start.sh .

RUN chmod +x docker-start.sh

EXPOSE 6989

CMD ["./docker-start.sh"]