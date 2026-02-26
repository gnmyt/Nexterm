#ifndef NEXTERM_SSH_COMMON_H
#define NEXTERM_SSH_COMMON_H

#include <libssh2.h>
#include <stdint.h>

#define MAX_JUMP_HOSTS 8

typedef struct {
    char host[256];
    uint16_t port;
    char username[128];
    char* password;
    char* private_key;
    char* passphrase;
} jump_host_t;

typedef struct {
    LIBSSH2_SESSION* sessions[MAX_JUMP_HOSTS];
    LIBSSH2_CHANNEL* channels[MAX_JUMP_HOSTS];
    int sockets[MAX_JUMP_HOSTS];        /* real TCP socket (index 0) + proxy sockets */
    int count;
} jump_chain_t;

int nexterm_ssh_setup(const char* host, uint16_t port,
                      int* out_sock, LIBSSH2_SESSION** out_session);

int nexterm_ssh_setup_with_jumphosts(const char* target_host, uint16_t target_port,
                                     const jump_host_t* jump_hosts, int jump_count,
                                     int* out_sock, LIBSSH2_SESSION** out_session,
                                     jump_chain_t* chain);

int nexterm_ssh_auth(LIBSSH2_SESSION* session, const char* username,
                     const char* password, const char* private_key,
                     const char* passphrase);

void nexterm_ssh_teardown(LIBSSH2_SESSION* session, LIBSSH2_CHANNEL* channel,
                          int sock, const char* reason);

void nexterm_jump_chain_teardown(jump_chain_t* chain);

void nexterm_ssh_full_cleanup(LIBSSH2_SESSION* session, LIBSSH2_CHANNEL* channel,
                             int sock, jump_chain_t* chain, const char* reason);

void nexterm_ssh_read_stream(LIBSSH2_CHANNEL* channel, char* buf,
                             size_t buf_sz, int use_stderr);

#endif
