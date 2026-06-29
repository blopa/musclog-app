#ifndef MUSCLOG_FOOD_DB_H
#define MUSCLOG_FOOD_DB_H

#include <gb/gb.h>
#include <stdint.h>

/*
 * Read access to the bundled foods that live in ROM banks
 * (foundation_foods[] in bank 2, common_foods[] in bank 3).
 *
 * IMPORTANT: these readers call SWITCH_ROM() to map food-data banks into the
 * 0x4000-0x7FFF window. Keep all food-table dereferencing confined here; the
 * public readers and their switched-bank helpers are NONBANKED so the bank switch
 * cannot page out the executing code.
 */

#define FF_NAME_VISIBLE 16u /* chars copied from a ROM food name (fits the UI width) */
#define FF_MATCH_CAP 24u    /* max filtered matches kept in RAM                       */

/* A food copied out of ROM into RAM (all values per 100 g). */
typedef struct FoodCache {
    char name[FF_NAME_VISIBLE + 1u];
    uint16_t kcal;
    uint16_t protein_dg;
    uint16_t fat_dg;
    uint16_t carbs_dg;
    uint16_t fiber_dg;
} FoodCache;

/* Copy global food `idx` out of ROM into `out` (name truncated to FF_NAME_VISIBLE). */
void ff_load(uint16_t idx, FoodCache *out) NONBANKED;

/*
 * Case-insensitive PREFIX filter over all bundled foods. `query` is uppercase ASCII.
 * Stores up to `cap` matching indices in `matches`; returns the stored count.
 * An empty query matches everything.
 */
uint8_t ff_filter(const char *query, uint16_t *matches, uint8_t cap) NONBANKED;

#endif /* MUSCLOG_FOOD_DB_H */
