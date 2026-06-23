#include "food_db.h"

#include <gb/gb.h>

#include "foundation_foods.h"

/*
 * Bank-2 food readers. See food_db.h for the bank-residency contract: this file
 * MUST be linked first so these functions stay in bank 0 and survive the
 * SWITCH_ROM(FOUNDATION_FOODS_BANK) that maps the food table over the 0x4000
 * window. Every function here restores SWITCH_ROM(1) before returning so callers
 * in the (switchable) bank-1 region resume correctly.
 */

static char ascii_upper(char c) {
    return (c >= 'a' && c <= 'z') ? (char)(c - 32) : c;
}

void ff_load(uint16_t idx, FoodCache *out) {
    const foundation_food_t *f;
    const char *src;
    uint8_t i;

    SWITCH_ROM(FOUNDATION_FOODS_BANK);
    f = &foundation_foods[idx];
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
    SWITCH_ROM(1);
}

uint8_t ff_filter(const char *query, uint16_t *matches, uint8_t cap) {
    uint16_t i;
    uint8_t  count = 0u;
    uint8_t  j;
    uint8_t  ok;
    const char *name;

    SWITCH_ROM(FOUNDATION_FOODS_BANK);
    for (i = 0u; i != FOUNDATION_FOOD_COUNT && count != cap; ++i) {
        name = foundation_foods[i].name;
        ok = 1u;
        for (j = 0u; query[j] != '\0'; ++j) {
            /* name[j] == '\0' (name shorter than query) → mismatch */
            if (ascii_upper(name[j]) != query[j]) { ok = 0u; break; }
        }
        if (ok) matches[count++] = i;
    }
    SWITCH_ROM(1);
    return count;
}
