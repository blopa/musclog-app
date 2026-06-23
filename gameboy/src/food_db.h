#ifndef MUSCLOG_FOOD_DB_H
#define MUSCLOG_FOOD_DB_H

#include <stdint.h>

/*
 * Read access to the bundled foods that live in ROM banks
 * (foundation_foods[] in bank 2, common_foods[] in bank 3).
 *
 * IMPORTANT — bank residency: these readers call SWITCH_ROM() to map food-data
 * banks into the 0x4000-0x7FFF window, which displaces whatever resident
 * code currently sits there. The functions that perform the switch must therefore
 * live in the always-mapped bank 0 (0x0000-0x3FFF). This is guaranteed by linking
 * food_db.c FIRST (see scripts/build-gb-rom.mjs) so its code lands at the bottom of
 * _CODE. Keep all food-table dereferencing confined to food_db.c for that reason.
 */

#define FF_NAME_VISIBLE 16u   /* chars copied from a ROM food name (fits the UI width) */
#define FF_MATCH_CAP    24u   /* max filtered matches kept in RAM                       */

/* A food copied out of ROM into RAM (all values per 100 g). */
typedef struct FoodCache {
    char     name[FF_NAME_VISIBLE + 1u];
    uint16_t kcal;
    uint16_t protein_dg;
    uint16_t fat_dg;
    uint16_t carbs_dg;
    uint16_t fiber_dg;
} FoodCache;

/* Copy global food `idx` out of ROM into `out` (name truncated to FF_NAME_VISIBLE). */
void ff_load(uint16_t idx, FoodCache *out);

/*
 * Case-insensitive PREFIX filter over all bundled foods. `query` is uppercase ASCII.
 * Stores up to `cap` matching indices in `matches`; returns the stored count.
 * An empty query matches everything.
 */
uint8_t ff_filter(const char *query, uint16_t *matches, uint8_t cap);

#endif /* MUSCLOG_FOOD_DB_H */
