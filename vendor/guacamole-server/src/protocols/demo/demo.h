#ifndef GUAC_DEMO_H
#define GUAC_DEMO_H

#include <guacamole/client.h>
#include <guacamole/display.h>

#include <pthread.h>

#define GUAC_DEMO_HUD_MIN_INTERVAL 100

#define GUAC_DEMO_MOD_SHIFT 1
#define GUAC_DEMO_MOD_CTRL  2
#define GUAC_DEMO_MOD_ALT   4
#define GUAC_DEMO_MOD_SUPER 8

typedef struct guac_demo_input_state {
    int mouse_x;

    int mouse_y;

    int mouse_mask;

    int modifiers;

    char last_key[64];
} guac_demo_input_state;

typedef struct guac_demo_stats {
    int width;

    int height;

    int dpi;

    int fps;

    int frames;

    int latency;

    guac_demo_input_state input;
} guac_demo_stats;

#define GUAC_DEMO_DEFAULT_WIDTH  1024
#define GUAC_DEMO_DEFAULT_HEIGHT 768
#define GUAC_DEMO_DEFAULT_DPI    96

#define GUAC_DEMO_MIN_WIDTH  320
#define GUAC_DEMO_MIN_HEIGHT 240
#define GUAC_DEMO_MAX_WIDTH  3840
#define GUAC_DEMO_MAX_HEIGHT 2160

#define GUAC_DEMO_FRAME_DURATION 16667

#define GUAC_DEMO_LOGO_SCREEN_RATIO 0.28

#define GUAC_DEMO_LOGO_VELOCITY_X 220.0
#define GUAC_DEMO_LOGO_VELOCITY_Y 165.0

typedef struct guac_demo_client {
    pthread_t render_loop_thread;

    int render_loop_thread_started;

    guac_display* display;

    guac_display_render_thread* render_thread;

    int width;

    int height;

    int dpi;

    pthread_mutex_t state_lock;

    guac_demo_input_state input;

    int pending_width;

    int pending_height;
} guac_demo_client;

void guac_demo_clamp_size(int* width, int* height);

void* guac_demo_render_loop_thread(void* data);

#endif
