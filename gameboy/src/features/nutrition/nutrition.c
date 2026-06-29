#pragma bank 4

#include "nutrition.h"

#include "copies.h"
#include "custom_foods.h"
#include "food_db.h"
#include "foodlog.h"
#include "input.h"
#include "list_cursor.h"
#include "nutrition_date.h"
#include "nutrition_detail.h"
#include "nutrition_search.h"
#include "rtc.h"
#include "ui_text.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

#define FOOD_VISIBLE 3u

typedef struct NutritionState {
    SaveData *data;
    CalDate viewing_date;
    CalDate today;
    uint16_t day_num;
    ListCursor cursor;
    uint8_t dirty;
} NutritionState;

static void draw_food_row(uint8_t screen_row, uint16_t day_num, uint8_t row_idx, uint8_t count,
                          uint8_t is_focused) {
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

    if (is_focused) ui_fill_attr(0u, screen_row, 20u, 1u, UI_PAL_PANEL);

    ui_print_at(0u, screen_row, is_focused ? ">" : " ");
    ui_print_at(1u, screen_row, food_idx >= CUSTOM_FOOD_BASE ? "*" : " ");
    for (i = 0u; i != 12u && fc.name[i] != '\0'; ++i)
        nm[i] = fc.name[i];
    nm[i] = '\0';
    ui_print_at(2u, screen_row, nm);

    sprintf(buf, "%uK", (unsigned int)cal);
    klen = (uint8_t)strlen(buf);
    kx = (klen < 7u) ? (uint8_t)(20u - klen) : 14u;
    ui_print_at(kx, screen_row, buf);
}

static void draw_nutrition(const NutritionState *state) {
    const SaveData *d = state->data;
    uint8_t count;
    uint8_t i;
    uint16_t cal, pro, carb, fat, fib;
    uint16_t digestible_carb;
    char buf[22];
    char date_buf[9];

    count = foodlog_count_for_day(state->day_num);
    cal_format(&state->viewing_date, date_buf);
    foodlog_sum_day(state->day_num, &cal, &pro, &carb, &fat, &fib);
    digestible_carb = foodlog_digestible_carbs(carb, fib);

    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);
    ui_print_at(0u, 1u, STR_TRACK_FOOD);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(date_buf)), 1u, date_buf);
    ui_print_at(0u, 2u, STR_DIVIDER);

    ui_print_at(1u, 3u, STR_CALORIES);
    sprintf(buf, "%u / %u KCAL", (unsigned int)cal, (unsigned int)d->calorie_goal);
    ui_print_at(1u, 4u, buf);
    ui_draw_bar(1u, 5u, 18u, ui_bar_fill(cal, d->calorie_goal, 18u));

    ui_print_at(0u, 6u, STR_PROTEIN);
    ui_print_at(11u, 6u, STR_CARBS);
    sprintf(buf, "%u/%uG", (unsigned int)pro, (unsigned int)d->protein_goal);
    ui_print_at(0u, 7u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)digestible_carb, (unsigned int)d->carbs_goal);
    ui_print_at(11u, 7u, buf);
    ui_draw_bar(0u, 8u, 9u, ui_bar_fill(pro, d->protein_goal, 9u));
    ui_draw_bar(11u, 8u, 9u, ui_bar_fill(digestible_carb, d->carbs_goal, 9u));

    ui_print_at(0u, 9u, STR_FAT);
    ui_print_at(11u, 9u, STR_FIBER);
    sprintf(buf, "%u/%uG", (unsigned int)fat, (unsigned int)d->fat_goal);
    ui_print_at(0u, 10u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)fib, (unsigned int)d->fiber_goal);
    ui_print_at(11u, 10u, buf);
    ui_draw_bar(0u, 11u, 9u, ui_bar_fill(fat, d->fat_goal, 9u));
    ui_draw_bar(11u, 11u, 9u, ui_bar_fill(fib, d->fiber_goal, 9u));

    ui_print_at(0u, 12u, STR_DIVIDER);
    for (i = 0u; i != FOOD_VISIBLE; ++i) {
        draw_food_row((uint8_t)(13u + i), state->day_num, (uint8_t)(state->cursor.scroll + i),
                      count, (uint8_t)(i == state->cursor.focused));
    }

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_MENU);
}

typedef enum NutritionAction {
    NUTRITION_ACTION_NONE = 0u,
    NUTRITION_ACTION_GO_TO_DATE = 1u,
    NUTRITION_ACTION_TRACK_FOOD = 2u,
    NUTRITION_ACTION_CUSTOM = 3u,
    NUTRITION_ACTION_HOME = 4u,
} NutritionAction;

static NutritionAction nutrition_action_menu(void) {
    const char *options[4];
    uint8_t selected;

    options[0] = STR_GO_TO_DATE;
    options[1] = STR_TRACK_FOOD;
    options[2] = STR_CUSTOM_FOODS;
    options[3] = STR_HOME;

    selected = ui_menu_select(STR_NUTRITION, options, 4u);
    if (selected == UI_MENU_CANCEL) return NUTRITION_ACTION_NONE;
    if (selected == 0u) return NUTRITION_ACTION_GO_TO_DATE;
    if (selected == 1u) return NUTRITION_ACTION_TRACK_FOOD;
    if (selected == 2u) return NUTRITION_ACTION_CUSTOM;
    return NUTRITION_ACTION_HOME;
}

static void custom_foods_submenu(SaveData *data) {
    const char *options[2];
    uint8_t selected;

    options[0] = STR_NEW_FOOD;
    options[1] = STR_MY_FOODS;

    selected = ui_menu_select(STR_CUSTOM_FOODS, options, 2u);
    if (selected == 0u)
        custom_food_create(data);
    else if (selected == 1u)
        custom_foods_manage(data);
}

static uint8_t run_action(NutritionState *state) {
    NutritionAction action = nutrition_action_menu();

    if (action == NUTRITION_ACTION_GO_TO_DATE) {
        nutrition_date_picker(state->today, &state->viewing_date);
        state->day_num = cal_day_number(state->viewing_date);
        list_cursor_reset(&state->cursor);
    } else if (action == NUTRITION_ACTION_TRACK_FOOD) {
        nutrition_food_search_track(state->data, state->viewing_date);
    } else if (action == NUTRITION_ACTION_CUSTOM) {
        custom_foods_submenu(state->data);
    } else if (action == NUTRITION_ACTION_HOME) {
        return 1u;
    }

    return 0u;
}

void nutrition_track(SaveData *data) BANKED {
    NutritionState state;
    InputState input;
    uint8_t count, abs_idx;

    state.data = data;
    state.today = cal_current_date(data);
    state.viewing_date = state.today;
    state.day_num = cal_day_number(state.viewing_date);
    list_cursor_reset(&state.cursor);
    state.dirty = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            draw_nutrition(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_SELECT)) {
            if (run_action(&state)) return;
            state.dirty = 1u;
            continue;
        }

        count = foodlog_count_for_day(state.day_num);
        abs_idx = list_cursor_index(&state.cursor);

        if (input_pressed(&input, J_START) && abs_idx < count) {
            nutrition_show_food_detail(state.data, state.day_num, abs_idx);
            list_cursor_clamp(&state.cursor, foodlog_count_for_day(state.day_num));
            state.dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_DOWN) && list_cursor_down(&state.cursor, count, FOOD_VISIBLE)) {
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_UP) && list_cursor_up(&state.cursor)) {
            state.dirty = 1u;
        }
    }
}
