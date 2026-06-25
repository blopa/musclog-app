#ifndef MUSCLOG_WEIGHT_UNITS_H
#define MUSCLOG_WEIGHT_UNITS_H

#include <stdint.h>

/*
 * Body-weight unit conversion, shared by onboarding and the body-weight screen.
 * Storage is always metric (kg in tenths); imperial is a display/entry concern.
 * Defined `static` in the header (like utils.h) so each translation unit gets its
 * own bank-local copy — no cross-bank trampolines.
 */

/* Imperial entry bounds for the weight spinner (whole pounds). */
#define WEIGHT_LB_MIN 66u
#define WEIGHT_LB_MAX 551u

/* 1 lb = 0.4536 kg → 4536 tenths-of-kg per 1000 lb. Rounded both directions. */
static uint16_t kg_tenths_to_lbs(uint16_t kg_tenths) {
    return (uint16_t)((((uint32_t)kg_tenths * 1000u) + 2268u) / 4536u);
}

static uint16_t lbs_to_kg_tenths(uint16_t lbs) {
    return (uint16_t)((((uint32_t)lbs * 4536u) + 500u) / 1000u);
}

#endif /* MUSCLOG_WEIGHT_UNITS_H */
