#ifndef NEXTERM_THUMBNAIL_H
#define NEXTERM_THUMBNAIL_H

#include <stddef.h>
#include <stdint.h>

int nexterm_make_thumbnail(const uint8_t* in, size_t in_len, int target,
                           uint8_t** out, size_t* out_len, int* ow, int* oh);

#endif
