#include "control_plane.h"
#include "session.h"
#include "config.h"
#include "log.h"

#include <libssh2.h>

#include <getopt.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

nexterm_session_manager_t g_session_manager;

static nexterm_control_plane_t* g_control_plane = NULL;
static volatile int g_shutdown = 0;

static void signal_handler(int sig) {
    (void)sig;
    g_shutdown = 1;
    if (g_control_plane) {
        g_control_plane->running = false;
    }
}

static nexterm_log_level_t parse_log_level(const char* str) {
    if (strcmp(str, "error") == 0) return NEXTERM_LOG_ERROR;
    if (strcmp(str, "warn") == 0)  return NEXTERM_LOG_WARN;
    if (strcmp(str, "info") == 0)  return NEXTERM_LOG_INFO;
    if (strcmp(str, "debug") == 0) return NEXTERM_LOG_DEBUG;
    if (strcmp(str, "trace") == 0) return NEXTERM_LOG_TRACE;
    return NEXTERM_LOG_INFO;
}

static void print_usage(const char* prog) {
    printf("Nexterm Engine v%s\n\n", NEXTERM_ENGINE_VERSION);
    printf("Usage: %s [options]\n\n", prog);
    printf("Options:\n");
    printf("  -h, --host HOST    Control plane server host (default: 127.0.0.1)\n");
    printf("  -p, --port PORT    Control plane server port (default: 7800)\n");
    printf("  -l, --log LEVEL    Log level: error|warn|info|debug|trace (default: info)\n");
    printf("      --help         Show this message\n");
}

int main(int argc, char* argv[]) {
    const char* cli_host = NULL;
    uint16_t cli_port = 0;
    const char* log_level_str = "info";

    static const struct option long_options[] = {
        {"host", required_argument, 0, 'h'},
        {"port", required_argument, 0, 'p'},
        {"log",  required_argument, 0, 'l'},
        {"help", no_argument,       0, 'H'},
        {0, 0, 0, 0}
    };

    int opt;
    while ((opt = getopt_long(argc, argv, "h:p:l:", long_options, NULL)) != -1) {
        switch (opt) {
            case 'h':
                cli_host = optarg;
                break;
            case 'p': {
                char* endptr;
                long val = strtol(optarg, &endptr, 10);
                if (*endptr != '\0' || val <= 0 || val > 65535) {
                    fprintf(stderr, "Invalid port: %s\n", optarg);
                    return 1;
                }
                cli_port = (uint16_t)val;
                break;
            }
            case 'l':
                log_level_str = optarg;
                break;
            case 'H':
                print_usage(argv[0]);
                return 0;
            default:
                print_usage(argv[0]);
                return 1;
        }
    }

    nexterm_log_set_level(parse_log_level(log_level_str));

    nexterm_config_t config;
    nexterm_config_load(&config);

    const char* server_host = cli_host ? cli_host : config.server_host;
    uint16_t server_port = cli_port ? cli_port : config.server_port;

    LOG_INFO("Nexterm Engine v%s starting", NEXTERM_ENGINE_VERSION);

    if (libssh2_init(0) != 0) {
        LOG_ERROR("Failed to initialize libssh2");
        return 1;
    }

    struct sigaction sa;
    sa.sa_handler = signal_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);
    signal(SIGPIPE, SIG_IGN);

    nexterm_sm_init(&g_session_manager);

    nexterm_control_plane_t* cp = nexterm_cp_create(server_host, server_port,
                                                     config.registration_token);
    if (!cp) {
        LOG_ERROR("Failed to create control plane client");
        return 1;
    }
    g_control_plane = cp;

    while (!g_shutdown) {
        if (nexterm_cp_start(cp) == 0) {
            LOG_INFO("Connected to control plane");

            while (cp->running && !g_shutdown) {
                sleep(1);
            }

            nexterm_cp_stop(cp);
        }

        if (!g_shutdown) {
            LOG_INFO("Reconnecting in %u ms...", cp->reconnect_delay_ms);
            struct timespec ts;
            ts.tv_sec = cp->reconnect_delay_ms / 1000;
            ts.tv_nsec = (cp->reconnect_delay_ms % 1000) * 1000000L;
            nanosleep(&ts, NULL);
        }
    }

    LOG_INFO("Shutting down engine");
    nexterm_sm_destroy(&g_session_manager);
    nexterm_cp_destroy(cp);
    libssh2_exit();

    LOG_INFO("Engine stopped");
    return 0;
}
