#ifndef MUSCLOG_UI_TEXT_H
#define MUSCLOG_UI_TEXT_H

#include <stdint.h>

#define UI_PAL_NORMAL 0u
#define UI_PAL_HEADER 1u
#define UI_PAL_SELECTED 2u
#define UI_PAL_PANEL 3u

void ui_init_text(void);
void ui_clear(void);
void ui_fill_attr(uint8_t x, uint8_t y, uint8_t w, uint8_t h, uint8_t palette);
void ui_title(const char *title);
void ui_footer(const char *left, const char *right);
void ui_print_at(uint8_t x, uint8_t y, const char *text);
void ui_print_center(uint8_t y, const char *text);
void ui_draw_menu(const char *title, const char **options, uint8_t count, uint8_t selected);
void ui_draw_value_screen(const char *title, const char *label, const char *value, const char *hint);

#endif
