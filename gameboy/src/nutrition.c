#include "nutrition.h"

#include <gb/gb.h>
#include <gbdk/console.h>
#include <stdio.h>
#include <string.h>

#include "food_db.h"
#include "input.h"
#include "rtc.h"
#include "ui_text.h"
#include "utils.h"

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

/*
 * Map a CalDate to a mock day index (0=today, 1=yesterday, 2+=empty).
 * d must be <= today.
 */
static uint8_t date_to_mock_idx(CalDate d, CalDate today) {
    CalDate cursor;
    uint8_t diff;

    if (cal_compare(d, today) == 0) return 0u;

    cursor = d;
    diff   = 0u;
    while (cal_compare(cursor, today) < 0 && diff < 3u) {
        cursor = cal_advance(cursor, 1u);
        diff++;
    }
    return (diff < 2u) ? diff : 2u;
}

/* ── Screen state ── */
#define FOOD_VISIBLE 3u

typedef struct NutritionState {
    SaveData *data;
    CalDate  viewing_date; /* calendar date being viewed */
    CalDate  today;        /* current date (set once at entry) */
    uint8_t  scroll;       /* absolute index of first visible food row */
    uint8_t  focused;      /* offset within visible window (0..FOOD_VISIBLE-1) */
    uint8_t  dirty;
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
 *  Row 1   TRACK FOOD  MM-DD-YY    ← title + viewed date
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
 *  Row 17  B BACK         SEL MENU
 */
static void draw_nutrition(const NutritionState *state) {
    const SaveData *d = state->data;
    uint8_t day;
    uint8_t count;
    uint8_t i;
    uint16_t cal, pro, carb, fat, fib;
    char buf[22];
    char date_buf[9];  /* "MM-DD-YY\0" */

    day   = date_to_mock_idx(state->viewing_date, state->today);
    count = get_day_food_count(day);
    cal_format(&state->viewing_date, date_buf);
    sum_day_macros(day, &cal, &pro, &carb, &fat, &fib);

    ui_clear();

    /* Header */
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, "MUSCLOG GB");
    ui_print_at(0u, 1u, "TRACK FOOD");
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(date_buf)), 1u, date_buf);
    ui_print_at(0u, 2u, "--------------------");

    /* Calories */
    ui_print_at(1u, 3u, "CALORIES");
    sprintf(buf, "%u / %u KCAL", (unsigned int)cal, (unsigned int)d->calorie_goal);
    ui_print_at(1u, 4u, buf);
    ui_draw_bar(1u, 5u, 18u, ui_bar_fill(cal, d->calorie_goal, 18u));

    /* Protein + Carbs */
    ui_print_at(0u, 6u, "PROTEIN");
    ui_print_at(11u, 6u, "CARBS");
    sprintf(buf, "%u/%uG", (unsigned int)pro, (unsigned int)d->protein_goal);
    ui_print_at(0u, 7u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)carb, (unsigned int)d->carbs_goal);
    ui_print_at(11u, 7u, buf);
    ui_draw_bar(0u, 8u, 9u, ui_bar_fill(pro, d->protein_goal, 9u));
    ui_draw_bar(11u, 8u, 9u, ui_bar_fill(carb, d->carbs_goal, 9u));

    /* Fat + Fiber */
    ui_print_at(0u, 9u, "FAT");
    ui_print_at(11u, 9u, "FIBER");
    sprintf(buf, "%u/%uG", (unsigned int)fat, (unsigned int)d->fat_goal);
    ui_print_at(0u, 10u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)fib, (unsigned int)d->fiber_goal);
    ui_print_at(11u, 10u, buf);
    ui_draw_bar(0u, 11u, 9u, ui_bar_fill(fat, d->fat_goal, 9u));
    ui_draw_bar(11u, 11u, 9u, ui_bar_fill(fib, d->fiber_goal, 9u));

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

    ui_footer("B BACK", "SEL MENU");
}

