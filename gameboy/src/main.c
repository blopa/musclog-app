#include <gbdk/platform.h>
#include <gb/gb.h>
#include <gbdk/console.h>
#include <gbdk/font.h>
#include <stdio.h>
#include <string.h>

#include "audio.h"
#include "body_weight.h"
#include "copies.h"
#include "custom_foods.h"
#include "profile.h"
#include "foodlog.h"
#include "home_screen.h"
#include "input.h"
#include "metrics.h"
#include "logo.h"
#include "nutrition.h"
#include "progress.h"
#include "settings.h"
#include "start_screen.h"
#include "workoutlog.h"
#include "workouts.h"

/* The visible background is 20x18 tiles; center the 8x8-tile logo within it. */
#define SCREEN_TILE_W 20
#define SCREEN_TILE_H 18
#define ORIGIN_X ((SCREEN_TILE_W - logo_TILE_W) / 2) /* (20 - 8) / 2 = 6 */
#define ORIGIN_Y ((SCREEN_TILE_H - logo_TILE_H) / 2) /* (18 - 8) / 2 = 5 */

/* The app's dark-green surface color (theme token `green800` = #0d4a2d, "Deep green
 * surface"). The literal page background (swampGreen #091310) is so dark it reads as
 * pitch black on the Game Boy Color, so we use this clearly-green surface tone instead.
 * Loaded as CGB background palette 1; only color 0 is used (blank fill tile is all index 0). */
#define BG_PALETTE 1
static const palette_color_t bg_palette[4] = {
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
};

/* A solid tile of color index 0, filled around the logo. In the 2bpp tile format
 * index 0 = both bitplanes clear, so every byte is 0x00. Loaded past the logo tiles;
 * paired with BG_PALETTE so it shows the app background color. */
static const uint8_t blank_tile[16] = { 0 };

/* font_ibm loads 96 tiles (chars 0x20–0x7F). Logo tiles follow immediately after.
 * BLANK_TILE_SPLASH is the single solid-fill tile loaded after the logo tiles. */
#define LOGO_TILE_ORIGIN  96u
#define BLANK_TILE_SPLASH (LOGO_TILE_ORIGIN + logo_TILE_COUNT)

/* Position of the "MUSCLOG" label on the splash screen (row below the logo). */
#define TEXT_ROW_SPLASH 14u
#define TEXT_COL_SPLASH  7u  /* (20 - 7) / 2 + 1 = 7 */

/* CGB palette 2 for splash text: dark-green bg (index 0) + off-white text (index 3).
 * font_color(3,0) maps foreground→index 3, background→index 0. */
static const palette_color_t text_palette[4] = {
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0x0d, 0x4a, 0x2d),
    RGB8(0xf8, 0xff, 0xfa),
};

/* Attribute bytes (VRAM bank 1) for the 7 "MUSCLOG" text tiles → use palette 2. */
static const uint8_t text_attrs[7] = {2u, 2u, 2u, 2u, 2u, 2u, 2u};

static void show_splash(void) {
    uint8_t i;
    uint8_t logo_map_offset[64];
    font_t ibm_font;

    DISPLAY_OFF;

    /* Load IBM font first so tiles 0–95 hold the font glyphs.
     * Logo tiles follow at LOGO_TILE_ORIGIN (96) so they do not overlap. */
    font_init();
    font_color(3u, 0u);
    ibm_font = font_load(font_ibm);
    font_set(ibm_font);
    mode(get_mode() | M_NO_SCROLL);

    /* Palette 0 = logo colors; palette 1 = app bg; palette 2 = splash text. */
    set_bkg_palette(0, logo_PALETTE_COUNT, logo_palettes);
    set_bkg_palette(BG_PALETTE, 1u, bg_palette);
    set_bkg_palette(2u, 1u, text_palette);

    /* Logo tiles after the font (tile 96+), blank fill tile after logo. */
    set_bkg_data((uint8_t)LOGO_TILE_ORIGIN, logo_TILE_COUNT, logo_tiles);
    set_bkg_data((uint8_t)BLANK_TILE_SPLASH, 1u, blank_tile);

    /* Remap logo_map indices to the new tile origin. */
    for (i = 0u; i != 64u; ++i) {
        logo_map_offset[i] = logo_map[i] + LOGO_TILE_ORIGIN;
    }

    /* Clear the whole background: blank fill tile, app-background palette. */
    VBK_REG = 1;
    init_bkg(BG_PALETTE);
    VBK_REG = 0;
    init_bkg((uint8_t)BLANK_TILE_SPLASH);

    /* Draw logo tiles. */
    VBK_REG = 1;
    set_bkg_tiles(ORIGIN_X, ORIGIN_Y, logo_TILE_W, logo_TILE_H, logo_map_attributes);
    VBK_REG = 0;
    set_bkg_tiles(ORIGIN_X, ORIGIN_Y, logo_TILE_W, logo_TILE_H, logo_map_offset);

    /* Set palette-2 attributes for the "MUSCLOG" text tiles, then write them. */
    VBK_REG = 1;
    set_bkg_tiles(TEXT_COL_SPLASH, TEXT_ROW_SPLASH, 7u, 1u, text_attrs);
    VBK_REG = 0;
    gotoxy(TEXT_COL_SPLASH, TEXT_ROW_SPLASH);
    puts(STR_APP_NAME);

    SHOW_BKG;
    DISPLAY_ON;

    for (i = 0u; i != 90u; ++i) {
        wait_vbl_done();
    }
}

static void home_loop(SaveData *data) {
    HomeState state;
    InputState input;

    state.data = data;
    state.selected = HOME_BTN_FOOD;
    state.dirty = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            home_draw(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_SELECT)) {
            if (settings_menu(data)) {
                state.selected = HOME_BTN_FOOD;
            }
            state.dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_UP)) {
            state.selected = (state.selected == HOME_BTN_FOOD)
                ? (uint8_t)(HOME_BTN_COUNT - 1u) : (uint8_t)(state.selected - 1u);
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_DOWN)) {
            state.selected = (uint8_t)((state.selected + 1u) % HOME_BTN_COUNT);
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_A | J_START)) {
            if (state.selected == HOME_BTN_FOOD) {
                nutrition_track(data);
            } else if (state.selected == HOME_BTN_WORKOUT) {
                workouts_show(data);
            } else if (state.selected == HOME_BTN_WEIGHT) {
                body_weight_show(data);
            } else {
                progress_show(data);
            }
            state.dirty = 1u;
        }
    }
}

void main(void) {
    SaveData save;

    /* Power on the APU and load the persisted SFX/soundtrack toggles before any
     * screen can request a blip or the title-screen soundtrack. */
    audio_init();

    show_splash();

    {
        /* The start screen shows the title art with New Game / Continue, handles the
         * erase-confirm and onboarding, and leaves the text UI ready for the home loop. */
        uint8_t had_valid_save = db_load(&save);
        start_screen_run(&save, had_valid_save);
    }

    foodlog_init();
    workoutlog_init();
    metrics_init();
    custom_foods_init();

    home_loop(&save);
}
