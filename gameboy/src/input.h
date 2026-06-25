#ifndef MUSCLOG_INPUT_H
#define MUSCLOG_INPUT_H

#include <stdint.h>

typedef struct InputState {
    uint8_t current;
    uint8_t previous;
    uint8_t pressed;
} InputState;

void input_init(InputState *input);
void input_update(InputState *input);
uint8_t input_pressed(const InputState *input, uint8_t mask);

#endif
