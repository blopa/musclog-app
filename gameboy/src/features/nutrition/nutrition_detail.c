#pragma bank 4

#include "nutrition_detail.h"

#include "copies.h"
#include "food_db.h"
#include "foodlog.h"
#include "input.h"
#include "nutrition_units.h"
#include "ui_text.h"

#include <gb/gb.h>
#include <stdio.h>

/*
 * Detail screen for a logged food entry (the nth food on day_num).
 * Shows the serving and the macros scaled to it, including fiber, and lets the
 * user delete the entry with SELECT. Returns 1 if the entry was deleted.
 */
uint8_t nutrition_show_food_detail(SaveData *data, uint16_t day_num, uint8_t nth) BANKED {
    uint16_t food_idx, grams;
    FoodCache fc;
    uint16_t cal, pro, carb, fat, fib;
    uint8_t imperial;
    uint8_t dirty = 1u;
    char buf[22];
    InputState input;

    if (!foodlog_get_for_day(day_num, nth, &food_idx, &grams)) return 0u;

    ff_load(food_idx, &fc);
    foodlog_scale(&fc, grams, &cal, &pro, &carb, &fat, &fib);
    imperial = (uint8_t)(data->units == UNITS_IMPERIAL);

    input_init(&input);
    while (1) {
        if (dirty) {
            ui_title(STR_FOOD_DETAIL);

            ui_fill_attr(0u, 5u, 20u, 1u, UI_PAL_PANEL);
            ui_print_center(5u, fc.name);

            ui_print_at(0u, 7u, STR_SERVING);
            if (imperial)
                sprintf(buf, "%u OZ", (unsigned int)nutrition_grams_to_oz(grams));
            else
                sprintf(buf, "%u G", (unsigned int)grams);
            ui_print_at(10u, 7u, buf);
            ui_print_at(0u, 8u, STR_DIVIDER);

            ui_print_at(0u, 9u, STR_CALORIES);
            sprintf(buf, "%u KCAL", (unsigned int)cal);
            ui_print_at(10u, 9u, buf);

            ui_print_at(0u, 11u, STR_PROTEIN);
            ui_print_at(11u, 11u, STR_CARBS);
            sprintf(buf, "%uG", (unsigned int)pro);
            ui_print_at(1u, 12u, buf);
            sprintf(buf, "%uG", (unsigned int)carb);
            ui_print_at(12u, 12u, buf);

            ui_print_at(0u, 14u, STR_FAT);
            ui_print_at(11u, 14u, STR_FIBER);
            sprintf(buf, "%uG", (unsigned int)fat);
            ui_print_at(1u, 15u, buf);
            sprintf(buf, "%uG", (unsigned int)fib);
            ui_print_at(12u, 15u, buf);

            ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_DEL);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B | J_A | J_START)) return 0u;
        if (input_pressed(&input, J_SELECT)) {
            if (ui_confirm(STR_DELETE_FOOD, STR_DELETE_FOOD_Q)) {
                foodlog_delete_for_day(day_num, nth);
                return 1u;
            }
            dirty = 1u;
        }
    }
}
