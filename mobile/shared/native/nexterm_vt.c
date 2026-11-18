#include "nexterm_vt.h"

#include <ghostty/vt.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  uint8_t* ptr;
  size_t len, cap;
} Bytes;

struct NxtVt {
  GhosttyTerminal term;
  GhosttyRenderState rs;
  GhosttyRenderStateRowIterator rows;
  GhosttyRenderStateRowCells cells;
  GhosttyKeyEncoder keys;
  GhosttyKeyEvent key;
  GhosttyMouseEncoder mouse;
  GhosttyMouseEvent mev;
  Bytes out, str;
  int output;
};

static void bytes_put(Bytes* b, const void* data, size_t len) {
  if (b->len + len > b->cap) {
    size_t cap = b->cap ? b->cap : 256;
    while (cap < b->len + len) cap *= 2;
    uint8_t* p = realloc(b->ptr, cap);
    if (!p) return;
    b->ptr = p;
    b->cap = cap;
  }
  memcpy(b->ptr + b->len, data, len);
  b->len += len;
}

static size_t bytes_take(Bytes* b, uint8_t* buf, size_t cap) {
  size_t len = b->len;
  if (buf && len <= cap) {
    memcpy(buf, b->ptr, len);
    b->len = 0;
  }
  return len;
}

static void on_pty(GhosttyTerminal t, void* ud, const uint8_t* data, size_t len) {
  NxtVt* vt = ud;
  bytes_put(&vt->out, data, len);
  vt->output = 1;
}

NxtVt* nxt_new(uint16_t cols, uint16_t rows, uint32_t max_scrollback_lines) {
  NxtVt* vt = calloc(1, sizeof(NxtVt));
  if (!vt) return NULL;
  if (ghostty_terminal_new(NULL, &vt->term, cols, rows) != GHOSTTY_SUCCESS) {
    free(vt);
    return NULL;
  }
  size_t lines = max_scrollback_lines;
  ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_LINES, &lines);
  ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_USERDATA, vt);
  ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_WRITE_PTY, (const void*)on_pty);
  ghostty_render_state_new(NULL, &vt->rs);
  ghostty_render_state_row_iterator_new(NULL, &vt->rows);
  ghostty_render_state_row_cells_new(NULL, &vt->cells);
  ghostty_key_encoder_new(NULL, &vt->keys);
  ghostty_key_event_new(NULL, &vt->key);
  ghostty_mouse_encoder_new(NULL, &vt->mouse);
  ghostty_mouse_event_new(NULL, &vt->mev);
  return vt;
}

void nxt_free(NxtVt* vt) {
  if (!vt) return;
  ghostty_mouse_event_free(vt->mev);
  ghostty_mouse_encoder_free(vt->mouse);
  ghostty_key_event_free(vt->key);
  ghostty_key_encoder_free(vt->keys);
  ghostty_render_state_row_cells_free(vt->cells);
  ghostty_render_state_row_iterator_free(vt->rows);
  ghostty_render_state_free(vt->rs);
  ghostty_terminal_free(vt->term);
  free(vt->out.ptr);
  free(vt->str.ptr);
  free(vt);
}

int nxt_write(NxtVt* vt, const uint8_t* data, size_t len) {
  vt->output = 0;
  ghostty_terminal_vt_write(vt->term, data, len);
  return vt->output;
}

void nxt_resize(NxtVt* vt, uint16_t cols, uint16_t rows, uint32_t cell_w, uint32_t cell_h) {
  ghostty_terminal_resize(vt->term, cols, rows, cell_w, cell_h);
}

static GhosttyColorRgb rgb(uint32_t argb) {
  return (GhosttyColorRgb){(uint8_t)(argb >> 16), (uint8_t)(argb >> 8), (uint8_t)argb};
}

static int32_t argb(GhosttyColorRgb c) {
  return (int32_t)(0xFF000000u | ((uint32_t)c.r << 16) | ((uint32_t)c.g << 8) | c.b);
}

void nxt_set_colors(NxtVt* vt, uint32_t fg, uint32_t bg, uint32_t cursor, const uint32_t* palette16) {
  GhosttyColorRgb f = rgb(fg), b = rgb(bg), c = rgb(cursor);
  ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_COLOR_FOREGROUND, &f);
  ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_COLOR_BACKGROUND, &b);
  ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_COLOR_CURSOR, &c);
  if (palette16) {
    GhosttyColorRgb palette[256];
    ghostty_terminal_get(vt->term, GHOSTTY_TERMINAL_DATA_COLOR_PALETTE_DEFAULT, palette);
    for (int i = 0; i < 16; i++) palette[i] = rgb(palette16[i]);
    ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_COLOR_PALETTE, palette);
  }
}

