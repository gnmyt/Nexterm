#include "demo.h"
#include "hud.h"
#include "logo.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/rect.h>
#include <guacamole/timestamp.h>

#include <math.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#define GUAC_DEMO_BACKGROUND_RED   (0x18 / 255.0)
#define GUAC_DEMO_BACKGROUND_GREEN (0x1D / 255.0)
#define GUAC_DEMO_BACKGROUND_BLUE  (0x2C / 255.0)

typedef struct guac_demo_logo_state {
    double x;

    double y;

    double velocity_x;

    double velocity_y;

    double scale;

    double width;

    double height;
} guac_demo_logo_state;

static int guac_demo_clamp_dimension(int value, int fallback, int min, int max) {
    if (value <= 0)
        return fallback;

    if (value < min)
        return min;

    if (value > max)
        return max;

    return value;
}

void guac_demo_clamp_size(int* width, int* height) {
    *width = guac_demo_clamp_dimension(*width, GUAC_DEMO_DEFAULT_WIDTH,
            GUAC_DEMO_MIN_WIDTH, GUAC_DEMO_MAX_WIDTH);

    *height = guac_demo_clamp_dimension(*height, GUAC_DEMO_DEFAULT_HEIGHT,
            GUAC_DEMO_MIN_HEIGHT, GUAC_DEMO_MAX_HEIGHT);
}

static void guac_demo_logo_rescale(guac_demo_logo_state* logo, int width,
        int height) {
    logo->scale = width * GUAC_DEMO_LOGO_SCREEN_RATIO / GUAC_DEMO_LOGO_WIDTH;
    logo->width = GUAC_DEMO_LOGO_WIDTH * logo->scale;
    logo->height = GUAC_DEMO_LOGO_HEIGHT * logo->scale;

    double max_x = width - logo->width;
    double max_y = height - logo->height;

    if (logo->x > max_x) logo->x = max_x;
    if (logo->y > max_y) logo->y = max_y;
    if (logo->x < 0) logo->x = 0;
    if (logo->y < 0) logo->y = 0;
}

static void guac_demo_logo_advance(guac_demo_logo_state* logo, int width,
        int height, double elapsed) {
    double max_x = width - logo->width;
    double max_y = height - logo->height;

    logo->x += logo->velocity_x * elapsed;
    logo->y += logo->velocity_y * elapsed;

    if (logo->x <= 0) {
        logo->x = 0;
        logo->velocity_x = fabs(logo->velocity_x);
    }
    else if (logo->x >= max_x) {
        logo->x = max_x;
        logo->velocity_x = -fabs(logo->velocity_x);
    }

    if (logo->y <= 0) {
        logo->y = 0;
        logo->velocity_y = fabs(logo->velocity_y);
    }
    else if (logo->y >= max_y) {
        logo->y = max_y;
        logo->velocity_y = -fabs(logo->velocity_y);
    }
}

static void guac_demo_draw_background(guac_display_layer* layer) {
    guac_display_layer_cairo_context* context =
        guac_display_layer_open_cairo(layer);

    cairo_set_operator(context->cairo, CAIRO_OPERATOR_SOURCE);
    cairo_set_source_rgb(context->cairo, GUAC_DEMO_BACKGROUND_RED,
            GUAC_DEMO_BACKGROUND_GREEN, GUAC_DEMO_BACKGROUND_BLUE);
    cairo_paint(context->cairo);

    guac_rect_extend(&context->dirty, &context->bounds);
    context->hint_from = NULL;

    guac_display_layer_close_cairo(layer, context);
}

static void guac_demo_draw_logo(guac_display_layer* layer,
        const guac_demo_logo_state* logo, cairo_surface_t* logo_surface) {
    guac_display_layer_resize(layer, (int) ceil(logo->width),
            (int) ceil(logo->height));

    guac_display_layer_cairo_context* context =
        guac_display_layer_open_cairo(layer);

    cairo_set_operator(context->cairo, CAIRO_OPERATOR_SOURCE);
    cairo_set_source_rgba(context->cairo, 0, 0, 0, 0);
    cairo_paint(context->cairo);

    cairo_set_operator(context->cairo, CAIRO_OPERATOR_OVER);
    guac_demo_logo_draw(context->cairo, logo_surface, 0, 0, logo->scale);

    guac_rect_extend(&context->dirty, &context->bounds);
    context->hint_from = NULL;

    guac_display_layer_close_cairo(layer, context);
}

static void guac_demo_draw_hud(guac_display_layer* layer,
        const guac_demo_stats* stats) {
    guac_display_layer_cairo_context* context =
        guac_display_layer_open_cairo(layer);

    guac_demo_hud_draw(context->cairo, stats);

    guac_rect_extend(&context->dirty, &context->bounds);
    context->hint_from = NULL;

    guac_display_layer_close_cairo(layer, context);
}

