#include "nutrition.h"

#include <gb/gb.h>
#include <gbdk/console.h>
#include <stdio.h>
#include <string.h>

#include "food_db.h"
#include "foodlog.h"
#include "input.h"
#include "rtc.h"
#include "ui_text.h"
#include "utils.h"

/* ── Screen state ── */
#define FOOD_VISIBLE 3u

typedef struct NutritionState {
    SaveData *data;
    CalDate  viewing_date; /* calendar date being viewed */
    CalDate  today;        /* current date (set once at entry) */
    uint16_t day_num;      /* cal_day_number(viewing_date) — log key for the view */
    uint8_t  scroll;       /* absolute index of first visible food row */
    uint8_t  focused;      /* offset within visible window (0..FOOD_VISIBLE-1) */
    uint8_t  dirty;
} NutritionState;

/*
 * Draw one food list row at tile row `screen_row`.
 * row_idx is the position (0-based) within the viewed day's logged foods.
 * Empty rows (row_idx >= count) are left blank (ui_clear already blanked them).
 * The kcal shown is scaled to the logged serving.
 */
static void draw_food_row(uint8_t screen_row, uint16_t day_num,
                          uint8_t row_idx, uint8_t count, uint8_t is_focused) {
    uint16_t food_idx, grams;
    FoodCache fc;
    uint16_t cal, pro, carb, fat, fib;
    char buf[8];
    char nm[13];
    uint8_t i, klen, kx;

    if (row_idx >= count) return;
    if (!foodlog_get_for_day(day_num, row_idx, &food_idx, &grams)) return;

    ff_load(food_idx, &fc);
    foodlog_scale(&fc, grams, &cal, &pro, &carb, &fat, &fib);

    if (is_focused)
        ui_fill_attr(0u, screen_row, 20u, 1u, UI_PAL_PANEL);

    /* col 0: cursor */
    ui_print_at(0u, screen_row, is_focused ? ">" : " ");
    /* cols 2-13: food name (truncated to 12) */
    for (i = 0u; i != 12u && fc.name[i] != '\0'; ++i) nm[i] = fc.name[i];
    nm[i] = '\0';
    ui_print_at(2u, screen_row, nm);
    /* cols 15-19: scaled kcal right-aligned ending at col 19 */
    sprintf(buf, "%uK", (unsigned int)cal);
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
    uint8_t count;
    uint8_t i;
    uint16_t cal, pro, carb, fat, fib;
    char buf[22];
    char date_buf[9];  /* "MM-DD-YY\0" */

    count = foodlog_count_for_day(state->day_num);
    cal_format(&state->viewing_date, date_buf);
    foodlog_sum_day(state->day_num, &cal, &pro, &carb, &fat, &fib);

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
            state->day_num,
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

/* Whole ounces for `grams`, rounded — inverse of oz_to_grams (1 oz = 28.35 g). */
static uint16_t grams_to_oz(uint16_t grams) {
    return (uint16_t)(((uint32_t)grams * 100u + 1417u) / 2835u);
}

/*
 * Detail screen for a logged food entry (the `nth` food on day `day_num`).
 * Shows the serving and the macros scaled to it, including fiber, and lets the
 * user delete the entry with SELECT. Returns 1 if the entry was deleted.
 *
 *  Row 0   MUSCLOG GB          ← header
 *  Row 2   FOOD DETAIL         ← title
 *  Row 3   --------------------
 *  Row 5   [   CHICKEN        ] ← name centered, PAL_PANEL
 *  Row 7   SERVING   150 G
 *  Row 8   --------------------
 *  Row 9   CALORIES  XXX KCAL
 *  Row 11  PROTEIN      CARBS
 *  Row 12   XXG          XXG
 *  Row 14  FAT          FIBER
 *  Row 15   XXG          XXG
 *  Row 16  --------------------
 *  Row 17  B BACK      SEL DEL
 */
static uint8_t show_food_detail(SaveData *data, uint16_t day_num, uint8_t nth) {
    uint16_t food_idx, grams;
    FoodCache fc;
    uint16_t cal, pro, carb, fat, fib;
    uint8_t  imperial;
    uint8_t  dirty = 1u;
    char buf[22];
    InputState input;

    if (!foodlog_get_for_day(day_num, nth, &food_idx, &grams)) return 0u;

    ff_load(food_idx, &fc);
    foodlog_scale(&fc, grams, &cal, &pro, &carb, &fat, &fib);
    imperial = (uint8_t)(data->units == UNITS_IMPERIAL);

    input_init(&input);
    while (1) {
        if (dirty) {
            ui_title("FOOD DETAIL");

            ui_fill_attr(0u, 5u, 20u, 1u, UI_PAL_PANEL);
            ui_print_center(5u, fc.name);

            ui_print_at(0u, 7u, "SERVING");
            if (imperial) sprintf(buf, "%u OZ", (unsigned int)grams_to_oz(grams));
            else          sprintf(buf, "%u G",  (unsigned int)grams);
            ui_print_at(10u, 7u, buf);
            ui_print_at(0u, 8u, "--------------------");

            ui_print_at(0u, 9u, "CALORIES");
            sprintf(buf, "%u KCAL", (unsigned int)cal);
            ui_print_at(10u, 9u, buf);

            ui_print_at(0u, 11u, "PROTEIN");
            ui_print_at(11u, 11u, "CARBS");
            sprintf(buf, "%uG", (unsigned int)pro);
            ui_print_at(1u, 12u, buf);
            sprintf(buf, "%uG", (unsigned int)carb);
            ui_print_at(12u, 12u, buf);

            ui_print_at(0u, 14u, "FAT");
            ui_print_at(11u, 14u, "FIBER");
            sprintf(buf, "%uG", (unsigned int)fat);
            ui_print_at(1u, 15u, buf);
            sprintf(buf, "%uG", (unsigned int)fib);
            ui_print_at(12u, 15u, buf);

            ui_footer("B BACK", "SEL DEL");
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B | J_A | J_START)) return 0u;
        if (input_pressed(&input, J_SELECT)) {
            if (ui_confirm("DELETE FOOD", "DELETE FOOD?")) {
                foodlog_delete_for_day(day_num, nth);
                return 1u;
            }
            dirty = 1u; /* cancelled → repaint the detail screen */
        }
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
 *  Row 14  FAT XXXG   FIB XXXG
 *  Row 17  B BACK / A/ST TRACK
 */
static void draw_amount(const FoodCache *fc, uint16_t amount, uint8_t imperial) {
    char     buf[21];
    uint16_t grams, kcal, pro, fat, carb, fib;

    grams = imperial ? oz_to_grams(amount) : amount;
    foodlog_scale(fc, grams, &kcal, &pro, &carb, &fat, &fib);

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
    sprintf(buf, "FIB %uG", (unsigned int)fib);
    ui_print_at(10u, 14u, buf);

    ui_footer("B BACK", "A/ST TRACK");
}

/* Returns 1 if the food was tracked (confirmed), 0 if the user backed out. */
static uint8_t food_amount_screen(SaveData *data, const FoodCache *fc,
                                  uint16_t food_idx, CalDate log_date) {
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
                uint16_t grams = imperial ? oz_to_grams(amount) : amount;
                foodlog_add(cal_day_number(log_date), food_idx, grams);
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
 * Tracked foods are logged to `log_date` (the date being viewed).
 * Returns when the user backs out (empty query + B) or tracks a food.
 */
static void food_search_track(SaveData *data, CalDate log_date) {
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
            if (food_amount_screen(data, &fc, s.matches[abs_idx], log_date))
                return; /* tracked → exit flow */
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
    uint8_t count, abs_idx;

    state.data         = data;
    state.today        = cal_current_date(data);
    state.viewing_date = state.today;
    state.day_num      = cal_day_number(state.viewing_date);
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
                state.day_num = cal_day_number(state.viewing_date);
                state.scroll  = 0u;
                state.focused = 0u;
            } else if (action == NUTRITION_ACTION_TRACK_FOOD) {
                food_search_track(state.data, state.viewing_date);
            }
            state.dirty = 1u;
            continue;
        }

        count   = foodlog_count_for_day(state.day_num);
        abs_idx = (uint8_t)(state.scroll + state.focused);

        /* Start → food detail for the focused item (with delete) */
        if (input_pressed(&input, J_START) && abs_idx < count) {
            show_food_detail(state.data, state.day_num, abs_idx);
            /* An entry may have been deleted; clamp the cursor to the new count. */
            count = foodlog_count_for_day(state.day_num);
            if (count == 0u) {
                state.scroll = 0u;
                state.focused = 0u;
            } else if ((uint8_t)(state.scroll + state.focused) >= count) {
                uint8_t target = (uint8_t)(count - 1u); /* new last index */
                if (target < state.scroll) {
                    state.scroll = target;
                    state.focused = 0u;
                } else {
                    state.focused = (uint8_t)(target - state.scroll);
                }
            }
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
