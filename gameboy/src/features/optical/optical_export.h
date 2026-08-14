#ifndef MUSCLOG_OPTICAL_EXPORT_H
#define MUSCLOG_OPTICAL_EXPORT_H

#include <gb/gb.h>
#include <stdint.h>

#include "optical_protocol.generated.h"
#include "profile.h"

#define OPTICAL_CONTAINER_HEADER_LEN 92u
#define OPTICAL_FOUNTAIN_BLOCK_LEN 292u
#define OPTICAL_SRAM_CACHE_OFFSET 0x1250u
#define OPTICAL_SRAM_CACHE_BLOCKS 12u
#define OPTICAL_SRAM_CACHE_LEN (OPTICAL_SRAM_CACHE_BLOCKS * OPTICAL_FOUNTAIN_BLOCK_LEN)

/* Container header byte 54, mirroring OPTICAL_PAYLOAD_KIND_* in utils/optical/container.ts:
 * a whole-database dump the receiver may restore over its data, or a share envelope it merges.
 * Pinned against the TypeScript constants by utils/__tests__/gameBoyFountainPort.test.ts. */
#define OPTICAL_PAYLOAD_KIND_DATABASE 0u
#define OPTICAL_PAYLOAD_KIND_SHARE 1u

/* Header bytes 6-7 for a share. Deliberately impossible as a database version: a build shipped
 * before shares existed ignores byte 54 and would otherwise offer its destructive restore for a
 * day of food. Seeing a version far above its own, it says "sent by a newer version of Musclog"
 * instead. See OPTICAL_EXPORT_VERSION_SHARE in utils/optical/container.ts. */
#define OPTICAL_SHARE_EXPORT_VERSION 0xFFFFu

typedef struct OpticalExportInfo {
    uint32_t plain_len;
    uint32_t total_len;
    uint32_t payload_fnv;
    uint16_t session_id;
    uint16_t block_count;
} OpticalExportInfo;

/* Scan the cartridge stores, make streaming length/SHA-256 and FNV-1a passes,
 * then cache the first source blocks in transient SRAM bank 3. */
uint8_t optical_export_prepare(const SaveData *data, OpticalExportInfo *info) BANKED;

/*
 * The same, for ONE day of the food log: a share envelope the receiver merges into its own diary
 * rather than a database it restores over everything. Only the foods that day references are
 * emitted, and no profile, metrics, exercises or workouts at all.
 *
 * Both preparers write into the same statics and the same SRAM cache, so only one export can be
 * in flight — which is already true of the UI, where a share owns the screen until it ends.
 */
uint8_t optical_export_prepare_day(const SaveData *data, uint16_t day_num,
                                   OpticalExportInfo *info) BANKED;

/* XOR the selected source blocks into out. Cached blocks are read directly;
 * uncached blocks regenerate the compact JSON stream on demand. */
void optical_export_xor_blocks(const uint16_t *selected, uint8_t degree, uint8_t *out) BANKED;

#endif /* MUSCLOG_OPTICAL_EXPORT_H */
