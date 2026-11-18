#include "trust.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

#include <curl/curl.h>
#include <openssl/evp.h>
#include <openssl/sha.h>
#include <openssl/x509.h>
#include <openssl/x509v3.h>

#include "log.h"

static _Thread_local nexterm_peer_t* t_rejected = NULL;

void nexterm_trust_from_values(const char* mode, const char* pins, bool allow_ca,
                               nexterm_trust_t* out) {
    out->accept_any = mode && strcmp(mode, "any") == 0;
    out->allow_ca = allow_ca;
    out->pins = (pins && pins[0] != '\0') ? pins : NULL;
}

void nexterm_trust_from_session(const nexterm_session_t* session, nexterm_trust_t* out) {
    const char* ca = nexterm_session_get_param(session, "trust_ca");
    nexterm_trust_from_values(nexterm_session_get_param(session, "trust_mode"),
                              nexterm_session_get_param(session, "trust_pins"),
                              ca && strcmp(ca, "true") == 0, out);
}

typedef bool (*pin_visitor_t)(const char* algorithm, const char* fingerprint, void* arg);

static void visit_pins(const nexterm_trust_t* trust, const char* kind,
                       const char* host, uint16_t port, pin_visitor_t visit, void* arg) {
    if (!trust || !trust->pins || !kind || !host) return;

    const char* line = trust->pins;
    while (*line) {
        const char* end = strchr(line, '\n');
        size_t len = end ? (size_t)(end - line) : strlen(line);

        char buf[512];
        if (len > 0 && len < sizeof(buf)) {
            memcpy(buf, line, len);
            buf[len] = '\0';

            char p_kind[8], p_host[256], p_algorithm[64], p_fingerprint[128];
            unsigned int p_port = 0;
            if (sscanf(buf, "%7s %255s %u %63s %127s",
                       p_kind, p_host, &p_port, p_algorithm, p_fingerprint) == 5
                    && strcmp(p_kind, kind) == 0
                    && strcasecmp(p_host, host) == 0
                    && p_port == port
                    && visit(p_algorithm, p_fingerprint, arg))
                return;
        }

        if (!end) break;
        line = end + 1;
    }
}

static bool match_fingerprint(const char* algorithm, const char* fingerprint, void* arg) {
    (void)algorithm;
    const char** wanted = arg;
    if (strcmp(fingerprint, *wanted) != 0) return false;
    *wanted = NULL;
    return true;
}

bool nexterm_trust_is_pinned(const nexterm_trust_t* trust, const char* kind,
                             const char* host, uint16_t port, const char* fingerprint) {
    if (!fingerprint) return false;
    const char* wanted = fingerprint;
    visit_pins(trust, kind, host, port, match_fingerprint, &wanted);
    return wanted == NULL;
}

typedef struct {
    char* out;
    size_t out_sz;
    bool found;
} first_algorithm_t;

static bool take_algorithm(const char* algorithm, const char* fingerprint, void* arg) {
    (void)fingerprint;
    first_algorithm_t* first = arg;
    snprintf(first->out, first->out_sz, "%s", algorithm);
    first->found = true;
    return true;
}

bool nexterm_trust_pinned_algorithm(const nexterm_trust_t* trust, const char* kind,
                                    const char* host, uint16_t port,
                                    char* out, size_t out_sz) {
    first_algorithm_t first = { .out = out, .out_sz = out_sz, .found = false };
    visit_pins(trust, kind, host, port, take_algorithm, &first);
    return first.found;
}

void nexterm_peer_free(nexterm_peer_t* peer) {
    if (!peer) return;
    free(peer->raw);
    free(peer);
}

void nexterm_trust_reject(const char* kind, const char* host, uint16_t port,
                          const char* algorithm, const char* fingerprint,
                          const unsigned char* raw, size_t raw_len) {
    nexterm_peer_free(t_rejected);
    t_rejected = calloc(1, sizeof(nexterm_peer_t));
    if (!t_rejected) return;

    snprintf(t_rejected->kind, sizeof(t_rejected->kind), "%s", kind);
    snprintf(t_rejected->host, sizeof(t_rejected->host), "%s", host ? host : "");
    t_rejected->port = port;
    snprintf(t_rejected->algorithm, sizeof(t_rejected->algorithm), "%s", algorithm ? algorithm : "");
    snprintf(t_rejected->fingerprint, sizeof(t_rejected->fingerprint), "%s", fingerprint);

    if (raw && raw_len > 0) {
        t_rejected->raw = malloc(4 * ((raw_len + 2) / 3) + 1);
        if (t_rejected->raw)
            EVP_EncodeBlock((unsigned char*)t_rejected->raw, raw, (int)raw_len);
    }

    LOG_WARN("Untrusted %s peer %s:%u (%s)", kind, t_rejected->host, port, fingerprint);
}

