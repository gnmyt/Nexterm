#ifndef NEXTERM_LOG_H
#define NEXTERM_LOG_H

typedef enum {
    NEXTERM_LOG_ERROR,
    NEXTERM_LOG_WARN,
    NEXTERM_LOG_INFO,
    NEXTERM_LOG_DEBUG,
    NEXTERM_LOG_TRACE,
} nexterm_log_level_t;

void nexterm_log_set_level(nexterm_log_level_t level);

void nexterm_log_msg(nexterm_log_level_t level, const char* message);

#define LOG_IMPL(lvl, fmt, ...) \
    do { \
        char log_buf_[2048]; \
        snprintf(log_buf_, sizeof(log_buf_), fmt, ##__VA_ARGS__); \
        nexterm_log_msg(lvl, log_buf_); \
    } while (0)

#define LOG_ERROR(fmt, ...) LOG_IMPL(NEXTERM_LOG_ERROR, fmt, ##__VA_ARGS__)
#define LOG_WARN(fmt, ...)  LOG_IMPL(NEXTERM_LOG_WARN,  fmt, ##__VA_ARGS__)
#define LOG_INFO(fmt, ...)  LOG_IMPL(NEXTERM_LOG_INFO,  fmt, ##__VA_ARGS__)
#define LOG_DEBUG(fmt, ...) LOG_IMPL(NEXTERM_LOG_DEBUG, fmt, ##__VA_ARGS__)
#define LOG_TRACE(fmt, ...) LOG_IMPL(NEXTERM_LOG_TRACE, fmt, ##__VA_ARGS__)

#endif
