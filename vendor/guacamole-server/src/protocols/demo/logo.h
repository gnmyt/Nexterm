#ifndef GUAC_DEMO_LOGO_H
#define GUAC_DEMO_LOGO_H

#include <cairo/cairo.h>

#define GUAC_DEMO_LOGO_WIDTH 570

#define GUAC_DEMO_LOGO_HEIGHT 91

cairo_surface_t* guac_demo_logo_alloc();

void guac_demo_logo_draw(cairo_t* cairo, cairo_surface_t* logo, double x,
        double y, double scale);

#endif
