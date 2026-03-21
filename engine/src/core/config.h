#ifndef NEXTERM_CONFIG_H
#define NEXTERM_CONFIG_H

#include <stdbool.h>
#include <stdint.h>

typedef struct nexterm_config {
    char registration_token[256];
    char server_host[256];
    uint16_t server_port;
    bool tls;
} nexterm_config_t;

int nexterm_config_load(nexterm_config_t* cfg);

#endif