size_t nxt_take_output(NxtVt* vt, uint8_t* buf, size_t cap) { return bytes_take(&vt->out, buf, cap); }

size_t nxt_take_string(NxtVt* vt, uint8_t* buf, size_t cap) { return bytes_take(&vt->str, buf, cap); }

static int32_t cell_flags(const GhosttyStyle* s) {
  int32_t f = s->flags & 0xFF;
  if (GHOSTTY_STYLE_UNDERLINE(*s) != 0) f |= NXT_CELL_UNDERLINE;
  return f;
}

int nxt_snapshot(NxtVt* vt, int32_t* cps, int32_t* fg, int32_t* bg, int32_t* flags, int32_t cap,
                 int32_t* extra, int32_t extra_cap, int32_t* info) {
  if (ghostty_render_state_update(vt->rs, vt->term) != GHOSTTY_SUCCESS) return 0;
  uint16_t cols = 0, rows = 0;
  ghostty_render_state_get(vt->rs, GHOSTTY_RENDER_STATE_DATA_COLS, &cols);
  ghostty_render_state_get(vt->rs, GHOSTTY_RENDER_STATE_DATA_ROWS, &rows);

  GhosttyRenderStateColors colors = GHOSTTY_INIT_SIZED(GhosttyRenderStateColors);
  ghostty_render_state_get(vt->rs, GHOSTTY_RENDER_STATE_DATA_COLORS, &colors);
  GhosttyRenderStateCursor cursor = GHOSTTY_INIT_SIZED(GhosttyRenderStateCursor);
  ghostty_render_state_get(vt->rs, GHOSTTY_RENDER_STATE_DATA_CURSOR, &cursor);

  info[NXT_INFO_CURSOR_X] = cursor.viewport_has_value ? cursor.viewport_x : -1;
  info[NXT_INFO_CURSOR_Y] = cursor.viewport_has_value ? cursor.viewport_y : -1;
  info[NXT_INFO_CURSOR_FLAGS] = (cursor.viewport_has_value ? 1 : 0) | (cursor.visible ? 2 : 0) | (cursor.blinking ? 4 : 0);
  info[NXT_INFO_CURSOR_STYLE] = cursor.visual_style;
  info[NXT_INFO_BACKGROUND] = argb(colors.background);
  if ((int32_t)cols * rows > cap) return 0;

  int32_t extra_used = 0;
  ghostty_render_state_get(vt->rs, GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR, &vt->rows);
  for (int32_t y = 0; y < rows && ghostty_render_state_row_iterator_next(vt->rows); y++) {
    GhosttyRenderStateRowSelection sel = GHOSTTY_INIT_SIZED(GhosttyRenderStateRowSelection);
    int has_sel = ghostty_render_state_row_get(vt->rows, GHOSTTY_RENDER_STATE_ROW_DATA_SELECTION, &sel) == GHOSTTY_SUCCESS;
    ghostty_render_state_row_get(vt->rows, GHOSTTY_RENDER_STATE_ROW_DATA_CELLS, &vt->cells);
    for (int32_t x = 0; x < cols && ghostty_render_state_row_cells_next(vt->cells); x++) {
      int32_t i = y * cols + x;
      GhosttyStyle style;
      ghostty_render_state_row_cells_get(vt->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE, &style);
      int32_t f = cell_flags(&style);

      GhosttyCell raw;
      GhosttyCellWide wide = GHOSTTY_CELL_WIDE_NARROW;
      if (ghostty_render_state_row_cells_get(vt->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_RAW, &raw) == GHOSTTY_SUCCESS)
        ghostty_cell_get(raw, GHOSTTY_CELL_DATA_WIDE, &wide);
      if (wide == GHOSTTY_CELL_WIDE_WIDE) f |= NXT_CELL_WIDE;
      else if (wide != GHOSTTY_CELL_WIDE_NARROW) f |= NXT_CELL_SPACER;
      if (has_sel && x >= sel.start_x && x <= sel.end_x) f |= NXT_CELL_SELECTED;

      GhosttyColorRgb c;
      fg[i] = ghostty_render_state_row_cells_get(vt->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR, &c) == GHOSTTY_SUCCESS
                  ? argb(c) : argb(colors.foreground);
      if (ghostty_render_state_row_cells_get(vt->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_BG_COLOR, &c) == GHOSTTY_SUCCESS) {
        bg[i] = argb(c);
        f |= NXT_CELL_HAS_BG;
      } else {
        bg[i] = argb(colors.background);
      }
      flags[i] = f;

      uint32_t len = 0;
      ghostty_render_state_row_cells_get(vt->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN, &len);
      uint32_t buf[16];
      GhosttyCodepointBuffer g = {.ptr = buf, .cap = 16};
      if (len > 0) ghostty_render_state_row_cells_get(vt->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF, &g);
      if (len <= 1) {
        cps[i] = len ? (int32_t)buf[0] : 0;
      } else {
        int32_t n = len < 16 ? (int32_t)len : 16;
        if (extra_used + n + 1 <= extra_cap) {
          cps[i] = -(1 + extra_used);
          extra[extra_used++] = n;
          for (int32_t k = 0; k < n; k++) extra[extra_used++] = (int32_t)buf[k];
        } else {
          cps[i] = (int32_t)buf[0];
        }
      }
    }
  }
  ghostty_render_state_clean(vt->rs);
  return 1;
}

