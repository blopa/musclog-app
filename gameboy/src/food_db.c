#include "food_db.h"

#include <gb/gb.h>

#include "common_foods.h"
#include "custom_foods.h"
#include "foundation_foods.h"

/*
 * Banked food readers. See food_db.h for the bank-residency contract. Public
 * readers and any helper they call while a food-data bank is mapped are NONBANKED;
 * otherwise a helper call would jump into the currently mapped table bytes.
 */

#define TOTAL_FOOD_COUNT ((uint16_t)(FOUNDATION_FOOD_COUNT + COMMON_FOOD_COUNT))

static uint8_t caller_bank(void) NONBANKED {
    return CURRENT_BANK == 0u ? 1u : CURRENT_BANK;
}

static char ascii_upper(char c) NONBANKED {
    return (c >= 'a' && c <= 'z') ? (char)(c - 32) : c;
}

static uint8_t food_name_matches(const char *name, const char *query) NONBANKED {
    uint8_t j;

    for (j = 0u; query[j] != '\0'; ++j) {
        /* name[j] == '\0' (name shorter than query) → mismatch */
        if (ascii_upper(name[j]) != query[j]) return 0u;
    }
    return 1u;
}

static void copy_food(const foundation_food_t *f, FoodCache *out) NONBANKED {
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

static void clear_food(FoodCache *out) NONBANKED {
    out->name[0]     = '\0';
    out->kcal        = 0u;
    out->protein_dg  = 0u;
    out->fat_dg      = 0u;
    out->carbs_dg    = 0u;
    out->fiber_dg    = 0u;
}

void ff_load(uint16_t idx, FoodCache *out) NONBANKED {
    uint8_t saved_bank = caller_bank();

    /* Custom foods live in SRAM bank 3, not a ROM food bank. custom_foods_load is
     * BANKED (bank 4); the GBDK trampoline handles its ROM bank, and the custom data
     * is in SRAM, so no SWITCH_ROM is needed here. */
    if (idx >= CUSTOM_FOOD_BASE) {
        custom_foods_load((uint8_t)(idx - CUSTOM_FOOD_BASE), out);
        return;
    }

    if (idx < FOUNDATION_FOOD_COUNT) {
        SWITCH_ROM(FOUNDATION_FOODS_BANK);
        copy_food(&foundation_foods[idx], out);
    } else if (idx < TOTAL_FOOD_COUNT) {
        SWITCH_ROM(COMMON_FOODS_BANK);
        copy_food(&common_foods[idx - FOUNDATION_FOOD_COUNT], out);
    } else {
        clear_food(out);
        SWITCH_ROM(saved_bank);
        return;
    }

    SWITCH_ROM(saved_bank);
}

uint8_t ff_filter(const char *query, uint16_t *matches, uint8_t cap) NONBANKED {
    uint16_t i;
    uint8_t  count = 0u;
    const char *name;
    uint8_t saved_bank = caller_bank();

    /* User's own foods first so they surface at the top of the results. This is a
     * BANKED call into SRAM bank 3; it maps no ROM food bank, so do it before the
     * SWITCH_ROM scans below. */
    count = custom_foods_filter(query, matches, cap, count);

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

    SWITCH_ROM(saved_bank);
    return count;
}
