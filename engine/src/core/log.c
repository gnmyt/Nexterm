#include "log.h"

#include <stdio.h>
#include <time.h>

static nexterm_log_level_t current_level = NEXTERM_LOG_INFO;

static const char* const level_names[] = {
    "ERROR", "WARN", "INFO", "DEBUG", "TRACE"
};

#define LEVEL_COUNT (sizeof(level_names) / sizeof(level_names[0]))

void nexterm_log_set_level(nexterm_log_level_t level) {
    current_level = level;
}

void nexterm_log_msg(nexterm_log_level_t level, const char* message) {
    if (level > current_level || (unsigned)level >= LEVEL_COUNT)
        return;

    time_t now = time(NULL);
    struct tm tm_buf;
    localtime_r(&now, &tm_buf);

    char time_str[32];
    strftime(time_str, sizeof(time_str), "%Y-%m-%d %H:%M:%S", &tm_buf);

    FILE* out = (level <= NEXTERM_LOG_WARN) ? stderr : stdout;

    fprintf(out, "[%s] [engine] [%s] %s\n", time_str, level_names[level], message);
    fflush(out);
}
