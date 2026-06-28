#pragma bank 4

#include "nutrition_search.h"

#include "copies.h"
#include "custom_foods.h"
#include "food_db.h"
#include "foodlog.h"
#include "input.h"
#include "list_cursor.h"
#include "nutrition_units.h"
#include "rtc.h"
#include "spinner.h"
#include "ui_text.h"
#include "utils.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

#define MATCH_VISIBLE   6u
#define QUERY_MAX       12u

static const char ALPHABET[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
#define ALPHABET_LEN 27u

#define SEARCH_MODE_TYPING 0u
#define SEARCH_MODE_SELECT 1u

typedef struct SearchState {
    uint8_t  mode;
    char     query[QUERY_MAX + 1u];
    uint8_t  len;
    uint8_t  spin;
    uint16_t matches[FF_MATCH_CAP];
    uint8_t  match_count;
    ListCursor cursor;
} SearchState;

static void draw_match_row(uint8_t row, const FoodCache *fc, uint16_t food_idx, uint8_t focused) {
    char buf[8];
    char nm[13];
    uint8_t i, klen, kx;

    if (focused) ui_fill_attr(0u, row, 20u, 1u, UI_PAL_PANEL);
    ui_print_at(0u, row, focused ? ">" : " ");
    ui_print_at(1u, row, food_idx >= CUSTOM_FOOD_BASE ? "*" : " ");

    for (i = 0u; i != 12u && fc->name[i] != '\0'; ++i) nm[i] = fc->name[i];
    nm[i] = '\0';
    ui_print_at(2u, row, nm);

    sprintf(buf, "%uK", (unsigned int)fc->kcal);
    klen = (uint8_t)strlen(buf);
    kx = (klen < 6u) ? (uint8_t)(20u - klen) : 14u;
    ui_print_at(kx, row, buf);
}

static void draw_search(const SearchState *s) {
    char     line[QUERY_MAX + 2u];
    char     slot[2];
    uint8_t  i, abs_idx;
    FoodCache fc;

    ui_clear();
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);
    ui_print_at(0u, 1u, STR_TRACK_FOOD);
    ui_print_at(0u, 2u, STR_DIVIDER);

    ui_print_at(0u, 3u, STR_NAME_LABEL);
    for (i = 0u; i != s->len; ++i) line[i] = s->query[i];
    line[s->len] = '\0';
    ui_fill_attr(0u, 4u, 20u, 1u, UI_PAL_PANEL);
    ui_print_at(0u, 4u, line);

    if (s->mode == SEARCH_MODE_TYPING) {
        slot[0] = ALPHABET[s->spin];
        slot[1] = '\0';
        ui_fill_attr(s->len, 4u, 1u, 1u, UI_PAL_SELECTED);
        ui_print_at(s->len, 4u, slot);
        ui_print_center(5u, STR_HINT_TYPING);
    } else {
        ui_print_center(5u, STR_HINT_PICK);
    }

    ui_print_at(0u, 6u, STR_DIVIDER);

    if (s->match_count == 0u) {
        ui_print_center(10u, STR_NO_MATCHES);
    } else {
        for (i = 0u; i != MATCH_VISIBLE; ++i) {
            abs_idx = (uint8_t)(s->cursor.scroll + i);
            if (abs_idx >= s->match_count) break;
            ff_load(s->matches[abs_idx], &fc);
            draw_match_row((uint8_t)(8u + i), &fc, s->matches[abs_idx],
                           (uint8_t)(s->mode == SEARCH_MODE_SELECT && i == s->cursor.focused));
        }
    }

    if (s->mode == SEARCH_MODE_TYPING) {
        ui_footer(STR_FOOTER_DEL, STR_FOOTER_DONE);
    } else {
        ui_footer(STR_FOOTER_EDIT, STR_FOOTER_PICK);
    }
}

#define AMOUNT_G_DEFAULT  100u
#define AMOUNT_G_MIN        5u
#define AMOUNT_G_MAX     2000u
#define AMOUNT_OZ_DEFAULT   4u
#define AMOUNT_OZ_MIN       1u
#define AMOUNT_OZ_MAX      70u

