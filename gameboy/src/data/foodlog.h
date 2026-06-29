#ifndef MUSCLOG_FOODLOG_H
#define MUSCLOG_FOODLOG_H

#include <stdint.h>

#include "food_db.h" /* FoodCache */

/*
 * Persistent food log.
 *
 * Each logged food is stored as a compact 6-byte record — { day_num, food_idx,
 * grams } — in SRAM bank 1 (the bank-0 profile written by profile.c is left
 * untouched). Macros are NOT stored: they are recomputed on demand by loading
 * the referenced food out of the banked ROM tables (ff_load) and scaling by grams, so a
 * day's worth of foods costs only 6 bytes each.
 *
 * day_num is cal_day_number(date) (days since 2000-01-01). food_idx indexes
 * the bundled food tables. grams is always metric (imperial input is converted before
 * logging). All multi-byte values are little-endian.
 *
 * Bank-1 layout:
 *   0x00  2  magic 'FL' (0x464C)
 *   0x02  1  version
 *   0x03  2  entry_count
 *   0x05  2  checksum
 *   0x08+    entry_count × 6-byte records
 *
 * This module may safely call ff_load, whose public readers are NONBANKED and
 * restore the caller's active ROM bank on return.
 */

void foodlog_init(void);  /* validate header on boot; reset region if corrupt */
void foodlog_erase(void); /* clear all entries (called from the reset path)    */

/* Returns 1 if the log is at capacity (no room for another entry). */
uint8_t foodlog_is_full(void);

/* Append an entry. Returns 1 on success. When full, the oldest entry is dropped. */
uint8_t foodlog_add(uint16_t day_num, uint16_t food_idx, uint16_t grams);

/* Number of entries logged on `day_num` (capped at 255). */
uint8_t foodlog_count_for_day(uint16_t day_num);

/*
 * Fetch the `nth` (0-based) entry logged on `day_num`.
 * Returns 1 and fills *food_idx / *grams if found, 0 otherwise.
 */
uint8_t foodlog_get_for_day(uint16_t day_num, uint8_t nth, uint16_t *food_idx, uint16_t *grams);

/* Remove the `nth` (0-based) entry logged on `day_num` and compact the store. */
void foodlog_delete_for_day(uint16_t day_num, uint8_t nth);

/* Sum the macros of every entry logged on `day_num` (kcal + grams; carbs include fiber). */
void foodlog_sum_day(uint16_t day_num, uint16_t *cal, uint16_t *pro, uint16_t *carb, uint16_t *fat,
                     uint16_t *fib);

/* Food rows store total carbs including fiber; carb goals use digestible carbs. */
uint16_t foodlog_digestible_carbs(uint16_t carbs, uint16_t fiber);

/*
 * Scale a loaded food's per-100g values to `grams`: calories in kcal, macros in
 * whole grams (rounded). Pure arithmetic — shared by the log summing and the UI.
 */
void foodlog_scale(const FoodCache *fc, uint16_t grams, uint16_t *cal, uint16_t *pro,
                   uint16_t *carb, uint16_t *fat, uint16_t *fib);

#endif /* MUSCLOG_FOODLOG_H */
