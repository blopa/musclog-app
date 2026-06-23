#include <gbdk/platform.h>
#include <gb/gb.h>
#include <gbdk/console.h>
#include <gbdk/font.h>
#include <stdio.h>
#include <string.h>

#include "copies.h"
#include "database.h"
#include "foodlog.h"
#include "input.h"
#include "rtc.h"
#include "logo.h"
#include "nutrition.h"
#include "onboarding.h"
#include "ui_text.h"

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

/* Home-screen action buttons. */
#define HOME_BTN_FOOD    0u
#define HOME_BTN_WORKOUT 1u

typedef struct HomeState {
    SaveData *data;
    uint8_t selected;
    uint8_t dirty;
} HomeState;

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

/* Draw a full-width action button with a cursor indicator. */
static void draw_button(uint8_t y, const char *label, uint8_t focused) {
    uint8_t pal = focused ? UI_PAL_SELECTED : UI_PAL_PANEL;
    ui_fill_attr(0u, y, 20u, 1u, pal);
    ui_print_at(1u, y, focused ? ">" : " ");
    ui_print_at(3u, y, label);
}

/* "Feature not yet available" screen; dismisses on B / A / Start. */
static void show_coming_soon(const char *feature) {
    InputState input;

    ui_title(STR_COMING_SOON);
    ui_print_center(6u, feature);
    ui_print_center(9u, STR_COMING_IN_A);
    ui_print_center(10u, STR_FUTURE_UPDATE);
    ui_footer(STR_FOOTER_BACK, "");

    input_init(&input);
    while (1) {
        wait_vbl_done();
        input_update(&input);
        if (input_pressed(&input, J_B | J_A | J_START)) return;
    }
}

/*
 * Home screen layout (20x18 tiles):
 *
 *  Row 0   MUSCLOG GB           ← header bar (PAL_HEADER)
 *  Row 1   HOME         DAY 0   ← screen label + day counter
 *  Row 2   --------------------
 *  Row 3   CALORIES
 *  Row 4    0 / 2510 KCAL
 *  Row 5   [==================] ← 18-wide calorie bar (cols 1-18)
 *  Row 6   PROTEIN      CARBS
 *  Row 7   0/188G       0/281G
 *  Row 8   [#######]  [#######] ← two 9-wide bars (cols 0-8, 11-19)
 *  Row 9   FAT          FIBER
 *  Row 10  0/69G        0/35G
 *  Row 11  [#######]  [#######]
 *  Row 12  --------------------
 *  Row 13  [> NUTRITION       ] ← button (PAL_SELECTED when focused, PAL_PANEL otherwise)
 *  Row 14  (spacer)
 *  Row 15  [> START WORKOUT   ] ← button
 *  Row 16  --------------------  ← via ui_footer
 *  Row 17  SEL+B RESET           ← via ui_footer
 */
static void draw_home(const HomeState *state) {
    const SaveData *d = state->data;
    char buf[22];
    char date_buf[9];  /* "MM-DD-YY\0" */
    CalDate today;
    uint16_t cal, pro, carb, fat, fib;
    uint16_t digestible_carb;

    today = cal_current_date(d);
    cal_format(&today, date_buf);

    /* Today's totals from the persisted food log. */
    foodlog_sum_day(cal_day_number(today), &cal, &pro, &carb, &fat, &fib);
    digestible_carb = foodlog_digestible_carbs(carb, fib);

    ui_clear();

    /* ── Header ── */
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);

    ui_print_at(1u, 1u, STR_HOME);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(date_buf)), 1u, date_buf);

    ui_print_at(0u, 2u, STR_DIVIDER);

    /* ── Calories ── */
    ui_print_at(1u, 3u, STR_CALORIES);
    sprintf(buf, "%u / %u KCAL", cal, d->calorie_goal);
    ui_print_at(1u, 4u, buf);
    ui_draw_bar(1u, 5u, 18u, ui_bar_fill(cal, d->calorie_goal, 18u));

    /* ── Protein + Carbs ── */
    ui_print_at(0u, 6u, STR_PROTEIN);
    ui_print_at(11u, 6u, STR_CARBS);
    sprintf(buf, "%u/%uG", pro, d->protein_goal);
    ui_print_at(0u, 7u, buf);
    sprintf(buf, "%u/%uG", digestible_carb, d->carbs_goal);
    ui_print_at(11u, 7u, buf);
    ui_draw_bar(0u, 8u, 9u, ui_bar_fill(pro, d->protein_goal, 9u));
    ui_draw_bar(11u, 8u, 9u, ui_bar_fill(digestible_carb, d->carbs_goal, 9u));

    /* ── Fat + Fiber ── */
    ui_print_at(0u, 9u, STR_FAT);
    ui_print_at(11u, 9u, STR_FIBER);
    sprintf(buf, "%u/%uG", fat, d->fat_goal);
    ui_print_at(0u, 10u, buf);
    sprintf(buf, "%u/%uG", fib, d->fiber_goal);
    ui_print_at(11u, 10u, buf);
    ui_draw_bar(0u, 11u, 9u, ui_bar_fill(fat, d->fat_goal, 9u));
    ui_draw_bar(11u, 11u, 9u, ui_bar_fill(fib, d->fiber_goal, 9u));

    ui_print_at(0u, 12u, STR_DIVIDER);

    /* ── Action buttons ── */
    draw_button(13u, STR_NUTRITION, state->selected == HOME_BTN_FOOD);
    draw_button(15u, STR_START_WORKOUT, state->selected == HOME_BTN_WORKOUT);

    ui_footer(STR_FOOTER_RESET, "");
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
            draw_home(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if ((input.current & J_SELECT) && input_pressed(&input, J_B)) {
            db_erase();
            foodlog_erase();
            onboarding_run(data);
            state.selected = HOME_BTN_FOOD;
            state.dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_UP) || input_pressed(&input, J_DOWN)) {
            state.selected = (state.selected == HOME_BTN_FOOD) ? HOME_BTN_WORKOUT : HOME_BTN_FOOD;
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_A | J_START)) {
            if (state.selected == HOME_BTN_FOOD) {
                nutrition_track(data);
            } else {
                show_coming_soon(STR_START_WORKOUT);
            }
            state.dirty = 1u;
        }
    }
}

void main(void) {
    SaveData save;

    show_splash();
    ui_init_text();

    if (!db_load(&save) || !save.onboarding_complete) {
        onboarding_run(&save);
    }

    foodlog_init();

    home_loop(&save);
}
