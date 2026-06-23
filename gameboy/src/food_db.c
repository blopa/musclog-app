#include "food_db.h"

#include <gb/gb.h>

#include "common_foods.h"
#include "foundation_foods.h"

/*
 * Banked food readers. See food_db.h for the bank-residency contract: this file
 * MUST be linked first so these functions stay in bank 0 and survive the
 * SWITCH_ROM() calls that map food tables over the 0x4000 window. Every function
 * here restores SWITCH_ROM(1) before returning so callers in the (switchable)
 * bank-1 region resume correctly.
 */

#define TOTAL_FOOD_COUNT ((uint16_t)(FOUNDATION_FOOD_COUNT + COMMON_FOOD_COUNT))

static char ascii_upper(char c) {
    return (c >= 'a' && c <= 'z') ? (char)(c - 32) : c;
}

static uint8_t food_name_matches(const char *name, const char *query) {
    uint8_t j;

    for (j = 0u; query[j] != '\0'; ++j) {
        /* name[j] == '\0' (name shorter than query) → mismatch */
        if (ascii_upper(name[j]) != query[j]) return 0u;
    }
    return 1u;
}

static void copy_food(const foundation_food_t *f, FoodCache *out) {
    const char *src;
    uint8_t i;

    out->kcal       = f->kcal;
    out->protein_dg = f->protein_dg;
    out->fat_dg     = f->fat_dg;
    out->carbs_dg   = f->carbs_dg;
    out->fiber_dg   = f->fiber_dg;
    src = f->name;
    for (i = 0u; i != FF_NAME_VISIBLE && src[i] != '\0'; ++i) {
        out->name[i] = src[i];
    }
    out->name[i] = '\0';
}

static void clear_food(FoodCache *out) {
    out->name[0]     = '\0';
    out->kcal        = 0u;
    out->protein_dg  = 0u;
    out->fat_dg      = 0u;
    out->carbs_dg    = 0u;
    out->fiber_dg    = 0u;
}

void ff_load(uint16_t idx, FoodCache *out) {
    if (idx < FOUNDATION_FOOD_COUNT) {
        SWITCH_ROM(FOUNDATION_FOODS_BANK);
        copy_food(&foundation_foods[idx], out);
    } else if (idx < TOTAL_FOOD_COUNT) {
        SWITCH_ROM(COMMON_FOODS_BANK);
        copy_food(&common_foods[idx - FOUNDATION_FOOD_COUNT], out);
    } else {
        clear_food(out);
        SWITCH_ROM(1);
        return;
    }

    SWITCH_ROM(1);
}

uint8_t ff_filter(const char *query, uint16_t *matches, uint8_t cap) {
    uint16_t i;
    uint8_t  count = 0u;
    const char *name;

    SWITCH_ROM(FOUNDATION_FOODS_BANK);
    for (i = 0u; i != FOUNDATION_FOOD_COUNT && count != cap; ++i) {
        name = foundation_foods[i].name;
        if (food_name_matches(name, query)) matches[count++] = i;
    }

    if (count != cap) {
        SWITCH_ROM(COMMON_FOODS_BANK);
        for (i = 0u; i != COMMON_FOOD_COUNT && count != cap; ++i) {
            name = common_foods[i].name;
            if (food_name_matches(name, query))
                matches[count++] = (uint16_t)(FOUNDATION_FOOD_COUNT + i);
        }
    }

    SWITCH_ROM(1);
    return count;
}
