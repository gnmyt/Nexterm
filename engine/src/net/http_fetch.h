#ifndef NEXTERM_HTTP_FETCH_H
#define NEXTERM_HTTP_FETCH_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

struct nexterm_control_plane;

void nexterm_http_fetch(struct nexterm_control_plane* cp,
                        const char* request_id,
                        const char* method,
                        const char* url,
                        const char** header_names,
                        const char** header_values,
                        size_t header_count,
                        const char* body,
                        uint32_t timeout_ms,
                        bool insecure);

#endif
