#ifndef MUSCLOG_SPINNER_H
#define MUSCLOG_SPINNER_H

#include <stdint.h>

#include <gb/gb.h>

#include "input.h"
#include "utils.h"

/*
 * Four-direction clamped value spinner, shared by every numeric-entry screen
 * (onboarding age/height/weight/goals, food serving amount, body-weight log):
 *
 *   UP    += small_step      DOWN  -= small_step
 *   RIGHT += large_step      LEFT  -= large_step
 *
 * The result is clamped to [mn, mx]. Callers detect "did anything change?" with
 * the usual `input_pressed(in, J_UP | J_DOWN | J_LEFT | J_RIGHT)` test.
 *
 * Defined `static` in the header (like utils.h) so each translation unit gets
 * its own bank-local copy — no cross-bank trampolines.
 */

static uint8_t spinner_u8(const InputState *in, uint8_t v, uint8_t small_step, uint8_t large_step,
                          uint8_t mn, uint8_t mx) {
    if (input_pressed(in, J_UP)) v = add_clamped_u8(v, small_step, mx);
    if (input_pressed(in, J_DOWN)) v = sub_clamped_u8(v, small_step, mn);
    if (input_pressed(in, J_RIGHT)) v = add_clamped_u8(v, large_step, mx);
    if (input_pressed(in, J_LEFT)) v = sub_clamped_u8(v, large_step, mn);
    return v;
}

static uint16_t spinner_u16(const InputState *in, uint16_t v, uint16_t small_step,
                            uint16_t large_step, uint16_t mn, uint16_t mx) {
    if (input_pressed(in, J_UP)) v = add_clamped_u16(v, small_step, mx);
    if (input_pressed(in, J_DOWN)) v = sub_clamped_u16(v, small_step, mn);
    if (input_pressed(in, J_RIGHT)) v = add_clamped_u16(v, large_step, mx);
    if (input_pressed(in, J_LEFT)) v = sub_clamped_u16(v, large_step, mn);
    return v;
}

#endif /* MUSCLOG_SPINNER_H */
