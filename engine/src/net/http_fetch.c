#include "http_fetch.h"
#include "control_plane.h"
#include "io.h"
#include "log.h"

#include <curl/curl.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#include "control_plane_builder.h"

typedef struct {
    char* data;
    size_t size;
} response_buffer_t;

typedef struct {
    char** names;
    char** values;
    size_t count;
    size_t capacity;
} response_headers_t;

static size_t write_callback(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t total = size * nmemb;
    response_buffer_t* buf = (response_buffer_t*)userp;

    char* ptr = realloc(buf->data, buf->size + total + 1);
    if (!ptr) return 0;

    buf->data = ptr;
    memcpy(buf->data + buf->size, contents, total);
    buf->size += total;
    buf->data[buf->size] = '\0';

    return total;
}

static size_t header_callback(char* buffer, size_t size, size_t nitems, void* userp) {
    size_t total = size * nitems;
    response_headers_t* hdrs = (response_headers_t*)userp;

    char* colon = memchr(buffer, ':', total);
    if (!colon) return total;

    size_t name_len = (size_t)(colon - buffer);
    char* value_start = colon + 1;
    size_t remaining = total - name_len - 1;

    while (remaining > 0 && *value_start == ' ') {
        value_start++;
        remaining--;
    }
    while (remaining > 0 && (value_start[remaining - 1] == '\r' || value_start[remaining - 1] == '\n'))
        remaining--;

    if (hdrs->count >= hdrs->capacity) {
        size_t new_cap = hdrs->capacity == 0 ? 16 : hdrs->capacity * 2;
        char** new_names = realloc(hdrs->names, new_cap * sizeof(char*));
        char** new_values = realloc(hdrs->values, new_cap * sizeof(char*));
        if (!new_names || !new_values) return total;
        hdrs->names = new_names;
        hdrs->values = new_values;
        hdrs->capacity = new_cap;
    }

    hdrs->names[hdrs->count] = strndup(buffer, name_len);
    hdrs->values[hdrs->count] = strndup(value_start, remaining);
    hdrs->count++;

    return total;
}

typedef struct {
    nexterm_control_plane_t* cp;
    char* request_id;
    char* method;
    char* url;
    char** header_names;
    char** header_values;
    size_t header_count;
    char* body;
    uint32_t timeout_ms;
    bool insecure;
} http_fetch_ctx_t;

static void free_http_fetch_ctx(http_fetch_ctx_t* ctx) {
    free(ctx->request_id);
    free(ctx->method);
    free(ctx->url);
    for (size_t i = 0; i < ctx->header_count; i++) {
        free(ctx->header_names[i]);
        free(ctx->header_values[i]);
    }
    free(ctx->header_names);
    free(ctx->header_values);
    free(ctx->body);
    free(ctx);
}

static int send_http_fetch_result(nexterm_control_plane_t* cp,
                                   const char* request_id,
                                   bool success,
                                   int32_t status_code,
                                   const char** resp_header_names,
                                   const char** resp_header_values,
                                   size_t resp_header_count,
                                   const char* body,
                                   const char* error_message) {
    flatcc_builder_t builder;
    flatcc_builder_init(&builder);

    Nexterm_ControlPlane_Envelope_start_as_root(&builder);
    Nexterm_ControlPlane_Envelope_msg_type_add(&builder, Nexterm_ControlPlane_MessageType_HttpFetchResult);
    Nexterm_ControlPlane_Envelope_http_fetch_result_start(&builder);
    Nexterm_ControlPlane_HttpFetchResult_request_id_create_str(&builder, request_id);
    Nexterm_ControlPlane_HttpFetchResult_success_add(&builder, success);
    Nexterm_ControlPlane_HttpFetchResult_status_code_add(&builder, status_code);

    if (resp_header_count > 0) {
        Nexterm_ControlPlane_HttpFetchResult_headers_start(&builder);
        for (size_t i = 0; i < resp_header_count; i++) {
            Nexterm_ControlPlane_HttpHeader_start(&builder);
            Nexterm_ControlPlane_HttpHeader_name_create_str(&builder, resp_header_names[i]);
            Nexterm_ControlPlane_HttpHeader_value_create_str(&builder, resp_header_values[i]);
            Nexterm_ControlPlane_HttpHeader_end(&builder);
        }
        Nexterm_ControlPlane_HttpFetchResult_headers_end(&builder);
    }

    if (body)
        Nexterm_ControlPlane_HttpFetchResult_body_create_str(&builder, body);
    if (error_message)
        Nexterm_ControlPlane_HttpFetchResult_error_message_create_str(&builder, error_message);

    Nexterm_ControlPlane_Envelope_http_fetch_result_end(&builder);
    Nexterm_ControlPlane_Envelope_end_as_root(&builder);

    size_t size;
    uint8_t* buf = (uint8_t*)flatcc_builder_finalize_buffer(&builder, &size);
    int ret = nexterm_send_frame_s(cp->sock_fd, cp->ssl, buf, size, &cp->send_mutex);
    flatcc_builder_clear(&builder);
    free(buf);
    return ret;
}

