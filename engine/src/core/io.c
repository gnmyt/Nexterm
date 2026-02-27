#include "io.h"
#include "log.h"

#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

int nexterm_read_exact(int fd, uint8_t* buf, size_t len) {
    size_t total = 0;
    while (total < len) {
        ssize_t n = read(fd, buf + total, len - total);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int nexterm_write_exact(int fd, const uint8_t* buf, size_t len) {
    size_t total = 0;
    while (total < len) {
        ssize_t n = write(fd, buf + total, len - total);
        if (n <= 0) return -1;
        total += (size_t)n;
    }
    return 0;
}

int nexterm_tcp_connect(const char* host, uint16_t port) {
    struct addrinfo hints = { .ai_family = AF_UNSPEC, .ai_socktype = SOCK_STREAM };

    char port_str[8];
    snprintf(port_str, sizeof(port_str), "%u", port);

    struct addrinfo* result;
    int ret = getaddrinfo(host, port_str, &hints, &result);
    if (ret != 0) {
        LOG_ERROR("getaddrinfo(%s:%s): %s", host, port_str, gai_strerror(ret));
        return -1;
    }

    int fd = -1;
    for (struct addrinfo* rp = result; rp; rp = rp->ai_next) {
        fd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
        if (fd < 0) continue;
        if (connect(fd, rp->ai_addr, rp->ai_addrlen) == 0) break;
        close(fd);
        fd = -1;
    }
    freeaddrinfo(result);

    if (fd < 0) {
        LOG_ERROR("Failed to connect to %s:%u", host, port);
        return -1;
    }

    int enable = 1;
    (void)setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &enable, sizeof(enable));
    (void)setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &enable, sizeof(enable));

    return fd;
}

int nexterm_send_frame(int fd, const uint8_t* data, size_t len,
                       pthread_mutex_t* mutex) {
    uint32_t header = htonl((uint32_t)len);

    if (mutex) pthread_mutex_lock(mutex);
    int ret = nexterm_write_exact(fd, (uint8_t*)&header, FRAME_HEADER_SIZE);
    if (ret == 0)
        ret = nexterm_write_exact(fd, data, len);
    if (mutex) pthread_mutex_unlock(mutex);

    return ret;
}

uint8_t* nexterm_read_frame(int fd, uint32_t max_size, uint32_t* out_len) {
    uint8_t header[FRAME_HEADER_SIZE];
    if (nexterm_read_exact(fd, header, FRAME_HEADER_SIZE) != 0)
        return NULL;

    uint32_t net_len;
    memcpy(&net_len, header, sizeof(net_len));
    uint32_t payload_len = ntohl(net_len);

    if (payload_len == 0 || payload_len > max_size) {
        LOG_ERROR("Invalid frame length: %u", payload_len);
        return NULL;
    }

    uint8_t* buf = malloc(payload_len);
    if (!buf) {
        LOG_ERROR("Failed to allocate %u bytes for frame", payload_len);
        return NULL;
    }

    if (nexterm_read_exact(fd, buf, payload_len) != 0) {
        free(buf);
        return NULL;
    }

    *out_len = payload_len;
    return buf;
}
