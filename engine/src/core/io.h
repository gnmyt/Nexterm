#ifndef NEXTERM_IO_H
#define NEXTERM_IO_H

#include <pthread.h>
#include <stdint.h>
#include <openssl/ssl.h>

#define FRAME_HEADER_SIZE 4

int nexterm_read_exact(int fd, uint8_t* buf, size_t len);
int nexterm_write_exact(int fd, const uint8_t* buf, size_t len);

int nexterm_tcp_connect(const char* host, uint16_t port);

SSL_CTX* nexterm_tls_client_ctx_create(void);
SSL* nexterm_tls_handshake(SSL_CTX* ctx, int fd);
void nexterm_tls_cleanup(SSL* ssl);

int nexterm_read_exact_s(int fd, SSL* ssl, uint8_t* buf, size_t len);
int nexterm_write_exact_s(int fd, SSL* ssl, const uint8_t* buf, size_t len);
int nexterm_send_frame_s(int fd, SSL* ssl, const uint8_t* data, size_t len,
                         pthread_mutex_t* mutex);
uint8_t* nexterm_read_frame_s(int fd, SSL* ssl, uint32_t max_size, uint32_t* out_len);

#define nexterm_send_frame(fd, data, len, mutex) nexterm_send_frame_s(fd, NULL, data, len, mutex)
#define nexterm_read_frame(fd, max_size, out_len) nexterm_read_frame_s(fd, NULL, max_size, out_len)

int nexterm_tls_proxy_start(SSL* ssl, int tls_fd);

#endif
