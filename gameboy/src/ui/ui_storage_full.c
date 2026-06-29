#pragma bank 6

#include "ui_text.h"
#include "copies.h"
#include "input.h"

#include <gb/gb.h>

void ui_storage_full(const char *title, const char *line1, const char *line2) BANKED {
    InputState input;

    ui_title(title);
    ui_print_center(7u, line1);
    ui_print_center(9u, line2);
    ui_footer(STR_FOOTER_OK, "");

    input_init(&input);
    while (1) {
        wait_vbl_done();
        ui_input_update(&input);
        if (input_pressed(&input, J_A | J_START | J_B)) return;
    }
}
