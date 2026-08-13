#ifndef MUSCLOG_OPTICAL_EXPORT_H
#define MUSCLOG_OPTICAL_EXPORT_H

#include <gb/gb.h>
#include <stdint.h>

#include "profile.h"

#define OPTICAL_EXPORT_DATABASE_VERSION 26u
#define OPTICAL_EXPORT_SCHEMA_VERSION 1u
#define OPTICAL_CONTAINER_HEADER_LEN 92u
#define OPTICAL_FOUNTAIN_BLOCK_LEN 202u

typedef struct OpticalExportInfo {
    uint32_t plain_len;
    uint32_t total_len;
    uint32_t payload_fnv;
    uint16_t session_id;
    uint16_t block_count;
} OpticalExportInfo;

/* Scan the cartridge stores, then make two streaming passes over the virtual
 * JSON: one for length/SHA-256 and one for the container's FNV-1a. */
uint8_t optical_export_prepare(const SaveData *data, OpticalExportInfo *info) BANKED;

/* XOR the selected source blocks into out. The compact JSON is generated as a
 * stream, so the full database never needs to fit in RAM. */
void optical_export_xor_blocks(const uint16_t *selected, uint8_t degree, uint8_t *out) BANKED;

#endif /* MUSCLOG_OPTICAL_EXPORT_H */
