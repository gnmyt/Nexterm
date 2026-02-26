#ifndef NEXTERM_SSH_COMMON_H
#define NEXTERM_SSH_COMMON_H

#include <libssh2.h>
#include <stdint.h>

int nexterm_ssh_setup(const char* host, uint16_t port,
                      int* out_sock, LIBSSH2_SESSION** out_session);

int nexterm_ssh_auth(LIBSSH2_SESSION* session, const char* username,
                     const char* password, const char* private_key,
                     const char* passphrase);

void nexterm_ssh_teardown(LIBSSH2_SESSION* session, LIBSSH2_CHANNEL* channel,
                          int sock, const char* reason);

void nexterm_ssh_read_stream(LIBSSH2_CHANNEL* channel, char* buf,
                             size_t buf_sz, int use_stderr);

#endif