static void* http_fetch_thread(void* arg) {
    http_fetch_ctx_t* ctx = (http_fetch_ctx_t*)arg;

    CURL* curl = curl_easy_init();
    if (!curl) {
        send_http_fetch_result(ctx->cp, ctx->request_id, false, 0,
                               NULL, NULL, 0, NULL, "Failed to initialize curl");
        free_http_fetch_ctx(ctx);
        return NULL;
    }

    response_buffer_t resp_body = { .data = NULL, .size = 0 };
    response_headers_t resp_headers = { .names = NULL, .values = NULL, .count = 0, .capacity = 0 };

    curl_easy_setopt(curl, CURLOPT_URL, ctx->url);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp_body);
    curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, header_callback);
    curl_easy_setopt(curl, CURLOPT_HEADERDATA, &resp_headers);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_MAXREDIRS, 5L);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    if (ctx->timeout_ms > 0)
        curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, (long)ctx->timeout_ms);
    else
        curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, 30000L);

    if (ctx->insecure) {
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
    }

    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, ctx->method);

    struct curl_slist* headers = NULL;
    for (size_t i = 0; i < ctx->header_count; i++) {
        char header_line[4096];
        snprintf(header_line, sizeof(header_line), "%s: %s",
                 ctx->header_names[i], ctx->header_values[i]);
        headers = curl_slist_append(headers, header_line);
    }
    if (headers)
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    if (ctx->body && ctx->body[0] != '\0') {
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, ctx->body);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)strlen(ctx->body));
    }

    CURLcode res = curl_easy_perform(curl);

    if (res != CURLE_OK) {
        send_http_fetch_result(ctx->cp, ctx->request_id, false, 0,
                               NULL, NULL, 0, NULL, curl_easy_strerror(res));
    } else {
        long http_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);

        send_http_fetch_result(ctx->cp, ctx->request_id, true, (int32_t)http_code,
                               (const char**)resp_headers.names,
                               (const char**)resp_headers.values,
                               resp_headers.count,
                               resp_body.data ? resp_body.data : "",
                               NULL);
    }

    if (headers) curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    free(resp_body.data);
    for (size_t i = 0; i < resp_headers.count; i++) {
        free(resp_headers.names[i]);
        free(resp_headers.values[i]);
    }
    free(resp_headers.names);
    free(resp_headers.values);
    free_http_fetch_ctx(ctx);
    return NULL;
}

void nexterm_http_fetch(nexterm_control_plane_t* cp,
                        const char* request_id,
                        const char* method,
                        const char* url,
                        const char** header_names,
                        const char** header_values,
                        size_t header_count,
                        const char* body,
                        uint32_t timeout_ms,
                        bool insecure) {

    http_fetch_ctx_t* ctx = calloc(1, sizeof(http_fetch_ctx_t));
    if (!ctx) {
        send_http_fetch_result(cp, request_id, false, 0,
                               NULL, NULL, 0, NULL, "Out of memory");
        return;
    }

    ctx->cp = cp;
    ctx->request_id = strdup(request_id);
    ctx->method = strdup(method);
    ctx->url = strdup(url);
    ctx->timeout_ms = timeout_ms;
    ctx->insecure = insecure;
    ctx->body = body ? strdup(body) : NULL;

    if (header_count > 0) {
        ctx->header_names = calloc(header_count, sizeof(char*));
        ctx->header_values = calloc(header_count, sizeof(char*));
        ctx->header_count = header_count;
        for (size_t i = 0; i < header_count; i++) {
            ctx->header_names[i] = strdup(header_names[i]);
            ctx->header_values[i] = strdup(header_values[i]);
        }
    }

    pthread_t thread;
    if (pthread_create(&thread, NULL, http_fetch_thread, ctx) != 0) {
        send_http_fetch_result(cp, request_id, false, 0,
                               NULL, NULL, 0, NULL, "Failed to create thread");
        free_http_fetch_ctx(ctx);
        return;
    }
    pthread_detach(thread);

    LOG_DEBUG("HttpFetch: req=%s %s %s (insecure=%d)", request_id, method, url, insecure);
}
