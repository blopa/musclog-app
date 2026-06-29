#ifndef MUSCLOG_METRICS_H
#define MUSCLOG_METRICS_H

#include <stdint.h>
#include <gb/gb.h>

/*
 * Body-weight metrics log.
 *
 * Stored in cartridge SRAM bank 0 — the SAME bank as the profile (profile.c) —
 * but in a fixed, disjoint sub-region starting at 0x40, so the two never collide
 * and each checksums only its own bytes. The profile occupies 0x00..0x16; metrics
 * own 0x40 onward. This keeps the one free SRAM bank (bank 3) available for future
 * features instead of spending it on a tiny weight log.
 *
 * Bank-0 metrics layout:
 *   0x40  2  magic 'BW' (0x4257)
 *   0x42  1  version
 *   0x43  2  entry_count
 *   0x45  2  checksum
 *   0x48+    entry_count x 4-byte records { day_num u16, weight_kg_tenths u16 }
 *
 * day_num is cal_day_number(date). weight_kg_tenths is always metric (imperial
 * input is converted before logging). One record per calendar day (upsert). All
 * multi-byte values are little-endian.
 *
 * Every public function is BANKED (the module lives in a numbered ROM bank, since
 * _HOME is full) and brackets its SRAM access with ENABLE_RAM/SWITCH_RAM(0).
 */

void metrics_init(void) BANKED;  /* validate header on boot; reset region if corrupt */
void metrics_erase(void) BANKED; /* clear all entries (called from the profile-reset path) */

/*
 * Record today's weight: replace the existing record for `day_num` if present,
 * otherwise append (dropping the oldest entry when full). Returns 1 on success.
 */
uint8_t metrics_set_for_day(uint16_t day_num, uint16_t weight_kg_tenths) BANKED;

/* Number of stored weigh-ins. */
uint16_t metrics_count(void) BANKED;

/* Fetch the `idx`-th (0-based) record in storage order. Returns 1 if found. */
uint8_t metrics_get(uint16_t idx, uint16_t *day_num, uint16_t *weight_kg_tenths) BANKED;

/* Fetch the most recently stored record. Returns 1 if any exist. */
uint8_t metrics_latest(uint16_t *day_num, uint16_t *weight_kg_tenths) BANKED;

/* Min and max weight over all records (both 0 when empty). */
void metrics_min_max(uint16_t *min_kg_tenths, uint16_t *max_kg_tenths) BANKED;

#endif /* MUSCLOG_METRICS_H */
