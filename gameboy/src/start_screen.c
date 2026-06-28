#pragma bank 8

#include <gb/gb.h>
#include <gbdk/font.h>
#include <gbdk/platform.h>
#include <string.h>

#include "start_screen.h"

#include "copies.h"
#include "custom_foods.h"
#include "foodlog.h"
#include "gb_background.h"
#include "input.h"
#include "metrics.h"
#include "onboarding.h"
#include "profile.h"
#include "ui_text.h"
#include "workoutlog.h"

/* The title art and this code share ROM bank 8 (set above + via png2asset -b 8),
 * so the art tables are read directly here without a SWITCH_ROM. */

#define ST_COLS 20u
#define ST_ROWS 18u

/* CGB background palettes:
 *   0 = the title-art palette (emitted by png2asset).
 *   1 = floating menu text — background is the art's darkest color (index 0) so the
 *       text blends into the dark lower band, foreground is the art's white (index 2). */
#define PAL_ART  0u
#define PAL_TEXT 1u

/* The image tiles are uploaded to VRAM bank 1 (the font occupies bank 0), so every
 * art cell's attribute carries this "tile VRAM bank 1" bit. Text cells clear it to
 * read the font glyphs from VRAM bank 0 instead. */
#define ATTR_BANK1 0x08u

/* Lower band reserved for the menu / confirm text (tile rows). The bottom third of
 * the art is ~95% the darkest palette color, so PAL_TEXT cells float over it. */
#define BAND_Y 12u
#define BAND_H 5u

#define OPT_CURSOR_X 5u
#define OPT_TEXT_X   7u

/* Menu rows. */
#define ROW_OPT0    13u
#define ROW_OPT1    14u
/* Confirm rows. */
#define ROW_CONFIRM_Q  13u
#define ROW_CONFIRM_YN 15u

#define ST_STATE_MENU    0u
#define ST_STATE_CONFIRM 1u

/* Write a 1-row run of CGB attribute bytes (palette + flags) at the given cell. */
static void st_attr_row(uint8_t x, uint8_t y, uint8_t w, uint8_t value) {
    uint8_t attrs[ST_COLS];
    uint8_t i;

    if (w > ST_COLS) w = ST_COLS;
    for (i = 0u; i != w; ++i) {
        attrs[i] = value;
    }

    VBK_REG = 1u;
    set_bkg_tiles(x, y, w, 1u, attrs);
    VBK_REG = 0u;
}

/* Draw floating text by writing font glyph tiles directly into the bank-0 tile
 * plane (the IBM font loads ASCII 0x20-0x7F into tiles 0-95, so glyph = c - 0x20)
 * and setting each cell to PAL_TEXT (bank-0 tile data = font). The GBDK console
 * (gotoxy/setchar) is avoided on purpose: it tracks its own cursor/margins and
 * does not place glyphs reliably over a directly-painted background map. */
static void st_text(uint8_t x, uint8_t y, const char *s) {
    uint8_t tiles[ST_COLS];
    uint8_t len = (uint8_t)strlen(s);
    uint8_t i;

    if ((uint8_t)(x + len) > ST_COLS) {
        len = (uint8_t)(ST_COLS - x);
    }
    for (i = 0u; i != len; ++i) {
        tiles[i] = (uint8_t)((uint8_t)s[i] - 0x20u);
    }

    VBK_REG = 0u;
    set_bkg_tiles(x, y, len, 1u, tiles);
    st_attr_row(x, y, len, PAL_TEXT);
}

/* Paint one row of the title art: tile indices (bank-0 plane) + attributes with the
 * VRAM-bank-1 bit so they reference the uploaded image tiles. */
static void st_paint_art_row(uint8_t y) {
    const uint8_t *map_row = &gb_background_map[(uint16_t)y * ST_COLS];
    const uint8_t *attr_row = &gb_background_map_attributes[(uint16_t)y * ST_COLS];
    uint8_t attrs[ST_COLS];
    uint8_t x;

    VBK_REG = 0u;
    set_bkg_tiles(0u, y, ST_COLS, 1u, map_row);

    for (x = 0u; x != ST_COLS; ++x) {
        attrs[x] = (uint8_t)(attr_row[x] | ATTR_BANK1);
    }
    VBK_REG = 1u;
    set_bkg_tiles(0u, y, ST_COLS, 1u, attrs);
    VBK_REG = 0u;
}

/* Restore the menu band back to the underlying art, clearing any previous text. */
static void st_restore_band(void) {
    uint8_t y;

    for (y = BAND_Y; y != (uint8_t)(BAND_Y + BAND_H); ++y) {
        st_paint_art_row(y);
    }
}

