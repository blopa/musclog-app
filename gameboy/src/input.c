#include "input.h"

#include <gb/gb.h>

void input_init(InputState *input) {
    input->current = joypad();
    input->previous = input->current;
    input->pressed = 0u;
}

void input_update(InputState *input) {
    input->previous = input->current;
    input->current = joypad();
    input->pressed = (uint8_t)((input->current ^ input->previous) & input->current);
}

uint8_t input_pressed(const InputState *input, uint8_t mask) {
    return (uint8_t)(input->pressed & mask);
}
