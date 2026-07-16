#include "demo.h"
#include "hud.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>

#include <stddef.h>
#include <stdio.h>

#define GUAC_DEMO_HUD_TEXT_X      10.0
#define GUAC_DEMO_HUD_FIRST_ROW_Y 22.0
#define GUAC_DEMO_HUD_ROW_HEIGHT  18.0
#define GUAC_DEMO_HUD_FONT_SIZE   13.0

void guac_demo_hud_signature(const guac_demo_stats* stats, char* buffer,
        size_t size) {
    snprintf(buffer, size, "%i|%i|%i|%i|%i|%i|%i|%i|%i|%s",
            stats->width, stats->height, stats->dpi,
            stats->fps, stats->frames, stats->latency,
            stats->input.mouse_x, stats->input.mouse_y,
            stats->input.mouse_mask, stats->input.last_key);
}

void guac_demo_hud_draw(cairo_t* cairo, const guac_demo_stats* stats) {
    char row[128];

    cairo_save(cairo);

    cairo_set_operator(cairo, CAIRO_OPERATOR_SOURCE);
    cairo_rectangle(cairo, 0, 0, GUAC_DEMO_HUD_WIDTH, GUAC_DEMO_HUD_HEIGHT);
    cairo_set_source_rgb(cairo, 0, 0, 0);
    cairo_fill(cairo);

    cairo_set_operator(cairo, CAIRO_OPERATOR_OVER);
    cairo_select_font_face(cairo, "monospace", CAIRO_FONT_SLANT_NORMAL,
            CAIRO_FONT_WEIGHT_NORMAL);
    cairo_set_font_size(cairo, GUAC_DEMO_HUD_FONT_SIZE);
    cairo_set_source_rgb(cairo, 1, 1, 1);

    double y = GUAC_DEMO_HUD_FIRST_ROW_Y;

    snprintf(row, sizeof(row), "%ix%i %idpi", stats->width, stats->height,
            stats->dpi);
    cairo_move_to(cairo, GUAC_DEMO_HUD_TEXT_X, y);
    cairo_show_text(cairo, row);

    y += GUAC_DEMO_HUD_ROW_HEIGHT;
    snprintf(row, sizeof(row), "%i fps  %i frames", stats->fps, stats->frames);
    cairo_move_to(cairo, GUAC_DEMO_HUD_TEXT_X, y);
    cairo_show_text(cairo, row);

    y += GUAC_DEMO_HUD_ROW_HEIGHT;
    snprintf(row, sizeof(row), "%i ms lag", stats->latency);
    cairo_move_to(cairo, GUAC_DEMO_HUD_TEXT_X, y);
    cairo_show_text(cairo, row);

    y += GUAC_DEMO_HUD_ROW_HEIGHT;
    snprintf(row, sizeof(row), "mouse %i,%i %c%c%c",
            stats->input.mouse_x, stats->input.mouse_y,
            (stats->input.mouse_mask & GUAC_CLIENT_MOUSE_LEFT)   ? 'L' : '-',
            (stats->input.mouse_mask & GUAC_CLIENT_MOUSE_MIDDLE) ? 'M' : '-',
            (stats->input.mouse_mask & GUAC_CLIENT_MOUSE_RIGHT)  ? 'R' : '-');
    cairo_move_to(cairo, GUAC_DEMO_HUD_TEXT_X, y);
    cairo_show_text(cairo, row);

    y += GUAC_DEMO_HUD_ROW_HEIGHT;
    snprintf(row, sizeof(row), "key %s",
            stats->input.last_key[0] ? stats->input.last_key : "-");
    cairo_move_to(cairo, GUAC_DEMO_HUD_TEXT_X, y);
    cairo_show_text(cairo, row);

    cairo_restore(cairo);
}
