#include "nutrition.h"

#include <gb/gb.h>
#include <gbdk/console.h>
#include <stdio.h>
#include <string.h>

#include "input.h"
#include "ui_text.h"

/* ── Mock food data (const = ROM) ── */
typedef struct MockFood {
    char name[13];   /* 12 visible chars + null terminator */
    uint16_t kcal;
    uint8_t protein;
    uint8_t carbs;
    uint8_t fat;
    uint8_t fiber;
} MockFood;

static const MockFood MOCK_FOODS[6] = {
    {"CHICKEN     ", 580u, 52u, 18u, 28u, 0u},
    {"RICE BOWL   ", 200u,  4u, 44u,  1u, 1u},
    {"PROT. SHAKE ", 150u, 25u,  8u,  3u, 0u},
    {"EGGS X2     ", 140u, 12u,  1u, 10u, 0u},
    {"GREEK YOGURT", 100u, 10u,  8u,  0u, 0u},
    {"BANANA      ",  89u,  1u, 23u,  0u, 2u},
};

/* Day 0 → foods 0-3, Day 1 → foods 4-5, Day 2+ → empty */
static uint8_t day_food_start(uint8_t day) {
    if (day == 0u) return 0u;
    if (day == 1u) return 4u;
    return 6u;
}

static uint8_t day_food_end(uint8_t day) {
    if (day == 0u) return 4u;
    if (day == 1u) return 6u;
    return 6u;
}

static uint8_t get_day_food_count(uint8_t day) {
    return (uint8_t)(day_food_end(day) - day_food_start(day));
}

static const MockFood *get_day_food(uint8_t day, uint8_t idx) {
    return &MOCK_FOODS[day_food_start(day) + idx];
}

static void sum_day_macros(uint8_t day,
                            uint16_t *cal, uint16_t *pro,
                            uint16_t *carb, uint16_t *fat, uint16_t *fib) {
    uint8_t i;
    uint8_t count = get_day_food_count(day);
    const MockFood *f;

    *cal = 0u; *pro = 0u; *carb = 0u; *fat = 0u; *fib = 0u;
    for (i = 0u; i != count; ++i) {
        f = get_day_food(day, i);
        *cal  += f->kcal;
        *pro  += (uint16_t)f->protein;
        *carb += (uint16_t)f->carbs;
        *fat  += (uint16_t)f->fat;
        *fib  += (uint16_t)f->fiber;
    }
}

/* ── Progress bar helpers ── */
static uint8_t bar_fill(uint16_t tracked, uint16_t goal, uint8_t width) {
    if (goal == 0u || tracked == 0u) return 0u;
    if (tracked >= goal) return width;
    return (uint8_t)(((uint32_t)tracked * width + (uint32_t)(goal >> 1u)) / goal);
}

static void draw_bar(uint8_t x, uint8_t y, uint8_t width, uint8_t fill) {
    if (fill > width) fill = width;
    if (fill > 0u)
        ui_fill_attr(x, y, fill, 1u, UI_PAL_SELECTED);
    if (fill < width)
        ui_fill_attr((uint8_t)(x + fill), y, (uint8_t)(width - fill), 1u, UI_PAL_PANEL);
}

/* ── Screen state ── */
#define FOOD_VISIBLE 3u

typedef struct NutritionState {
    SaveData *data;
    uint8_t viewing_day;   /* day index being viewed (0..day_counter) */
    uint8_t scroll;        /* absolute index of first visible food row */
    uint8_t focused;       /* offset within visible window (0..FOOD_VISIBLE-1) */
    uint8_t dirty;
} NutritionState;

/*
 * Draw one food list row at tile row `screen_row`.
 * food_idx is the absolute index into the day's food list.
 * Empty rows (food_idx >= count) are left blank (ui_clear already blanked them).
 */
static void draw_food_row(uint8_t screen_row, uint8_t day,
                          uint8_t food_idx, uint8_t count, uint8_t is_focused) {
    const MockFood *f;
    char buf[8];
    uint8_t klen, kx;

    if (food_idx >= count) return;

    f = get_day_food(day, food_idx);

    if (is_focused)
        ui_fill_attr(0u, screen_row, 20u, 1u, UI_PAL_PANEL);

    /* col 0: cursor */
    ui_print_at(0u, screen_row, is_focused ? ">" : " ");
    /* cols 2-13: food name (12 chars, pre-padded in MOCK_FOODS) */
    ui_print_at(2u, screen_row, f->name);
    /* cols 15-19: kcal right-aligned ending at col 19 */
    sprintf(buf, "%uK", (unsigned int)f->kcal);
    klen = (uint8_t)strlen(buf);
    kx = (klen < 7u) ? (uint8_t)(20u - klen) : 14u;
    ui_print_at(kx, screen_row, buf);
}

/*
 * Full nutrition screen layout (20×18):
 *
 *  Row 0   MUSCLOG GB              ← header (PAL_HEADER)
 *  Row 1   TRACK FOOD      DAY X   ← title + viewed day
 *  Row 2   --------------------
 *  Row 3   CALORIES
 *  Row 4    XXXX / XXXX KCAL
 *  Row 5   [==================]    ← 18-wide calorie bar
 *  Row 6   PROTEIN      CARBS
 *  Row 7   XXX/XXXg   XXX/XXXg
 *  Row 8   [#######]  [#######]
 *  Row 9   FAT          FIBER
 *  Row 10  XXX/XXXg   XXX/XXXg
 *  Row 11  [#######]  [#######]
 *  Row 12  --------------------
 *  Row 13  > FOOD NAME     XXXXK  ← scrollable food list (3 rows)
 *  Row 14    FOOD NAME     XXXXK
 *  Row 15    FOOD NAME     XXXXK
 *  Row 16  --------------------
 *  Row 17  B BACK          SEL DAY
 */
