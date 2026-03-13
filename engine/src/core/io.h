#ifndef NEXTERM_IO_H
#define NEXTERM_IO_H

#include <pthread.h>
#include <stdint.h>

#define FRAME_HEADER_SIZE 4

int nexterm_read_exact(int fd, uint8_t* buf, size_t len);
int nexterm_write_exact(int fd, const uint8_t* buf, size_t len);

int nexterm_tcp_connect(const char* host, uint16_t port);

int nexterm_send_frame(int fd, const uint8_t* data, size_t len,
                       pthread_mutex_t* mutex);

uint8_t* nexterm_read_frame(int fd, uint32_t max_size, uint32_t* out_len);

#endif