nexterm_peer_t* nexterm_trust_take_rejected(void) {
    nexterm_peer_t* peer = t_rejected;
    t_rejected = NULL;
    return peer;
}

static void format_tls_fingerprint(const unsigned char* der, size_t der_len,
                                   char* out, size_t out_sz) {
    unsigned char digest[SHA256_DIGEST_LENGTH];
    SHA256(der, der_len, digest);

    size_t pos = 0;
    for (size_t i = 0; i < sizeof(digest) && pos + 4 <= out_sz; i++)
        pos += (size_t)snprintf(out + pos, out_sz - pos, i == 0 ? "%02X" : ":%02X", digest[i]);
}

static const char* tls_algorithm(X509* cert) {
    EVP_PKEY* key = cert ? X509_get0_pubkey(cert) : NULL;
    if (!key) return "unknown";
    switch (EVP_PKEY_base_id(key)) {
        case EVP_PKEY_RSA: return "RSA";
        case EVP_PKEY_EC: return "ECDSA";
        case EVP_PKEY_ED25519: return "Ed25519";
        case EVP_PKEY_ED448: return "Ed448";
        default: return "unknown";
    }
}

static bool host_matches_cert(X509* cert, const char* host) {
    if (X509_check_ip_asc(cert, host, 0) == 1) return true;
    return X509_check_host(cert, host, 0, 0, NULL) == 1;
}

static bool check_tls_peer(const nexterm_trust_t* trust, const char* host, uint16_t port,
                           X509* cert, const unsigned char* der, size_t der_len,
                           bool ca_valid) {
    if (trust && trust->accept_any) return true;

    char fingerprint[128];
    format_tls_fingerprint(der, der_len, fingerprint, sizeof(fingerprint));

    if (nexterm_trust_is_pinned(trust, NEXTERM_TRUST_KIND_TLS, host, port, fingerprint))
        return true;

    if (trust && trust->allow_ca && ca_valid && cert && host_matches_cert(cert, host))
        return true;

    nexterm_trust_reject(NEXTERM_TRUST_KIND_TLS, host, port, tls_algorithm(cert),
                         fingerprint, der, der_len);
    return false;
}

static int tls_verify_cb(X509_STORE_CTX* store_ctx, void* arg) {
    const nexterm_tls_trust_t* tls = arg;
    X509* cert = X509_STORE_CTX_get0_cert(store_ctx);
    if (!cert) return 0;

    unsigned char* der = NULL;
    int der_len = i2d_X509(cert, &der);
    if (der_len <= 0) return 0;

    bool want_ca = tls->trust && tls->trust->allow_ca && !tls->trust->accept_any;
    bool ca_valid = want_ca && X509_verify_cert(store_ctx) == 1;

    bool trusted = check_tls_peer(tls->trust, tls->host, tls->port, cert,
                                  der, (size_t)der_len, ca_valid);
    OPENSSL_free(der);

    if (trusted) {
        X509_STORE_CTX_set_error(store_ctx, X509_V_OK);
        return 1;
    }
    X509_STORE_CTX_set_error(store_ctx, X509_V_ERR_CERT_UNTRUSTED);
    return 0;
}

void nexterm_trust_install_tls(SSL_CTX* ctx, nexterm_tls_trust_t* tls) {
    SSL_CTX_set_default_verify_paths(ctx);
    SSL_CTX_set_verify(ctx, SSL_VERIFY_PEER, NULL);
    SSL_CTX_set_cert_verify_callback(ctx, tls_verify_cb, tls);
}

static CURLcode curl_ssl_ctx_cb(CURL* curl, void* ssl_ctx, void* arg) {
    (void)curl;
    nexterm_trust_install_tls((SSL_CTX*)ssl_ctx, arg);
    return CURLE_OK;
}

void nexterm_trust_apply_curl(void* curl, nexterm_tls_trust_t* tls) {
    curl_easy_setopt((CURL*)curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt((CURL*)curl, CURLOPT_SSL_VERIFYHOST, 0L);
    curl_easy_setopt((CURL*)curl, CURLOPT_SSL_CTX_FUNCTION, curl_ssl_ctx_cb);
    curl_easy_setopt((CURL*)curl, CURLOPT_SSL_CTX_DATA, tls);
}
