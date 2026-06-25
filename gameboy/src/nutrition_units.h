#ifndef MUSCLOG_NUTRITION_UNITS_H
#define MUSCLOG_NUTRITION_UNITS_H

#include <stdint.h>

/* Whole ounces for grams, rounded. Inverse uses 1 oz = 28.35 g. */
static uint16_t nutrition_grams_to_oz(uint16_t grams) {
    return (uint16_t)(((uint32_t)grams * 100u + 1417u) / 2835u);
}

static uint16_t nutrition_oz_to_grams(uint16_t oz) {
    return (uint16_t)(((uint32_t)oz * 2835u + 50u) / 100u);
}

#endif /* MUSCLOG_NUTRITION_UNITS_H */
