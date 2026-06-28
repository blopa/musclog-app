#ifndef MUSCLOG_CUSTOM_FOODS_H
#define MUSCLOG_CUSTOM_FOODS_H

#include <stdint.h>

#include <gb/gb.h>

#include "food_db.h"  /* FoodCache */
#include "profile.h"  /* SaveData  */

/*
 * User-created custom foods, persisted in SRAM bank 3 (the only free SRAM bank —
 * bank 0 = profile + metrics, bank 1 = food log, bank 2 = workout log). The
 * cartridge already declares four SRAM banks via -Wm-ya4 in build-gb-rom.mjs.
 *
 * Custom foods share the global food_idx namespace used by the food log and the
 * bundled ROM tables: a food_idx >= CUSTOM_FOOD_BASE is a custom food whose slot
 * is (idx - CUSTOM_FOOD_BASE). Bundled foods keep indices 0..TOTAL_FOOD_COUNT-1,
 * so the high bit cleanly separates the two and survives growth of the bundled
 * tables. food_idx is a uint16_t everywhere already, so nothing widens.
 *
 * Bank-3 layout (mirrors foodlog.c; checksum from sram.h):
 *   0x00  2  magic 'CF' (0x4346)
 *   0x02  1  version
 *   0x04  2  checksum (rolling hash over the whole fixed entries region)
 *   0x08+    MAX_CUSTOM_FOODS fixed 26-byte slots
 *
 * Each slot: name[16] + kcal, protein_dg, fat_dg, carbs_dg, fiber_dg (5 x u16),
 * matching foundation_food_t units (kcal whole, macros decigrams) so a loaded
 * custom food drops straight into a FoodCache and reuses foodlog_scale unchanged.
 *
 * Slots are tombstoned, never compacted: an empty slot has name[0] == '\0', and a
 * delete just clears name[0]. Slot indices therefore stay stable, so previously
 * logged food references never re-point to a different food. A log entry pointing
 * at a since-deleted custom food loads as a cleared/empty food (same as today's
 * out-of-range ff_load).
 */

#define CUSTOM_FOOD_BASE  0x8000u
#define MAX_CUSTOM_FOODS  100u
#define CUSTOM_NAME_MAX   15u  /* visible chars the user may type (fits FoodCache.name[16]) */

/* Validate the bank-3 header on boot; reset the region if it is missing/corrupt. */
void    custom_foods_init(void) BANKED;

/* Clear every custom food (called from the Reset Data path). */
void    custom_foods_erase(void) BANKED;

/*
 * Append a custom food. name is uppercase ASCII (<= CUSTOM_NAME_MAX chars); macros
 * are per-100g, kcal whole and protein/fat/carbs/fiber in decigrams. Returns 1 on
 * success, 0 if the store is full.
 */
uint8_t custom_foods_add(const char *name, uint16_t kcal, uint16_t protein_dg,
                         uint16_t fat_dg, uint16_t carbs_dg, uint16_t fiber_dg) BANKED;

/* Copy the custom food in `slot` into *out (cleared if the slot is empty/invalid). */
void    custom_foods_load(uint8_t slot, FoodCache *out) BANKED;

/* Number of live (non-tombstoned) custom foods. */
uint8_t custom_foods_count(void) BANKED;

/* Fetch the `nth` (0-based) live custom food; fills *slot and *out. Returns 1 if found. */
uint8_t custom_foods_get(uint8_t nth, uint8_t *slot, FoodCache *out) BANKED;

/* Tombstone the custom food in `slot` (slot indices stay stable). */
void    custom_foods_delete(uint8_t slot) BANKED;

/*
 * Append every custom food whose name prefix-matches `query` (uppercase ASCII) to
 * `matches` as CUSTOM_FOOD_BASE+slot, starting at index `count` and not exceeding
 * `cap`. Returns the new total match count. Lets ff_filter surface custom foods
 * inline with the bundled results.
 */
uint8_t custom_foods_filter(const char *query, uint16_t *matches,
                            uint8_t cap, uint8_t count) BANKED;

/* Screens reached from the nutrition SELECT menu (Custom Foods submenu). */
void    custom_food_create(SaveData *data) BANKED;
void    custom_foods_manage(SaveData *data) BANKED;

#endif /* MUSCLOG_CUSTOM_FOODS_H */
