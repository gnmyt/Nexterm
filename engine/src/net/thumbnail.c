#include "thumbnail.h"
#include "log.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wsign-conversion"
#pragma GCC diagnostic ignored "-Wconversion"
#pragma GCC diagnostic ignored "-Wcast-qual"
#pragma GCC diagnostic ignored "-Wunused-parameter"

#define STBI_NO_STDIO
#define STBI_NO_LINEAR
#define STBI_NO_HDR
#define STBI_ONLY_JPEG
#define STBI_ONLY_PNG
#define STBI_ONLY_GIF
#define STBI_ONLY_BMP
#define STBI_ONLY_TGA
#define STBI_MAX_DIMENSIONS 32768
#define STB_IMAGE_IMPLEMENTATION
#include "../thirdparty/stb_image.h"

#define STB_IMAGE_RESIZE_IMPLEMENTATION
#include "../thirdparty/stb_image_resize2.h"

#define STBI_WRITE_NO_STDIO
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "../thirdparty/stb_image_write.h"

#pragma GCC diagnostic pop

#ifdef HAVE_WEBP
#include <webp/decode.h>
#endif

#define THUMB_MAX_PIXELS   (100 * 1000 * 1000)
#define THUMB_JPEG_QUALITY 80
#define THUMB_MIN          16
#define THUMB_MAX          512

typedef struct {
    uint8_t* buf;
    size_t   len;
    size_t   cap;
    int      err;
} jpg_sink_t;

static void jpg_write_cb(void* context, void* data, int size) {
    jpg_sink_t* s = (jpg_sink_t*)context;
    if (s->err || size <= 0) return;
    if (s->len + (size_t)size > s->cap) {
        size_t nc = s->cap ? s->cap * 2 : 65536;
        while (nc < s->len + (size_t)size) nc *= 2;
        uint8_t* nb = realloc(s->buf, nc);
        if (!nb) { s->err = 1; return; }
        s->buf = nb;
        s->cap = nc;
    }
    memcpy(s->buf + s->len, data, (size_t)size);
    s->len += (size_t)size;
}

int nexterm_make_thumbnail(const uint8_t* in, size_t in_len, int target,
                           uint8_t** out, size_t* out_len, int* ow, int* oh) {
    if (!in || in_len == 0 || !out || !out_len) return -1;
    if (target < THUMB_MIN) target = 100;
    if (target > THUMB_MAX) target = THUMB_MAX;

    int w = 0, h = 0;
    unsigned char* rgb = NULL;
    int from_webp = 0;

#ifdef HAVE_WEBP
    {
        int ww = 0, wh = 0;
        if (in_len > 12 && WebPGetInfo(in, in_len, &ww, &wh)) {
            if ((long long)ww * wh > THUMB_MAX_PIXELS || ww <= 0 || wh <= 0) {
                LOG_WARN("Thumbnail: webp too large (%dx%d)", ww, wh);
                return -1;
            }
            rgb = WebPDecodeRGB(in, in_len, &ww, &wh);
            if (rgb) { w = ww; h = wh; from_webp = 1; }
        }
    }
#endif

    if (!rgb) {
        int iw = 0, ih = 0, ic = 0;
        if (stbi_info_from_memory(in, (int)in_len, &iw, &ih, &ic)) {
            if ((long long)iw * ih > THUMB_MAX_PIXELS) {
                LOG_WARN("Thumbnail: image too large (%dx%d)", iw, ih);
                return -1;
            }
        }
        int comp = 0;
        rgb = stbi_load_from_memory(in, (int)in_len, &w, &h, &comp, 3);
    }

    if (!rgb || w <= 0 || h <= 0) {
        if (rgb) {
#ifdef HAVE_WEBP
            if (from_webp) WebPFree(rgb); else stbi_image_free(rgb);
#else
            stbi_image_free(rgb);
#endif
        }
        return -1;
    }

    int side = w < h ? w : h;
    int ox = (w - side) / 2;
    int oy = (h - side) / 2;
    const unsigned char* crop = rgb + ((size_t)oy * (size_t)w + (size_t)ox) * 3;

    unsigned char* resized = malloc((size_t)target * (size_t)target * 3);
    int rc = -1;
    if (resized &&
        stbir_resize_uint8_srgb(crop, side, side, w * 3,
                                resized, target, target, target * 3, STBIR_RGB)) {
        jpg_sink_t sink = { 0 };
        if (stbi_write_jpg_to_func(jpg_write_cb, &sink, target, target, 3,
                                   resized, THUMB_JPEG_QUALITY) && !sink.err) {
            *out = sink.buf;
            *out_len = sink.len;
            if (ow) *ow = target;
            if (oh) *oh = target;
            rc = 0;
        } else {
            free(sink.buf);
        }
    }

    free(resized);
#ifdef HAVE_WEBP
    if (from_webp) WebPFree(rgb); else stbi_image_free(rgb);
#else
    stbi_image_free(rgb);
#endif
    return rc;
}