static void draw_amount_values(const FoodCache *fc, uint16_t amount, uint8_t imperial) {
    char     buf[21];
    uint16_t grams, kcal, pro, fat, carb, fib;

    grams = imperial ? nutrition_oz_to_grams(amount) : amount;
    foodlog_scale(fc, grams, &kcal, &pro, &carb, &fat, &fib);

    ui_fill_attr(0u, 8u, 20u, 1u, UI_PAL_SELECTED);
    if (imperial) sprintf(buf, "%u OZ", (unsigned int)amount);
    else          sprintf(buf, "%u G",  (unsigned int)amount);
    ui_clear_row(8u);
    ui_print_center(8u, buf);

    sprintf(buf, "CAL  %u KCAL", (unsigned int)kcal);
    ui_clear_row(11u);
    ui_print_at(0u, 11u, buf);

    ui_clear_row(13u);
    sprintf(buf, "PRO %uG", (unsigned int)pro);
    ui_print_at(0u, 13u, buf);
    sprintf(buf, "CARB %uG", (unsigned int)carb);
    ui_print_at(10u, 13u, buf);

    ui_clear_row(14u);
    sprintf(buf, "FAT %uG", (unsigned int)fat);
    ui_print_at(0u, 14u, buf);
    sprintf(buf, "FIB %uG", (unsigned int)fib);
    ui_print_at(10u, 14u, buf);
}

static void draw_amount(const FoodCache *fc, uint16_t amount, uint8_t imperial) {
    ui_title(STR_TRACK_FOOD);

    ui_fill_attr(0u, 5u, 20u, 1u, UI_PAL_PANEL);
    ui_print_center(5u, fc->name);

    ui_print_at(0u, 7u, STR_AMOUNT);
    ui_print_center(9u, STR_HINT_AMOUNT);
    draw_amount_values(fc, amount, imperial);

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_TRACK);
}

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
    uint8_t    frame_drawn = 0u;
    uint8_t    i;

    input_init(&input);
    while (1) {
        if (dirty) {
            if (frame_drawn) draw_amount_values(fc, amount, imperial);
            else {
                draw_amount(fc, amount, imperial);
                frame_drawn = 1u;
            }
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return 0u;

        amount = spinner_u16(&input, amount, small, large, mn, mx);
        if (input_pressed(&input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) dirty = 1u;

        if (input_pressed(&input, J_A | J_START)) {
            if (ui_confirm(STR_TRACK_FOOD, STR_TRACK_FOOD_Q)) {
                uint16_t grams = imperial ? nutrition_oz_to_grams(amount) : amount;
                foodlog_add(cal_day_number(log_date), food_idx, grams);
                ui_title(STR_TRACKED);
                ui_print_center(8u, STR_FOOD_TRACKED);
                ui_present();
                for (i = 0u; i != 75u; ++i) wait_vbl_done();
                return 1u;
            }
            dirty = 1u;
        }
    }
}

void nutrition_food_search_track(SaveData *data, CalDate log_date) BANKED {
    SearchState s;
    InputState  input;
    FoodCache   fc;
    uint8_t     dirty = 1u;
    uint8_t     abs_idx;

    s.mode = SEARCH_MODE_TYPING;
    s.len = 0u;
    s.query[0] = '\0';
    s.spin = 0u;
    list_cursor_reset(&s.cursor);
    s.match_count = ff_filter(s.query, s.matches, FF_MATCH_CAP);

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_search(&s);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

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
                list_cursor_reset(&s.cursor);
                dirty = 1u;
            }
            if (input_pressed(&input, J_B)) {
                if (s.len == 0u) return;
                s.query[--s.len] = '\0';
                s.match_count = ff_filter(s.query, s.matches, FF_MATCH_CAP);
                list_cursor_reset(&s.cursor);
                dirty = 1u;
            }
            if (input_pressed(&input, J_START) && s.match_count > 0u) {
                s.mode = SEARCH_MODE_SELECT;
                list_cursor_reset(&s.cursor);
                dirty = 1u;
            }
            continue;
        }

        if (input_pressed(&input, J_B)) {
            s.mode = SEARCH_MODE_TYPING;
            dirty = 1u;
            continue;
        }

        abs_idx = list_cursor_index(&s.cursor);

        if (input_pressed(&input, J_A | J_START)) {
            ff_load(s.matches[abs_idx], &fc);
            if (food_amount_screen(data, &fc, s.matches[abs_idx], log_date))
                return;
            dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_DOWN) && list_cursor_down(&s.cursor, s.match_count, MATCH_VISIBLE)) {
            dirty = 1u;
        }
        if (input_pressed(&input, J_UP) && list_cursor_up(&s.cursor)) {
            dirty = 1u;
        }
    }
}