typedef enum NutritionAction {
    NUTRITION_ACTION_NONE = 0u,
    NUTRITION_ACTION_GO_TO_DATE = 1u,
    NUTRITION_ACTION_TRACK_FOOD = 2u,
} NutritionAction;

static NutritionAction nutrition_action_menu(void) {
    static const char *OPTIONS[2] = {
        "GO TO DATE",
        "TRACK FOOD",
    };
    uint8_t selected;
    uint8_t dirty;
    InputState input;

    selected = 0u;
    dirty = 1u;

    input_init(&input);
    while (1) {
        if (dirty) {
            ui_draw_menu("NUTRITION", OPTIONS, 2u, selected);
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return NUTRITION_ACTION_NONE;

        if (input_pressed(&input, J_UP | J_DOWN)) {
            selected = (selected == 0u) ? 1u : 0u;
            dirty = 1u;
        }

        if (input_pressed(&input, J_A | J_START)) {
            return selected == 0u ? NUTRITION_ACTION_GO_TO_DATE : NUTRITION_ACTION_TRACK_FOOD;
        }
    }
}

/*
 * Date picker overlay: Y/M/D spinners constrained to <= today.
 * Updates *viewing_date only on A/Start confirm; B cancels.
 */
static void nutrition_date_picker(CalDate today, CalDate *viewing_date) {
    CalDate    pick;
    uint8_t    field;
    uint8_t    dirty;
    uint8_t    going_right;
    uint8_t    dim;
    InputState input;

    pick  = *viewing_date;
    field = 0u;
    dirty = 1u;

    input_init(&input);
    while (1) {
        if (dirty) {
            ui_draw_date_picker("SELECT DATE", field, pick.year, pick.month, pick.day);
            ui_footer("B CANCEL", "A/ST OK");
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_A | J_START)) {
            *viewing_date = pick;
            return;
        }

        if (input_pressed(&input, J_UP)) {
            field = (field == 0u) ? 2u : (uint8_t)(field - 1u);
            dirty = 1u;
        }
        if (input_pressed(&input, J_DOWN)) {
            field = (uint8_t)((field + 1u) % 3u);
            dirty = 1u;
        }

        if (input_pressed(&input, J_LEFT | J_RIGHT)) {
            going_right = input_pressed(&input, J_RIGHT);

            if (field == 0u) {
                if (going_right) {
                    pick.year = (uint16_t)(pick.year + 1u);
                    if (pick.year > today.year) pick.year = today.year;
                } else {
                    if (pick.year > 2000u) pick.year = (uint16_t)(pick.year - 1u);
                }
                dim = cal_days_in_month(pick.month, pick.year);
                if (pick.day > dim) pick.day = dim;
            } else if (field == 1u) {
                if (going_right) {
                    pick.month = (pick.month >= 12u) ? 1u : (uint8_t)(pick.month + 1u);
                } else {
                    pick.month = (pick.month <= 1u) ? 12u : (uint8_t)(pick.month - 1u);
                }
                dim = cal_days_in_month(pick.month, pick.year);
                if (pick.day > dim) pick.day = dim;
            } else {
                dim = cal_days_in_month(pick.month, pick.year);
                if (going_right) {
                    pick.day = (pick.day >= dim) ? 1u : (uint8_t)(pick.day + 1u);
                } else {
                    pick.day = (pick.day <= 1u) ? dim : (uint8_t)(pick.day - 1u);
                }
            }

            /* Clamp to today */
            if (cal_compare(pick, today) > 0) pick = today;
            dirty = 1u;
        }
    }
}

/*
 * Food detail screen layout (20×18):
 *
 *  Row 0   MUSCLOG GB          ← header
 *  Row 2   FOOD DETAIL         ← title
 *  Row 3   --------------------
 *  Row 5   [   CHICKEN        ] ← name centered, PAL_PANEL
 *  Row 7   --------------------
 *  Row 8   CALORIES
 *  Row 9    580 KCAL
 *  Row 11  PROTEIN      CARBS
 *  Row 12   52G          18G
 *  Row 14  FAT          FIBER
 *  Row 15   28G           0G
 *  Row 16  --------------------
 *  Row 17  B BACK
 */
