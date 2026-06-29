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
    CalDate pick;
    uint8_t field;
    uint8_t dirty;
    uint8_t going_right;
    InputState input;

    pick = *viewing_date;
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
        ui_input_update(&input);

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

            /* Year clamps (no wrap) to [2000, today.year]; the final compare
             * also keeps month/day from advancing past today. */
            cal_adjust_ymd(&pick, field, going_right, 2000u, today.year, 0u);

            if (cal_compare(pick, today) > 0) pick = today;
            dirty = 1u;
        }
    }
}
