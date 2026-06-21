#include "ui_text.h"

#include <gb/gb.h>
#include <gbdk/console.h>
#include <gbdk/font.h>
#include <gbdk/platform.h>
#include <stdio.h>
#include <string.h>

#define SCREEN_COLS 20u
#define SCREEN_ROWS 18u

static const palette_color_t ui_palettes[16] = {
    /* Normal: Musclog green surface with off-white text. */
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x09, 0x13, 0x10),
    RGB8(0x95, 0xc7, 0xa8),
    RGB8(0xf8, 0xff, 0xfa),
    /* Header: obsidian strip with off-white text. */
    RGB8(0x09, 0x13, 0x10),
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x95, 0xc7, 0xa8),
    RGB8(0xf8, 0xff, 0xfa),
    /* Selected: lime fill with dark text. */
    RGB8(0xb8, 0xe9, 0x6a),
    RGB8(0x95, 0xc7, 0xa8),
    RGB8(0x1f, 0x4f, 0x35),
    RGB8(0x09, 0x13, 0x10),
    /* Panel: pale card with dark text. */
    RGB8(0xf1, 0xff, 0xd7),
    RGB8(0xb8, 0xe9, 0x6a),
    RGB8(0x95, 0xc7, 0xa8),
    RGB8(0x09, 0x13, 0x10),
};

static void set_attr_row(uint8_t x, uint8_t y, uint8_t w, uint8_t palette) {
    uint8_t attrs[20];
    uint8_t i;

    for (i = 0u; i != w; ++i) {
        attrs[i] = palette;
    }

    VBK_REG = 1u;
    set_bkg_tiles(x, y, w, 1u, attrs);
    VBK_REG = 0u;
}

void ui_init_text(void) {
    font_t font;

    DISPLAY_OFF;
    set_bkg_palette(0u, 4u, ui_palettes);

    /*
     * The splash uses CGB background palette 1 for the green field and palette 0
     * for the logo square. Reset the whole attribute map to palette 0 before
     * switching to console text, otherwise text outside the old logo square is
     * drawn green-on-green and appears invisible.
     */
    VBK_REG = 1u;
    init_bkg(0u);
    VBK_REG = 0u;

    font_init();
    font_color(3u, 0u);
    font = font_load(font_ibm);
    font_set(font);
    mode(get_mode() | M_NO_SCROLL);
    SHOW_BKG;
    DISPLAY_ON;
    cls();
    ui_fill_attr(0u, 0u, SCREEN_COLS, SCREEN_ROWS, UI_PAL_NORMAL);
}

void ui_clear(void) {
    cls();
    ui_fill_attr(0u, 0u, SCREEN_COLS, SCREEN_ROWS, UI_PAL_NORMAL);
}

void ui_fill_attr(uint8_t x, uint8_t y, uint8_t w, uint8_t h, uint8_t palette) {
    uint8_t row;

    for (row = 0u; row != h; ++row) {
        set_attr_row(x, (uint8_t)(y + row), w, palette);
    }
}

void ui_print_at(uint8_t x, uint8_t y, const char *text) {
    uint8_t i = 0u;

    while (text[i] && (uint8_t)(x + i) < SCREEN_COLS) {
        gotoxy((uint8_t)(x + i), y);
        setchar(text[i]);
        ++i;
    }
}

void ui_print_center(uint8_t y, const char *text) {
    uint8_t len = (uint8_t)strlen(text);
    uint8_t x = 0u;

    if (len < SCREEN_COLS) {
        x = (uint8_t)((SCREEN_COLS - len) / 2u);
    }

    ui_print_at(x, y, text);
}

void ui_title(const char *title) {
    ui_clear();
    ui_fill_attr(0u, 0u, SCREEN_COLS, 1u, UI_PAL_HEADER);
    ui_print_center(0u, "MUSCLOG GB");
    ui_print_center(2u, title);
    ui_print_at(0u, 3u, "--------------------");
}

void ui_footer(const char *left, const char *right) {
    uint8_t len;
    uint8_t x;

    ui_print_at(0u, 16u, "--------------------");
    ui_print_at(0u, 17u, "                    ");

    if (left && left[0]) {
        ui_print_at(0u, 17u, left);
    }

    if (right && right[0]) {
        len = (uint8_t)strlen(right);
        x = len < SCREEN_COLS ? (uint8_t)(SCREEN_COLS - len) : 0u;
        ui_print_at(x, 17u, right);
    }
}

void ui_draw_menu(const char *title, const char **options, uint8_t count, uint8_t selected) {
    uint8_t i;

    ui_title(title);
    for (i = 0u; i != count; ++i) {
        ui_print_at(1u, (uint8_t)(5u + i), i == selected ? ">" : " ");
        ui_print_at(3u, (uint8_t)(5u + i), options[i]);
    }
    ui_footer("B BACK", "A/ST OK");
}

void ui_draw_value_screen(const char *title, const char *label, const char *value, const char *hint) {
    ui_title(title);
    ui_print_center(6u, label);
    ui_print_center(8u, value);
    ui_print_center(11u, hint);
    ui_print_center(13u, "LEFT/RIGHT FAST");
    ui_footer("B BACK", "A/ST OK");
}