static void draw_nutrition(const NutritionState *state) {
    const SaveData *d = state->data;
    uint8_t day = state->viewing_day;
    uint8_t count = get_day_food_count(day);
    uint8_t i;
    uint16_t cal, pro, carb, fat, fib;
    char buf[22];

    sum_day_macros(day, &cal, &pro, &carb, &fat, &fib);

    ui_clear();

    /* Header */
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, "MUSCLOG GB");
    ui_print_at(0u, 1u, "TRACK FOOD");
    sprintf(buf, "DAY %u", (unsigned int)day);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(buf)), 1u, buf);
    ui_print_at(0u, 2u, "--------------------");

    /* Calories */
    ui_print_at(1u, 3u, "CALORIES");
    sprintf(buf, "%u / %u KCAL", (unsigned int)cal, (unsigned int)d->calorie_goal);
    ui_print_at(1u, 4u, buf);
    draw_bar(1u, 5u, 18u, bar_fill(cal, d->calorie_goal, 18u));

    /* Protein + Carbs */
    ui_print_at(0u, 6u, "PROTEIN");
    ui_print_at(11u, 6u, "CARBS");
    sprintf(buf, "%u/%uG", (unsigned int)pro, (unsigned int)d->protein_goal);
    ui_print_at(0u, 7u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)carb, (unsigned int)d->carbs_goal);
    ui_print_at(11u, 7u, buf);
    draw_bar(0u, 8u, 9u, bar_fill(pro, d->protein_goal, 9u));
    draw_bar(11u, 8u, 9u, bar_fill(carb, d->carbs_goal, 9u));

    /* Fat + Fiber */
    ui_print_at(0u, 9u, "FAT");
    ui_print_at(11u, 9u, "FIBER");
    sprintf(buf, "%u/%uG", (unsigned int)fat, (unsigned int)d->fat_goal);
    ui_print_at(0u, 10u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)fib, (unsigned int)d->fiber_goal);
    ui_print_at(11u, 10u, buf);
    draw_bar(0u, 11u, 9u, bar_fill(fat, d->fat_goal, 9u));
    draw_bar(11u, 11u, 9u, bar_fill(fib, d->fiber_goal, 9u));

    ui_print_at(0u, 12u, "--------------------");

    /* Food list (rows 13-15) */
    for (i = 0u; i != FOOD_VISIBLE; ++i) {
        draw_food_row(
            (uint8_t)(13u + i),
            day,
            (uint8_t)(state->scroll + i),
            count,
            (uint8_t)(i == state->focused)
        );
    }

    ui_footer("B BACK", "SEL DAY");
}

/*
 * Day picker overlay: Left/Right to change day, A/Start to confirm, B to cancel.
 * Updates *viewing_day only on confirm.
 */
static void nutrition_day_picker(const SaveData *data, uint8_t *viewing_day) {
    uint8_t pick = *viewing_day;
    uint8_t dirty = 1u;
    char buf[14];
    InputState input;

    input_init(&input);
    while (1) {
        if (dirty) {
            ui_clear();
            ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
            ui_print_center(0u, "MUSCLOG GB");
            ui_print_center(2u, "SELECT DAY");
            ui_print_at(0u, 3u, "--------------------");

            sprintf(buf, "< DAY %u >", (unsigned int)pick);
            ui_fill_attr(0u, 8u, 20u, 1u, UI_PAL_SELECTED);
            ui_print_center(8u, buf);

            ui_footer("B CANCEL", "A/ST OK");
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return;  /* cancel, leave *viewing_day unchanged */

        if (input_pressed(&input, J_A | J_START)) {
            *viewing_day = pick;
            return;
        }

        if (input_pressed(&input, J_LEFT) && pick > 0u) {
            --pick;
            dirty = 1u;
        }
        if (input_pressed(&input, J_RIGHT) && pick < (uint8_t)data->day_counter) {
            ++pick;
            dirty = 1u;
        }
    }
}

void nutrition_track(SaveData *data) {
    NutritionState state;
    InputState input;
    uint8_t count, abs_idx;

    state.data      = data;
    state.viewing_day = (uint8_t)data->day_counter;
    state.scroll    = 0u;
    state.focused   = 0u;
    state.dirty     = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            draw_nutrition(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        /* B → return to home */
        if (input_pressed(&input, J_B)) return;

        /* Select → day picker */
        if (input_pressed(&input, J_SELECT)) {
            nutrition_day_picker(data, &state.viewing_day);
            state.scroll  = 0u;
            state.focused = 0u;
            state.dirty   = 1u;
            continue;
        }

        count   = get_day_food_count(state.viewing_day);
        abs_idx = (uint8_t)(state.scroll + state.focused);

        /* Down: move cursor down through food list */
        if (input_pressed(&input, J_DOWN) && (uint8_t)(abs_idx + 1u) < count) {
            if (state.focused < (uint8_t)(FOOD_VISIBLE - 1u)) {
                ++state.focused;
            } else {
                ++state.scroll;
            }
            state.dirty = 1u;
        }

        /* Up: move cursor up through food list */
        if (input_pressed(&input, J_UP)) {
            if (state.focused > 0u) {
                --state.focused;
                state.dirty = 1u;
            } else if (state.scroll > 0u) {
                --state.scroll;
                state.dirty = 1u;
            }
        }
    }
}