void nxt_scroll(NxtVt* vt, int32_t kind, int64_t delta) {
  GhosttyTerminalScrollViewport s = {0};
  s.tag = kind == 0 ? GHOSTTY_TERMINAL_SCROLL_VIEWPORT_TOP
          : kind == 1 ? GHOSTTY_TERMINAL_SCROLL_VIEWPORT_BOTTOM
                      : GHOSTTY_TERMINAL_SCROLL_VIEWPORT_DELTA;
  s.value.delta = (intptr_t)delta;
  ghostty_terminal_scroll_viewport(vt->term, s);
}

int nxt_mode(NxtVt* vt, uint16_t mode, int ansi) {
  GhosttyTerminalModeConfig cfg = {.mode = ghostty_mode_new(mode, ansi != 0), .value = false};
  return ghostty_terminal_get(vt->term, GHOSTTY_TERMINAL_DATA_MODE, &cfg) == GHOSTTY_SUCCESS && cfg.value;
}

static int queue_encoded(NxtVt* vt, GhosttyResult r, const uint8_t* buf, size_t n) {
  if (r != GHOSTTY_SUCCESS || n == 0) return 0;
  bytes_put(&vt->out, buf, n);
  return 1;
}

int nxt_key(NxtVt* vt, int32_t key, int32_t mods, const uint8_t* utf8, size_t utf8_len, uint32_t unshifted) {
  ghostty_key_encoder_set_from_terminal(vt->keys, vt->term);
  ghostty_key_event_set_action(vt->key, GHOSTTY_KEY_ACTION_PRESS);
  ghostty_key_event_set_key(vt->key, (GhosttyKey)key);
  ghostty_key_event_set_mods(vt->key, (GhosttyMods)mods);
  ghostty_key_event_set_utf8(vt->key, (GhosttyString){utf8, utf8 ? utf8_len : 0});
  ghostty_key_event_set_unshifted_codepoint(vt->key, unshifted);
  uint8_t buf[128];
  size_t n = 0;
  return queue_encoded(vt, ghostty_key_encoder_encode(vt->keys, vt->key, buf, sizeof buf, &n), buf, n);
}

int nxt_mouse(NxtVt* vt, int32_t action, int32_t button, int32_t mods, float x, float y,
              uint32_t screen_w, uint32_t screen_h, uint32_t cell_w, uint32_t cell_h) {
  ghostty_mouse_encoder_set_from_terminal(vt->mouse, vt->term);
  GhosttyMouseEncoderSize size = GHOSTTY_INIT_SIZED(GhosttyMouseEncoderSize);
  size.screen_width = screen_w;
  size.screen_height = screen_h;
  size.cell_width = cell_w;
  size.cell_height = cell_h;
  ghostty_mouse_encoder_set(vt->mouse, GHOSTTY_MOUSE_ENCODER_OPT_SIZE, &size);
  ghostty_mouse_event_set_action(vt->mev, (GhosttyMouseAction)action);
  if (button > 0) ghostty_mouse_event_set_button(vt->mev, (GhosttyMouseButton)button);
  else ghostty_mouse_event_clear_button(vt->mev);
  ghostty_mouse_event_set_mods(vt->mev, (GhosttyMods)mods);
  ghostty_mouse_event_set_position(vt->mev, (GhosttyMousePosition){x, y});
  uint8_t buf[64];
  size_t n = 0;
  return queue_encoded(vt, ghostty_mouse_encoder_encode(vt->mouse, vt->mev, buf, sizeof buf, &n), buf, n);
}

