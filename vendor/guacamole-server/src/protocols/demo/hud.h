#ifndef GUAC_DEMO_HUD_H
#define GUAC_DEMO_HUD_H

#include "demo.h"

#include <cairo/cairo.h>

#include <stddef.h>

#define GUAC_DEMO_HUD_WIDTH  260
#define GUAC_DEMO_HUD_HEIGHT 104

void guac_demo_hud_draw(cairo_t* cairo, const guac_demo_stats* stats);

void guac_demo_hud_signature(const guac_demo_stats* stats, char* buffer, size_t size);

#endif
