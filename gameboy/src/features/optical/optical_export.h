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

/* XOR the selected source blocks into out. Cached blocks are read directly;
 * uncached blocks regenerate the compact JSON stream on demand. */
void optical_export_xor_blocks(const uint16_t *selected, uint8_t degree, uint8_t *out) BANKED;

#endif /* MUSCLOG_OPTICAL_EXPORT_H */
