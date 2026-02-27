#include "config.h"
#include "log.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CONFIG_FILE "config.yaml"
#define MAX_LINE 512

static void trim(char* str) {
    size_t len = strlen(str);
    while (len > 0 && (str[len - 1] == '\n' || str[len - 1] == '\r' ||
                       str[len - 1] == ' '  || str[len - 1] == '\t')) {
        str[--len] = '\0';
    }
}

static void strip_quotes(char* str) {
    size_t len = strlen(str);
    if (len >= 2 && ((str[0] == '"' && str[len - 1] == '"') ||
                     (str[0] == '\'' && str[len - 1] == '\''))) {
        memmove(str, str + 1, len - 2);
        str[len - 2] = '\0';
    }
}

static int parse_config_file(nexterm_config_t* cfg) {
    FILE* f = fopen(CONFIG_FILE, "r");
    if (!f) return -1;

    char line[MAX_LINE];
    while (fgets(line, sizeof(line), f)) {
        trim(line);
        if (line[0] == '\0' || line[0] == '#') continue;

        char* colon = strchr(line, ':');
        if (!colon) continue;

        *colon = '\0';
        char* key = line;
        char* value = colon + 1;

        while (*value == ' ' || *value == '\t') value++;
        trim(key);
        strip_quotes(value);

        if (strcmp(key, "registration_token") == 0) {
            snprintf(cfg->registration_token, sizeof(cfg->registration_token), "%s", value);
        } else if (strcmp(key, "server_host") == 0) {
            snprintf(cfg->server_host, sizeof(cfg->server_host), "%s", value);
        } else if (strcmp(key, "server_port") == 0) {
            char* endptr;
            long port = strtol(value, &endptr, 10);
            if (*endptr == '\0' && port > 0 && port <= 65535)
                cfg->server_port = (uint16_t)port;
        }
    }

    fclose(f);
    return 0;
}

static int write_default_config(const nexterm_config_t* cfg) {
    FILE* f = fopen(CONFIG_FILE, "w");
    if (!f) {
        LOG_ERROR("Failed to create %s: %s", CONFIG_FILE, strerror(errno));
        return -1;
    }

    fprintf(f, "registration_token: \"%s\"\n", cfg->registration_token);
    fprintf(f, "server_host: \"%s\"\n", cfg->server_host);
    fprintf(f, "server_port: %u\n", cfg->server_port);

    fclose(f);
    LOG_INFO("Created default config file: %s", CONFIG_FILE);
    return 0;
}

int nexterm_config_load(nexterm_config_t* cfg) {
    memset(cfg, 0, sizeof(*cfg));
    snprintf(cfg->server_host, sizeof(cfg->server_host), "%s", "127.0.0.1");
    cfg->server_port = 7800;
    cfg->registration_token[0] = '\0';

    if (parse_config_file(cfg) != 0) {
        LOG_INFO("No config file found, creating default %s", CONFIG_FILE);
        if (write_default_config(cfg) != 0)
            LOG_WARN("Could not write default config file");
    }

    const char* env_token = getenv("REGISTRATION_TOKEN");
    if (env_token && env_token[0] != '\0') {
        snprintf(cfg->registration_token, sizeof(cfg->registration_token), "%s", env_token);
        LOG_INFO("Using REGISTRATION_TOKEN from environment variable");
    }

    return 0;
}
