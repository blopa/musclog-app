#ifndef MUSCLOG_VOLUME_CALC_H
#define MUSCLOG_VOLUME_CALC_H

#include <stdint.h>

/*
 * avg_1rm_factor_centi[i] is the average 1RM multiplier × 100 for (i+1) reps,
 * computed from the same seven formulas used by workoutCalculator.ts:
 * Epley, Brzycki, Lander, Lombardi, Mayhew, O'Connor, Wathen (RIR = 0).
 *
 * Mirrors calculateAverage1RM() / calculateWorkoutVolume() in
 * utils/workoutCalculator.ts — update both if the formula set changes.
 */
static const uint16_t avg_1rm_factor_centi[30] = {
    102, 105, 108, 111, 114, 117, 120, 122, 125, 128, /* R= 1-10 */
    131, 135, 138, 141, 144, 148, 152, 156, 160, 165, /* R=11-20 */
    170, 176, 182, 189, 196, 205, 215, 227, 242, 260  /* R=21-30 */
};

/*
 * Volume contribution of a single set in kg (rounded to nearest).
 * Equivalent to calculateAverage1RM(weight_kg, reps, 0) from the mobile app.
 */
static uint16_t set_volume_1rm_kg(uint16_t weight_kg_tenths, uint8_t reps) {
    uint8_t r;
    uint32_t vol;

    if (reps == 0u || weight_kg_tenths == 0u) return 0u;
    r = reps > 30u ? 30u : reps;
    vol = ((uint32_t)weight_kg_tenths * avg_1rm_factor_centi[r - 1u] + 500u) / 1000u;

    return vol > 65535u ? 65535u : (uint16_t)vol;
}

#endif /* MUSCLOG_VOLUME_CALC_H */