static void st_setup_graphics(void) {
    palette_color_t text_palette[4];
    font_t font;
    uint8_t y;

    DISPLAY_OFF;

    /* Palette 0 = the art; palette 1 = floating text (dark bg, white fg). */
    set_bkg_palette(PAL_ART, gb_background_PALETTE_COUNT, gb_background_palettes);
    text_palette[0] = gb_background_palettes[0];
    text_palette[1] = gb_background_palettes[0];
    text_palette[2] = gb_background_palettes[0];
    text_palette[3] = gb_background_palettes[2];
    set_bkg_palette(PAL_TEXT, 1u, text_palette);

    /* Font into VRAM bank 0 (tiles 0-95); glyph foreground = index 3, background = 0. */
    font_init();
    font_color(3u, 0u);
    font = font_load(font_ibm);
    font_set(font);
    mode(get_mode() | M_NO_SCROLL);

    /* Art tiles into VRAM bank 1 so they do not collide with the bank-0 font. */
    VBK_REG = 1u;
    set_bkg_data(0u, gb_background_TILE_COUNT, gb_background_tiles);
    VBK_REG = 0u;

    for (y = 0u; y != ST_ROWS; ++y) {
        st_paint_art_row(y);
    }

    SHOW_BKG;
    DISPLAY_ON;
}

static void st_draw_option(uint8_t y, const char *label, uint8_t focused) {
    st_text(OPT_CURSOR_X, y, focused ? ">" : " ");
    st_text(OPT_TEXT_X, y, label);
}

static void st_center(uint8_t y, const char *s) {
    uint8_t len = (uint8_t)strlen(s);
    uint8_t x = (uint8_t)((ST_COLS - len) / 2u);

    st_text(x, y, s);
}

static void st_render(uint8_t state, uint8_t has_save, uint8_t selected) {
    st_restore_band();

    if (state == ST_STATE_CONFIRM) {
        st_center(ROW_CONFIRM_Q, STR_NEW_GAME_Q);
        st_center(ROW_CONFIRM_YN, STR_START_YESNO);
    } else if (has_save) {
        st_draw_option(ROW_OPT0, STR_CONTINUE, (uint8_t)(selected == 0u));
        st_draw_option(ROW_OPT1, STR_NEW_GAME, (uint8_t)(selected == 1u));
    } else {
        st_draw_option(ROW_OPT0, STR_NEW_GAME, 1u);
    }
}

void start_screen_run(SaveData *save, uint8_t had_valid_save) BANKED {
    /* A completed save is required before CONTINUE is offered. A valid-but-incomplete
     * save (e.g. a pre-seeded RTC from the web emulator) still counts as "no save"
     * here — NEW GAME just runs onboarding, preserving the RTC. */
    uint8_t has_save = (uint8_t)(had_valid_save && save->onboarding_complete);
    uint8_t selected = 0u;
    uint8_t state = ST_STATE_MENU;
    uint8_t dirty = 1u;
    uint8_t go_onboard = 0u;
    uint8_t done = 0u;
    InputState input;

    st_setup_graphics();
    input_init(&input);

    while (!done) {
        if (dirty) {
            st_render(state, has_save, selected);
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (state == ST_STATE_MENU) {
            if (has_save && input_pressed(&input, J_UP | J_DOWN)) {
                selected ^= 1u;
                dirty = 1u;
            }
            if (input_pressed(&input, J_A | J_START)) {
                if (has_save && selected == 0u) {
                    done = 1u; /* CONTINUE — keep the loaded save, go home. */
                } else if (has_save) {
                    state = ST_STATE_CONFIRM; /* NEW GAME over an existing save. */
                    dirty = 1u;
                } else {
                    go_onboard = 1u; /* NEW GAME, fresh install. */
                    done = 1u;
                }
            }
        } else {
            if (input_pressed(&input, J_A | J_START)) {
                db_erase();
                foodlog_erase();
                workoutlog_erase();
                metrics_erase();
                custom_foods_erase();
                go_onboard = 1u;
                done = 1u;
            } else if (input_pressed(&input, J_B)) {
                state = ST_STATE_MENU; /* Cancelled — back to the menu. */
                dirty = 1u;
            }
        }
    }

    /* Hand the screen back to the text UI that onboarding and home expect. */
    ui_init_text();

    if (go_onboard) {
        /* The confirm path erased everything (nothing to preserve); the fresh path
         * forwards had_valid_save so a pre-seeded RTC date survives. */
        onboarding_run(save, (uint8_t)(has_save ? 0u : had_valid_save));
    }
}
