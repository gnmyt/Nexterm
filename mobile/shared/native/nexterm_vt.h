#ifndef NEXTERM_VT_H
#define NEXTERM_VT_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct NxtVt NxtVt;

#define NXT_CELL_UNDERLINE (1 << 8)
#define NXT_CELL_WIDE (1 << 9)
#define NXT_CELL_SPACER (1 << 10)
#define NXT_CELL_SELECTED (1 << 11)
#define NXT_CELL_HAS_BG (1 << 12)

#define NXT_INFO_CURSOR_X 0
#define NXT_INFO_CURSOR_Y 1
#define NXT_INFO_CURSOR_FLAGS 2
#define NXT_INFO_CURSOR_STYLE 3
#define NXT_INFO_BACKGROUND 4
#define NXT_INFO_SIZE 5

NxtVt* nxt_new(uint16_t cols, uint16_t rows, uint32_t max_scrollback_lines);
void nxt_free(NxtVt* vt);

int nxt_write(NxtVt* vt, const uint8_t* data, size_t len);
void nxt_resize(NxtVt* vt, uint16_t cols, uint16_t rows, uint32_t cell_w, uint32_t cell_h);
void nxt_set_colors(NxtVt* vt, uint32_t fg, uint32_t bg, uint32_t cursor, const uint32_t* palette16);

size_t nxt_take_output(NxtVt* vt, uint8_t* buf, size_t cap);
size_t nxt_take_string(NxtVt* vt, uint8_t* buf, size_t cap);

int nxt_snapshot(NxtVt* vt, int32_t* cps, int32_t* fg, int32_t* bg, int32_t* flags, int32_t cap,
                 int32_t* extra, int32_t extra_cap, int32_t* info);

void nxt_scroll(NxtVt* vt, int32_t kind, int64_t delta);
int nxt_mode(NxtVt* vt, uint16_t mode, int ansi);

int nxt_key(NxtVt* vt, int32_t key, int32_t mods, const uint8_t* utf8, size_t utf8_len, uint32_t unshifted);
int nxt_mouse(NxtVt* vt, int32_t action, int32_t button, int32_t mods, float x, float y,
              uint32_t screen_w, uint32_t screen_h, uint32_t cell_w, uint32_t cell_h);
void nxt_text(NxtVt* vt, const uint8_t* data, size_t len);
void nxt_paste(NxtVt* vt, const uint8_t* data, size_t len);

int nxt_select_words(NxtVt* vt, uint16_t x1, uint16_t y1, uint16_t x2, uint16_t y2);
void nxt_select_clear(NxtVt* vt);
int64_t nxt_selection_text(NxtVt* vt);

#ifdef __cplusplus
}
#endif

#endif
