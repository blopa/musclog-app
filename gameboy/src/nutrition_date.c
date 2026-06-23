#pragma bank 4

#include "nutrition_date.h"

#include "copies.h"
#include "input.h"
#include "rtc.h"
#include "ui_text.h"

#include <gb/gb.h>

/*
 * Date picker overlay: Y/M/D spinners constrained to <= today.
 * Updates *viewing_date only on A/Start confirm; B cancels.
 */
void nutrition_date_picker(CalDate today, CalDate *viewing_date) BANKED {
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
            ui_draw_date_picker(STR_SELECT_DATE, field, pick.year, pick.month, pick.day);
            ui_footer(STR_FOOTER_CANCEL, STR_FOOTER_OK);
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

            if (cal_compare(pick, today) > 0) pick = today;
            dirty = 1u;
        }
    }
}