void nxt_text(NxtVt* vt, const uint8_t* data, size_t len) { bytes_put(&vt->out, data, len); }

void nxt_paste(NxtVt* vt, const uint8_t* data, size_t len) {
  char* copy = malloc(len ? len : 1);
  if (!copy) return;
  memcpy(copy, data, len);
  int bracketed = nxt_mode(vt, 2004, 0);
  size_t needed = 0;
  ghostty_paste_encode(copy, len, bracketed, NULL, 0, &needed);
  uint8_t* buf = malloc(needed ? needed : 1);
  size_t n = 0;
  if (buf && ghostty_paste_encode(copy, len, bracketed, buf, needed, &n) == GHOSTTY_SUCCESS) bytes_put(&vt->out, buf, n);
  free(buf);
  free(copy);
}

static int ref_at(NxtVt* vt, uint16_t x, uint16_t y, GhosttyGridRef* ref) {
  GhosttyPoint p = {.tag = GHOSTTY_POINT_TAG_VIEWPORT, .value = {.coordinate = {.x = x, .y = y}}};
  *ref = (GhosttyGridRef){0};
  return ghostty_terminal_grid_ref(vt->term, p, ref) == GHOSTTY_SUCCESS;
}

static int word_between(NxtVt* vt, GhosttyGridRef a, GhosttyGridRef b, GhosttySelection* out) {
  GhosttyTerminalSelectWordBetweenOptions o = GHOSTTY_INIT_SIZED(GhosttyTerminalSelectWordBetweenOptions);
  o.start = a;
  o.end = b;
  return ghostty_terminal_select_word_between(vt->term, &o, out) == GHOSTTY_SUCCESS;
}

int nxt_select_words(NxtVt* vt, uint16_t x1, uint16_t y1, uint16_t x2, uint16_t y2) {
  GhosttyGridRef a, b;
  if (!ref_at(vt, x1, y1, &a) || !ref_at(vt, x2, y2, &b)) return 0;
  GhosttySelection first = {0}, last = {0};
  if (!word_between(vt, a, b, &first) || !word_between(vt, b, a, &last)) return 0;
  GhosttySelection sel = {0};
  int forward = y1 < y2 || (y1 == y2 && x1 <= x2);
  sel.start = forward ? first.start : last.start;
  sel.end = forward ? last.end : first.end;
  return ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_SELECTION, &sel) == GHOSTTY_SUCCESS;
}

void nxt_select_clear(NxtVt* vt) { ghostty_terminal_set(vt->term, GHOSTTY_TERMINAL_OPT_SELECTION, NULL); }

int64_t nxt_selection_text(NxtVt* vt) {
  GhosttySelection sel;
  if (ghostty_terminal_get(vt->term, GHOSTTY_TERMINAL_DATA_SELECTION, &sel) != GHOSTTY_SUCCESS) return -1;
  GhosttyFormatter f;
  if (ghostty_formatter_terminal_new(NULL, &f, vt->term) != GHOSTTY_SUCCESS) return -1;
  GhosttyFormatterFormat emit = GHOSTTY_FORMATTER_FORMAT_PLAIN;
  bool on = true;
  ghostty_formatter_set(f, GHOSTTY_FORMATTER_OPT_EMIT, &emit);
  ghostty_formatter_set(f, GHOSTTY_FORMATTER_OPT_TRIM, &on);
  ghostty_formatter_set(f, GHOSTTY_FORMATTER_OPT_UNWRAP, &on);
  ghostty_formatter_set(f, GHOSTTY_FORMATTER_OPT_SELECTION, &sel);
  uint8_t* buf = NULL;
  size_t len = 0;
  int64_t result = -1;
  if (ghostty_formatter_format_alloc(f, NULL, &buf, &len) == GHOSTTY_SUCCESS) {
    vt->str.len = 0;
    bytes_put(&vt->str, buf, len);
    ghostty_free(NULL, buf, len);
    result = (int64_t)len;
  }
  ghostty_formatter_free(f);
  return result;
}

