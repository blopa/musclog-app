#ifndef MUSCLOG_UI_TEXT_H
#define MUSCLOG_UI_TEXT_H

#include <gb/gb.h>
#include <stdint.h>

#include "input.h"

#define UI_PAL_NORMAL 0u
#define UI_PAL_HEADER 1u
#define UI_PAL_SELECTED 2u
#define UI_PAL_PANEL 3u

void ui_init_text(void);
void ui_input_update(InputState *input);
void ui_clear(void);
void ui_fill_attr(uint8_t x, uint8_t y, uint8_t w, uint8_t h, uint8_t palette);
void ui_title(const char *title);
void ui_footer(const char *left, const char *right);
void ui_print_at(uint8_t x, uint8_t y, const char *text);
void ui_print_center(uint8_t y, const char *text);
void ui_clear_row(uint8_t y);
void ui_present(void);
void ui_draw_menu(const char *title, const char **options, uint8_t count, uint8_t selected);

/*
 * Run a full vertical-menu input loop: renders via ui_draw_menu, moves the
 * selection with up/down (wrapping), confirms with A/Start, cancels with B.
 * Returns the selected option index, or UI_MENU_CANCEL on cancel. This is the
 * single home of the menu loop that screens used to copy by hand.
 */
#define UI_MENU_CANCEL 0xFFu
uint8_t ui_menu_select(const char *title, const char **options, uint8_t count);
void ui_draw_value_screen(const char *title, const char *label, const char *value, const char *hint);

/*
 * Full-screen yes/no confirmation. Clears to its own screen with `title` in the
 * header, `message` centered, and a "B CANCEL / A-ST OK" footer; runs its own
 * input loop. Returns 1 if confirmed (A/Start), 0 if cancelled (B). The caller
 * owns redrawing whatever screen it was showing afterwards.
 */
uint8_t ui_confirm(const char *title, const char *message);

/*
 * Blocking storage-full info screen. Shows `title` as the screen heading with
 * `line1` and `line2` as body text, then waits for any button press to dismiss.
 * Use when an add operation is blocked by a capacity limit.
 */
void ui_storage_full(const char *title, const char *line1, const char *line2) BANKED;

/* Progress bar primitives shared by all screens. */
uint8_t ui_bar_fill(uint16_t tracked, uint16_t goal, uint8_t width);
void    ui_draw_bar(uint8_t x, uint8_t y, uint8_t width, uint8_t fill);

/*
 * Draw a 3-field year/month/day date picker.
 * field: 0=YEAR, 1=MONTH, 2=DAY (currently selected, shown with PAL_SELECTED).
 * Does NOT draw the footer — call ui_footer() after.
 */
void ui_draw_date_picker(const char *title, uint8_t field,
                         uint16_t year, uint8_t month, uint8_t day);

/*
 * Draw a 5-field year/month/day/hour/minute datetime picker.
 * field: 0=YEAR 1=MONTH 2=DAY 3=HOUR 4=MINUTE (selected = PAL_SELECTED).
 * Does NOT draw the footer — call ui_footer() after.
 */
void ui_draw_datetime_picker(const char *title, uint8_t field,
                             uint16_t year, uint8_t month, uint8_t day,
                             uint8_t hour, uint8_t minute);

#endif
