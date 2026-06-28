#include "input.h"

#include <gb/gb.h>

#include "audio.h"

void input_init(InputState *input) {
    input->current = joypad();
    input->previous = input->current;
    input->pressed = 0u;
}

void input_update(InputState *input) {
    input->previous = input->current;
    input->current = joypad();
    input->pressed = (uint8_t)((input->current ^ input->previous) & input->current);

    /* Every screen drives navigation/confirm through this single chokepoint, so
     * playing the UI blip here gives audible feedback on any fresh button press
     * across the whole app (audio_play_sfx itself honours the SFX setting). */
    if (input->pressed != 0u) {
        audio_play_sfx();
    }
}

uint8_t input_pressed(const InputState *input, uint8_t mask) {
    return (uint8_t)(input->pressed & mask);
}