void* guac_demo_render_loop_thread(void* data) {
    guac_client* client = (guac_client*) data;
    guac_demo_client* demo_client = (guac_demo_client*) client->data;

    int width = demo_client->width;
    int height = demo_client->height;

    demo_client->display = guac_display_alloc(client);

    guac_display_layer* default_layer =
        guac_display_default_layer(demo_client->display);

    guac_display_layer_resize(default_layer, width, height);
    guac_display_layer_set_lossless(default_layer, 1);

    guac_display_layer* logo_layer =
        guac_display_alloc_layer(demo_client->display, 0);
    guac_display_layer_set_lossless(logo_layer, 1);
    guac_display_layer_stack(logo_layer, 1);

    guac_display_layer* hud_layer =
        guac_display_alloc_layer(demo_client->display, 1);
    guac_display_layer_set_lossless(hud_layer, 1);
    guac_display_layer_resize(hud_layer, GUAC_DEMO_HUD_WIDTH,
            GUAC_DEMO_HUD_HEIGHT);
    guac_display_layer_stack(hud_layer, 2);

    guac_display_set_cursor(demo_client->display, GUAC_DISPLAY_CURSOR_POINTER);

    cairo_surface_t* logo_surface = guac_demo_logo_alloc();
    if (logo_surface == NULL)
        guac_client_log(client, GUAC_LOG_WARNING,
                "Nexterm logo could not be decoded and will not be drawn.");

    guac_demo_logo_state logo = {
        .velocity_x = GUAC_DEMO_LOGO_VELOCITY_X,
        .velocity_y = GUAC_DEMO_LOGO_VELOCITY_Y
    };

    guac_demo_logo_rescale(&logo, width, height);
    logo.x = (width - logo.width) / 2;
    logo.y = (height - logo.height) / 2;

    guac_demo_stats stats = {
        .width = width,
        .height = height,
        .dpi = demo_client->dpi
    };

    guac_demo_draw_background(default_layer);
    guac_demo_draw_logo(logo_layer, &logo, logo_surface);
    guac_display_layer_move(logo_layer, (int) floor(logo.x),
            (int) floor(logo.y));
    guac_demo_draw_hud(hud_layer, &stats);
    guac_display_end_frame(demo_client->display);

    demo_client->render_thread =
        guac_display_render_thread_create(demo_client->display);

    guac_client_log(client, GUAC_LOG_INFO,
            "Demo connection started (%ix%i at %i DPI).", width, height,
            demo_client->dpi);

    char signature[256] = "";
    char previous_signature[256] = "";

    int frames = 0;
    int frames_at_sample = 0;
    guac_timestamp last_sample = guac_timestamp_current();
    guac_timestamp last_hud = 0;

    while (client->state == GUAC_CLIENT_RUNNING) {
        guac_demo_logo_advance(&logo, width, height,
                GUAC_DEMO_FRAME_DURATION / 1000000.0);

        frames++;

        guac_timestamp now = guac_timestamp_current();
        if (now - last_sample >= 1000) {
            stats.fps = (int) ((frames - frames_at_sample) * 1000
                    / (now - last_sample));
            stats.frames = frames;
            stats.latency = guac_client_get_processing_lag(client);

            frames_at_sample = frames;
            last_sample = now;

        }

        pthread_mutex_lock(&demo_client->state_lock);
        stats.input = demo_client->input;
        int resize_width = demo_client->pending_width;
        int resize_height = demo_client->pending_height;
        demo_client->pending_width = 0;
        demo_client->pending_height = 0;
        pthread_mutex_unlock(&demo_client->state_lock);

        if (resize_width != 0
                && (resize_width != width || resize_height != height)) {
            width = resize_width;
            height = resize_height;

            guac_display_layer_resize(default_layer, width, height);
            guac_demo_logo_rescale(&logo, width, height);

            stats.width = width;
            stats.height = height;

            guac_demo_draw_background(default_layer);
            guac_demo_draw_logo(logo_layer, &logo, logo_surface);
            previous_signature[0] = '\0';
            last_hud = 0;

            guac_client_log(client, GUAC_LOG_DEBUG, "Display resized to %ix%i.",
                    width, height);

        }

        guac_demo_hud_signature(&stats, signature, sizeof(signature));

        guac_display_layer_move(logo_layer, (int) floor(logo.x),
                (int) floor(logo.y));

        if (strcmp(signature, previous_signature) != 0
                && now - last_hud >= GUAC_DEMO_HUD_MIN_INTERVAL) {
            guac_demo_draw_hud(hud_layer, &stats);
            snprintf(previous_signature, sizeof(previous_signature), "%s",
                    signature);
            last_hud = now;
        }

        guac_display_render_thread_notify_frame(demo_client->render_thread);

        usleep(GUAC_DEMO_FRAME_DURATION);

    }

    guac_display_render_thread_destroy(demo_client->render_thread);
    demo_client->render_thread = NULL;

    if (logo_surface != NULL)
        cairo_surface_destroy(logo_surface);

    guac_client_stop(client);
    guac_client_log(client, GUAC_LOG_INFO, "Demo connection ended.");
    return NULL;
}
