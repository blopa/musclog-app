#include "ui_text.h"

#include "copies.h"
#include <gb/gb.h>
#include <gbdk/console.h>
#include <gbdk/font.h>
#include <gbdk/platform.h>
#include <stdio.h>
#include <string.h>

#include "input.h"

#define SCREEN_COLS 20u
#define SCREEN_ROWS 18u

static const palette_color_t ui_palettes[16] = {
    /* Normal: Musclog green surface with off-white text. */
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x09, 0x13, 0x10),
    RGB8(0x95, 0xc7, 0xa8),
    RGB8(0xf8, 0xff, 0xfa),
    /* Header: dark-green strip with off-white text. */
    RGB8(0x06, 0x2e, 0x1b),
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
    uint8_t attrs[SCREEN_COLS];
    uint8_t i;

    if (w > SCREEN_COLS) w = SCREEN_COLS;
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
    ui_print_center(0u, STR_APP_TITLE);
    ui_print_center(2u, title);
    ui_print_at(0u, 3u, STR_DIVIDER);
}

void ui_footer(const char *left, const char *right) {
    uint8_t len;
    uint8_t x;

    ui_print_at(0u, 16u, STR_DIVIDER);
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
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_OK);
}

void ui_draw_value_screen(const char *title, const char *label, const char *value, const char *hint) {
    ui_title(title);
    ui_print_center(6u, label);
    ui_print_center(8u, value);
    ui_print_center(11u, hint);
    ui_print_center(13u, STR_HINT_LEFT_RIGHT_FAST);
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_OK);
}

uint8_t ui_confirm(const char *title, const char *message) {
    InputState input;

    ui_title(title);
    ui_print_center(8u, message);
    ui_footer(STR_FOOTER_CANCEL, STR_FOOTER_OK);

    input_init(&input);
    while (1) {
        wait_vbl_done();
        input_update(&input);
        if (input_pressed(&input, J_A | J_START)) return 1u;
        if (input_pressed(&input, J_B)) return 0u;
    }
}

uint8_t ui_bar_fill(uint16_t tracked, uint16_t goal, uint8_t width) {
    if (goal == 0u || tracked == 0u) return 0u;
    if (tracked >= goal) return width;
    return (uint8_t)(((uint32_t)tracked * width + (uint32_t)(goal >> 1u)) / goal);
}

void ui_draw_bar(uint8_t x, uint8_t y, uint8_t width, uint8_t fill) {
    if (fill > width) fill = width;
    if (fill > 0u)
        ui_fill_attr(x, y, fill, 1u, UI_PAL_SELECTED);
    if (fill < width)
        ui_fill_attr((uint8_t)(x + fill), y, (uint8_t)(width - fill), 1u, UI_PAL_PANEL);
}

/*
 * Shared renderer for date/datetime picker screens.
 * Draws the title, hint, and n_fields labelled rows starting at tile row 7.
 * Each field row shows `labels[i]` on the left and `values[i]` right-aligned
 * at column `cols[i]`.  The active field is highlighted with UI_PAL_SELECTED.
 * Footer is NOT drawn here — caller adds it.
 *
 * Layout (rows):
 *   0  header "MUSCLOG GB"  PAL_HEADER
 *   2  title (centered)
 *   3  "--------------------"
 *   5  hint text
 *   7+ one row per field
 */
static void draw_picker_rows(const char *title, uint8_t n_fields, uint8_t active,
                             const char * const *labels,
                             const char * const *values,
                             const uint8_t *cols) {
    uint8_t i;
    uint8_t row;
    uint8_t pal;

    ui_title(title);
    ui_print_center(5u, STR_HINT_FIELD_SET);

    for (i = 0u; i != n_fields; ++i) {
        row = (uint8_t)(7u + i);
        pal = (i == active) ? UI_PAL_SELECTED : UI_PAL_PANEL;
        ui_fill_attr(0u, row, SCREEN_COLS, 1u, pal);
        ui_print_at(1u, row, (i == active) ? ">" : " ");
        ui_print_at(3u, row, labels[i]);
        ui_print_at(cols[i], row, values[i]);
    }
}

/* Format a two-digit value (0-99) as "DD\0" into buf (must be >= 3 bytes). */
static void fmt2(char *buf, uint8_t v) {
    buf[0] = (char)('0' + v / 10u);
    buf[1] = (char)('0' + v % 10u);
    buf[2] = '\0';
}

void ui_draw_date_picker(const char *title, uint8_t field,
                         uint16_t year, uint8_t month, uint8_t day) {
    char year_buf[5];
    char month_buf[3];
    char day_buf[3];
    const char *labels[3];
    const char *values[3];
    uint8_t     cols[3];

    year_buf[0] = (char)('0' + (year / 1000u) % 10u);
    year_buf[1] = (char)('0' + (year / 100u)  % 10u);
    year_buf[2] = (char)('0' + (year / 10u)   % 10u);
    year_buf[3] = (char)('0' +  year           % 10u);
    year_buf[4] = '\0';
    fmt2(month_buf, month);
    fmt2(day_buf, day);

    labels[0] = STR_YEAR;  values[0] = year_buf;  cols[0] = 16u;
    labels[1] = STR_MONTH; values[1] = month_buf; cols[1] = 18u;
    labels[2] = STR_DAY;   values[2] = day_buf;   cols[2] = 18u;

    draw_picker_rows(title, 3u, field, labels, values, cols);
}

void ui_draw_datetime_picker(const char *title, uint8_t field,
                             uint16_t year, uint8_t month, uint8_t day,
                             uint8_t hour, uint8_t minute) {
    char year_buf[5];
    char month_buf[3];
    char day_buf[3];
    char hour_buf[3];
    char minute_buf[3];
    const char *labels[5];
    const char *values[5];
    uint8_t     cols[5];

    year_buf[0] = (char)('0' + (year / 1000u) % 10u);
    year_buf[1] = (char)('0' + (year / 100u)  % 10u);
    year_buf[2] = (char)('0' + (year / 10u)   % 10u);
    year_buf[3] = (char)('0' +  year           % 10u);
    year_buf[4] = '\0';
    fmt2(month_buf, month);
    fmt2(day_buf, day);
    fmt2(hour_buf, hour);
    fmt2(minute_buf, minute);

    labels[0] = STR_YEAR;   values[0] = year_buf;   cols[0] = 16u;
    labels[1] = STR_MONTH;  values[1] = month_buf;  cols[1] = 18u;
    labels[2] = STR_DAY;    values[2] = day_buf;    cols[2] = 18u;
    labels[3] = STR_HOUR;   values[3] = hour_buf;   cols[3] = 18u;
    labels[4] = STR_MINUTE; values[4] = minute_buf; cols[4] = 18u;

    draw_picker_rows(title, 5u, field, labels, values, cols);
}
