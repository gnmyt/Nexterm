#ifndef NEXTERM_TRUST_H
#define NEXTERM_TRUST_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <openssl/ssl.h>

#include "session.h"

#define NEXTERM_TRUST_KIND_SSH "ssh"
#define NEXTERM_TRUST_KIND_TLS "tls"

typedef struct {
    bool accept_any;
    bool allow_ca;
    const char* pins;
} nexterm_trust_t;

typedef struct nexterm_peer {
    char kind[8];
    char host[256];
    uint16_t port;
    char algorithm[64];
    char fingerprint[128];
    char subject[256];
    char issuer[256];
    char* raw;
} nexterm_peer_t;

typedef struct {
    const nexterm_trust_t* trust;
    const char* host;
    uint16_t port;
} nexterm_tls_trust_t;

void nexterm_trust_from_session(const nexterm_session_t* session, nexterm_trust_t* out);

void nexterm_trust_from_values(const char* mode, const char* pins, bool allow_ca,
                               nexterm_trust_t* out);

bool nexterm_trust_is_pinned(const nexterm_trust_t* trust, const char* kind,
                             const char* host, uint16_t port, const char* fingerprint);

bool nexterm_trust_pinned_algorithm(const nexterm_trust_t* trust, const char* kind,
                                    const char* host, uint16_t port,
                                    char* out, size_t out_sz);

void nexterm_trust_reject(const char* kind, const char* host, uint16_t port,
                          const char* algorithm, const char* fingerprint,
                          const unsigned char* raw, size_t raw_len);

nexterm_peer_t* nexterm_trust_take_rejected(void);

void nexterm_peer_free(nexterm_peer_t* peer);

void nexterm_trust_install_tls(SSL_CTX* ctx, nexterm_tls_trust_t* tls);

void nexterm_trust_apply_curl(void* curl, nexterm_tls_trust_t* tls);

#endif
