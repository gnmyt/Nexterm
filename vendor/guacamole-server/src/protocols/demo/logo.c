#include "logo.h"
#include "logo_png.h"

#include <cairo/cairo.h>

#include <string.h>

typedef struct guac_demo_logo_stream {
    size_t position;
} guac_demo_logo_stream;

static cairo_status_t guac_demo_logo_read(void* closure, unsigned char* data,
        unsigned int length) {
    guac_demo_logo_stream* stream = (guac_demo_logo_stream*) closure;

    if (stream->position + length > sizeof(guac_demo_logo_png))
        return CAIRO_STATUS_READ_ERROR;

    memcpy(data, guac_demo_logo_png + stream->position, length);
    stream->position += length;

    return CAIRO_STATUS_SUCCESS;
}

cairo_surface_t* guac_demo_logo_alloc() {
    guac_demo_logo_stream stream = { .position = 0 };

    cairo_surface_t* logo = cairo_image_surface_create_from_png_stream(
            guac_demo_logo_read, &stream);

    if (cairo_surface_status(logo) != CAIRO_STATUS_SUCCESS) {
        cairo_surface_destroy(logo);
        return NULL;
    }

    return logo;
}

void guac_demo_logo_draw(cairo_t* cairo, cairo_surface_t* logo, double x,
        double y, double scale) {
    if (logo == NULL)
        return;

    cairo_save(cairo);

    cairo_translate(cairo, x, y);
    cairo_scale(cairo, scale, scale);

    cairo_set_source_surface(cairo, logo, 0, 0);
    cairo_pattern_set_filter(cairo_get_source(cairo), CAIRO_FILTER_GOOD);
    cairo_paint(cairo);

    cairo_restore(cairo);
}
