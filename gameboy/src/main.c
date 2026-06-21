#include <gbdk/platform.h>
#include <gb/gb.h>
#include <gbdk/console.h>
#include <stdio.h>
#include <string.h>

#include "input.h"
#include "logo.h"
#include "onboarding.h"
#include "storage.h"
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
#define BLANK_TILE logo_TILE_COUNT
static const uint8_t blank_tile[16] = { 0 };

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

    DISPLAY_OFF;

    /* Palette 0 = logo colors; palette 1 = the app background color. */
    set_bkg_palette(0, logo_PALETTE_COUNT, logo_palettes);
    set_bkg_palette(BG_PALETTE, 1, bg_palette);
    set_bkg_data(0, logo_TILE_COUNT, logo_tiles);
    set_bkg_data(BLANK_TILE, 1, blank_tile);

    /* Clear the whole background to the blank tile on the app-background palette before
     * drawing the logo, so the area around it is the app's dark-green page color.
     * The attribute map lives in VRAM bank 1, the tile indices in bank 0. */
    VBK_REG = 1;
    init_bkg(BG_PALETTE); /* every tile -> app background palette */
    VBK_REG = 0;
    init_bkg(BLANK_TILE);

    VBK_REG = 1;
    set_bkg_tiles(ORIGIN_X, ORIGIN_Y, logo_TILE_W, logo_TILE_H, logo_map_attributes);
    VBK_REG = 0;
    set_bkg_tiles(ORIGIN_X, ORIGIN_Y, logo_TILE_W, logo_TILE_H, logo_map);

    SHOW_BKG;
    DISPLAY_ON;

    for (i = 0u; i != 90u; ++i) {
        wait_vbl_done();
    }
}

/* Return how many of `width` tiles should be filled for a progress bar. */
static uint8_t bar_fill(uint16_t tracked, uint16_t goal, uint8_t width) {
    if (goal == 0u || tracked == 0u) return 0u;
    if (tracked >= goal) return width;
    return (uint8_t)(((uint32_t)tracked * width + (uint32_t)(goal >> 1u)) / goal);
}

/* Draw a horizontal progress bar using palette coloring on blank (space) tiles.
 * Must be called after ui_clear() so tiles in the bar row are already spaces. */
static void draw_bar(uint8_t x, uint8_t y, uint8_t width, uint8_t fill) {
    if (fill > width) fill = width;
    if (fill > 0u)
        ui_fill_attr(x, y, fill, 1u, UI_PAL_SELECTED);
    if (fill < width)
        ui_fill_attr((uint8_t)(x + fill), y, (uint8_t)(width - fill), 1u, UI_PAL_PANEL);
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

    ui_title("COMING SOON");
    ui_print_center(6u, feature);
    ui_print_center(9u, "COMING IN A");
    ui_print_center(10u, "FUTURE UPDATE");
    ui_footer("B BACK", "");

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
 *  Row 13  [> TRACK FOOD      ] ← button (PAL_SELECTED when focused, PAL_PANEL otherwise)
 *  Row 14  (spacer)
 *  Row 15  [> START WORKOUT   ] ← button
 *  Row 16  --------------------  ← via ui_footer
 *  Row 17  SEL+B RESET           ← via ui_footer
 */
static void draw_home(const HomeState *state) {
    const SaveData *d = state->data;
    char buf[22];
    /* Tracked values are 0 until food/workout logging is implemented. */
    uint16_t cal = 0u, pro = 0u, carb = 0u, fat = 0u, fib = 0u;

    ui_clear();

    /* ── Header ── */
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, "MUSCLOG GB");

    ui_print_at(1u, 1u, "HOME");
    sprintf(buf, "DAY %u", d->day_counter);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(buf)), 1u, buf);

    ui_print_at(0u, 2u, "--------------------");

    /* ── Calories ── */
    ui_print_at(1u, 3u, "CALORIES");
    sprintf(buf, "%u / %u KCAL", cal, d->calorie_goal);
    ui_print_at(1u, 4u, buf);
    draw_bar(1u, 5u, 18u, bar_fill(cal, d->calorie_goal, 18u));

    /* ── Protein + Carbs ── */
    ui_print_at(0u, 6u, "PROTEIN");
    ui_print_at(11u, 6u, "CARBS");
    sprintf(buf, "%u/%uG", pro, d->protein_goal);
    ui_print_at(0u, 7u, buf);
    sprintf(buf, "%u/%uG", carb, d->carbs_goal);
    ui_print_at(11u, 7u, buf);
    draw_bar(0u, 8u, 9u, bar_fill(pro, d->protein_goal, 9u));
    draw_bar(11u, 8u, 9u, bar_fill(carb, d->carbs_goal, 9u));

    /* ── Fat + Fiber ── */
    ui_print_at(0u, 9u, "FAT");
    ui_print_at(11u, 9u, "FIBER");
    sprintf(buf, "%u/%uG", fat, d->fat_goal);
    ui_print_at(0u, 10u, buf);
    sprintf(buf, "%u/%uG", fib, d->fiber_goal);
    ui_print_at(11u, 10u, buf);
    draw_bar(0u, 11u, 9u, bar_fill(fat, d->fat_goal, 9u));
    draw_bar(11u, 11u, 9u, bar_fill(fib, d->fiber_goal, 9u));

    ui_print_at(0u, 12u, "--------------------");

    /* ── Action buttons ── */
    draw_button(13u, "TRACK FOOD", state->selected == HOME_BTN_FOOD);
    draw_button(15u, "START WORKOUT", state->selected == HOME_BTN_WORKOUT);

    ui_footer("SEL+B RESET", "");
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
            storage_erase();
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
                show_coming_soon("TRACK FOOD");
            } else {
                show_coming_soon("START WORKOUT");
            }
            state.dirty = 1u;
        }
    }
}

void main(void) {
    SaveData save;

    show_splash();
    ui_init_text();

    if (!storage_load(&save) || !save.onboarding_complete) {
        onboarding_run(&save);
    }

    home_loop(&save);
}