static void show_food_detail(const MockFood *f) {
    char buf[22];
    char name[13];
    uint8_t i, trimlen;
    InputState input;

    /* Trim trailing spaces from the padded name for centered display */
    trimlen = 0u;
    for (i = 0u; i != 12u && f->name[i] != '\0'; ++i) {
        if (f->name[i] != ' ') trimlen = (uint8_t)(i + 1u);
    }
    for (i = 0u; i != trimlen; ++i) name[i] = f->name[i];
    name[trimlen] = '\0';

    ui_title("FOOD DETAIL");

    ui_fill_attr(0u, 5u, 20u, 1u, UI_PAL_PANEL);
    ui_print_center(5u, name);

    ui_print_at(0u, 7u, "--------------------");

    ui_print_at(0u, 8u, "CALORIES");
    sprintf(buf, "%u KCAL", (unsigned int)f->kcal);
    ui_print_at(1u, 9u, buf);

    ui_print_at(0u, 11u, "PROTEIN");
    ui_print_at(11u, 11u, "CARBS");
    sprintf(buf, "%uG", (unsigned int)f->protein);
    ui_print_at(1u, 12u, buf);
    sprintf(buf, "%uG", (unsigned int)f->carbs);
    ui_print_at(12u, 12u, buf);

    ui_print_at(0u, 14u, "FAT");
    ui_print_at(11u, 14u, "FIBER");
    sprintf(buf, "%uG", (unsigned int)f->fat);
    ui_print_at(1u, 15u, buf);
    sprintf(buf, "%uG", (unsigned int)f->fiber);
    ui_print_at(12u, 15u, buf);

    ui_footer("B BACK", "");

    input_init(&input);
    while (1) {
        wait_vbl_done();
        input_update(&input);
        if (input_pressed(&input, J_B | J_A | J_START)) return;
    }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Foundation-food search & track flow.
 *
 * The bundled USDA foods live in ROM bank 2; all reads go through food_db.c
 * (ff_load / ff_filter), which owns the SWITCH_ROM dance. This file only ever
 * touches the RAM FoodCache copies they hand back.
 * ────────────────────────────────────────────────────────────────────────── */

#define MATCH_VISIBLE   6u             /* food rows shown at once (rows 8-13)     */
#define QUERY_MAX       12u            /* max typed name length                  */

/* Spinner alphabet: A-Z then a trailing space. */
static const char ALPHABET[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
#define ALPHABET_LEN 27u

/* One filtered-food row: cursor + name (truncated to 12) + right-aligned kcal. */
static void draw_match_row(uint8_t row, const FoodCache *fc, uint8_t focused) {
    char buf[8];
    char nm[13];
    uint8_t i, klen, kx;

    if (focused) ui_fill_attr(0u, row, 20u, 1u, UI_PAL_PANEL);
    ui_print_at(0u, row, focused ? ">" : " ");

    for (i = 0u; i != 12u && fc->name[i] != '\0'; ++i) nm[i] = fc->name[i];
    nm[i] = '\0';
    ui_print_at(2u, row, nm);

    sprintf(buf, "%uK", (unsigned int)fc->kcal);
    klen = (uint8_t)strlen(buf);
    kx = (klen < 6u) ? (uint8_t)(20u - klen) : 14u;
    ui_print_at(kx, row, buf);
}

#define SEARCH_MODE_TYPING 0u
#define SEARCH_MODE_SELECT 1u

typedef struct SearchState {
    uint8_t  mode;
    char     query[QUERY_MAX + 1u];
    uint8_t  len;
    uint8_t  spin;                     /* index into ALPHABET                    */
    uint16_t matches[FF_MATCH_CAP];
    uint8_t  match_count;
    uint8_t  scroll;                   /* absolute index of first visible match  */
    uint8_t  focused;                  /* offset within visible window           */
} SearchState;

/*
 * Food search screen layout (20×18):
 *
 *  Row 0   MUSCLOG GB
 *  Row 1   TRACK FOOD
 *  Row 2   --------------------
 *  Row 3   NAME:
 *  Row 4   [CHICK_]              ← typed query; "_" = highlighted spin letter
 *  Row 5   UP/DN A=ADD ST=DONE   ← hint (mode-dependent)
 *  Row 6   --------------------
 *  Row 8   > FOOD NAME    XXXXK  ← up to 6 filtered rows (8-13)
 *  ...
 *  Row 16  --------------------
 *  Row 17  B DEL / ST DONE       ← footer (mode-dependent)
 */
static void draw_search(const SearchState *s) {
    char     line[QUERY_MAX + 2u];
    char     slot[2];
    uint8_t  i, abs_idx;
    FoodCache fc;

    ui_clear();
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, "MUSCLOG GB");
    ui_print_at(0u, 1u, "TRACK FOOD");
    ui_print_at(0u, 2u, "--------------------");

    ui_print_at(0u, 3u, "NAME:");
    for (i = 0u; i != s->len; ++i) line[i] = s->query[i];
    line[s->len] = '\0';
    ui_fill_attr(0u, 4u, 20u, 1u, UI_PAL_PANEL);
    ui_print_at(0u, 4u, line);

    if (s->mode == SEARCH_MODE_TYPING) {
        slot[0] = ALPHABET[s->spin];
        slot[1] = '\0';
        ui_fill_attr(s->len, 4u, 1u, 1u, UI_PAL_SELECTED);
        ui_print_at(s->len, 4u, slot);
        ui_print_center(5u, "UP/DN A=ADD ST=DONE");
    } else {
        ui_print_center(5u, "UP/DN PICK  B EDIT");
    }

    ui_print_at(0u, 6u, "--------------------");

    if (s->match_count == 0u) {
        ui_print_center(10u, "NO MATCHES");
    } else {
        for (i = 0u; i != MATCH_VISIBLE; ++i) {
            abs_idx = (uint8_t)(s->scroll + i);
            if (abs_idx >= s->match_count) break;
            ff_load(s->matches[abs_idx], &fc);
            draw_match_row((uint8_t)(8u + i), &fc,
                           (uint8_t)(s->mode == SEARCH_MODE_SELECT && i == s->focused));
        }
    }

    if (s->mode == SEARCH_MODE_TYPING) {
        ui_footer("B DEL", "ST DONE");
    } else {
        ui_footer("B EDIT", "A/ST PICK");
    }
}

/* Imperial amount is entered in whole ounces; convert to grams for macro math. */
static uint16_t oz_to_grams(uint16_t oz) {
    return (uint16_t)(((uint32_t)oz * 2835u + 50u) / 100u);
}

#define AMOUNT_G_DEFAULT  100u
#define AMOUNT_G_MIN        5u
#define AMOUNT_G_MAX     2000u
#define AMOUNT_OZ_DEFAULT   4u
#define AMOUNT_OZ_MIN       1u
#define AMOUNT_OZ_MAX      70u

/* Scale a per-100g decigram macro to whole grams for `grams` of food (rounded). */
static uint16_t scale_macro_dg(uint16_t dg, uint16_t grams) {
    return (uint16_t)(((uint32_t)dg * grams + 500u) / 1000u);
}

/*
 * Food detail + amount screen. `amount` is in display units (g metric / oz imperial);
 * calories and macros recompute live as it changes.
 *
 *  Row 5   [   FOOD NAME      ]  ← name (PAL_PANEL)
 *  Row 7   AMOUNT
 *  Row 8   [     100 G        ]  ← spinner value (PAL_SELECTED)
 *  Row 9   UP/DN  L/R FAST
 *  Row 11  CAL  XXX KCAL
 *  Row 13  PRO XXXG   CARB XXXG
 *  Row 14  FAT XXXG
 *  Row 17  B BACK / A/ST TRACK
 */
static void draw_amount(const FoodCache *fc, uint16_t amount, uint8_t imperial) {
    char     buf[21];
    uint16_t grams, kcal, pro, fat, carb;

    grams = imperial ? oz_to_grams(amount) : amount;
    kcal  = (uint16_t)(((uint32_t)fc->kcal * grams + 50u) / 100u);
    pro   = scale_macro_dg(fc->protein_dg, grams);
    fat   = scale_macro_dg(fc->fat_dg, grams);
    carb  = scale_macro_dg(fc->carbs_dg, grams);

    ui_title("TRACK FOOD");

    ui_fill_attr(0u, 5u, 20u, 1u, UI_PAL_PANEL);
    ui_print_center(5u, fc->name);

    ui_print_at(0u, 7u, "AMOUNT");
    ui_fill_attr(0u, 8u, 20u, 1u, UI_PAL_SELECTED);
    if (imperial) sprintf(buf, "%u OZ", (unsigned int)amount);
    else          sprintf(buf, "%u G",  (unsigned int)amount);
    ui_print_center(8u, buf);
    ui_print_center(9u, "UP/DN  L/R FAST");

    sprintf(buf, "CAL  %u KCAL", (unsigned int)kcal);
    ui_print_at(0u, 11u, buf);

    sprintf(buf, "PRO %uG", (unsigned int)pro);
    ui_print_at(0u, 13u, buf);
    sprintf(buf, "CARB %uG", (unsigned int)carb);
    ui_print_at(10u, 13u, buf);
    sprintf(buf, "FAT %uG", (unsigned int)fat);
    ui_print_at(0u, 14u, buf);

    ui_footer("B BACK", "A/ST TRACK");
}

/* Returns 1 if the food was tracked (confirmed), 0 if the user backed out. */
static uint8_t food_amount_screen(SaveData *data, const FoodCache *fc) {
    InputState input;
    uint8_t    imperial = (uint8_t)(data->units == UNITS_IMPERIAL);
    uint16_t   amount   = imperial ? AMOUNT_OZ_DEFAULT : AMOUNT_G_DEFAULT;
    uint16_t   small    = imperial ? 1u : 10u;
    uint16_t   large    = imperial ? 5u : 50u;
    uint16_t   mn       = imperial ? AMOUNT_OZ_MIN : AMOUNT_G_MIN;
    uint16_t   mx       = imperial ? AMOUNT_OZ_MAX : AMOUNT_G_MAX;
    uint8_t    dirty    = 1u;
    uint8_t    i;

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_amount(fc, amount, imperial);
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return 0u;

        if (input_pressed(&input, J_UP))    amount = add_clamped_u16(amount, small, mx);
        if (input_pressed(&input, J_DOWN))  amount = sub_clamped_u16(amount, small, mn);
        if (input_pressed(&input, J_RIGHT)) amount = add_clamped_u16(amount, large, mx);
        if (input_pressed(&input, J_LEFT))  amount = sub_clamped_u16(amount, large, mn);
        if (input_pressed(&input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) dirty = 1u;

        if (input_pressed(&input, J_A | J_START)) {
            if (ui_confirm("TRACK FOOD", "TRACK FOOD?")) {
                ui_title("TRACKED");
                ui_print_center(8u, "FOOD TRACKED!");
                for (i = 0u; i != 75u; ++i) wait_vbl_done();
                return 1u;
            }
            dirty = 1u; /* cancelled → redraw amount screen */
        }
    }
}

/*
 * Type-to-search foundation foods, pick one, choose an amount, and confirm.
 * Returns when the user backs out (empty query + B) or tracks a food.
 */
static void food_search_track(SaveData *data) {
    SearchState s;
    InputState  input;
    FoodCache   fc;
    uint8_t     dirty = 1u;
    uint8_t     abs_idx;

    s.mode = SEARCH_MODE_TYPING;
    s.len = 0u;
    s.query[0] = '\0';
    s.spin = 0u;
    s.scroll = 0u;
    s.focused = 0u;
    s.match_count = ff_filter(s.query, s.matches, FF_MATCH_CAP);

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_search(&s);
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (s.mode == SEARCH_MODE_TYPING) {
            if (input_pressed(&input, J_UP)) {
                s.spin = (s.spin == 0u) ? (uint8_t)(ALPHABET_LEN - 1u) : (uint8_t)(s.spin - 1u);
                dirty = 1u;
            }
            if (input_pressed(&input, J_DOWN)) {
                s.spin = (uint8_t)((s.spin + 1u) % ALPHABET_LEN);
                dirty = 1u;
            }
            if (input_pressed(&input, J_A) && s.len < QUERY_MAX) {
                s.query[s.len++] = ALPHABET[s.spin];
                s.query[s.len] = '\0';
                s.spin = 0u;
                s.match_count = ff_filter(s.query, s.matches, FF_MATCH_CAP);
                s.scroll = 0u;
                s.focused = 0u;
                dirty = 1u;
            }
            if (input_pressed(&input, J_B)) {
                if (s.len == 0u) return; /* empty query → leave search */
                s.query[--s.len] = '\0';
                s.match_count = ff_filter(s.query, s.matches, FF_MATCH_CAP);
                s.scroll = 0u;
                s.focused = 0u;
                dirty = 1u;
            }
            if (input_pressed(&input, J_START) && s.match_count > 0u) {
                s.mode = SEARCH_MODE_SELECT;
                s.scroll = 0u;
                s.focused = 0u;
                dirty = 1u;
            }
            continue;
        }

        /* SEARCH_MODE_SELECT */
        if (input_pressed(&input, J_B)) {
            s.mode = SEARCH_MODE_TYPING;
            dirty = 1u;
            continue;
        }

        abs_idx = (uint8_t)(s.scroll + s.focused);

        if (input_pressed(&input, J_A | J_START)) {
            ff_load(s.matches[abs_idx], &fc);
            if (food_amount_screen(data, &fc)) return; /* tracked → exit flow */
            dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_DOWN) && (uint8_t)(abs_idx + 1u) < s.match_count) {
            if (s.focused < (uint8_t)(MATCH_VISIBLE - 1u)) ++s.focused;
            else ++s.scroll;
            dirty = 1u;
        }
        if (input_pressed(&input, J_UP)) {
            if (s.focused > 0u) { --s.focused; dirty = 1u; }
            else if (s.scroll > 0u) { --s.scroll; dirty = 1u; }
        }
    }
}

void nutrition_track(SaveData *data) {
    NutritionState state;
    InputState input;
    uint8_t count, abs_idx, mock_day;

    state.data         = data;
    state.today        = cal_current_date(data);
    state.viewing_date = state.today;
    state.scroll       = 0u;
    state.focused      = 0u;
    state.dirty        = 1u;

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

        /* Select → action menu */
        if (input_pressed(&input, J_SELECT)) {
            NutritionAction action = nutrition_action_menu();
            if (action == NUTRITION_ACTION_GO_TO_DATE) {
                nutrition_date_picker(state.today, &state.viewing_date);
                state.scroll  = 0u;
                state.focused = 0u;
            } else if (action == NUTRITION_ACTION_TRACK_FOOD) {
                food_search_track(state.data);
            }
            state.dirty = 1u;
            continue;
        }

        mock_day = date_to_mock_idx(state.viewing_date, state.today);
        count    = get_day_food_count(mock_day);
        abs_idx  = (uint8_t)(state.scroll + state.focused);

        /* Start → food detail for the focused item */
        if (input_pressed(&input, J_START) && abs_idx < count) {
            show_food_detail(get_day_food(mock_day, abs_idx));
            state.dirty = 1u;
            continue;
        }

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
