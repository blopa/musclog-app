#ifndef MUSCLOG_SRAM_H
#define MUSCLOG_SRAM_H

#include <stdint.h>

/*
 * Shared primitives for the cartridge-SRAM record stores (profile, metrics,
 * food log, workout log). Each store keeps its own header/layout, but the
 * byte-level access and the rolling checksum hash are identical across all of
 * them — these helpers are the single source of truth for that.
 *
 * Defined `static` in the header (like utils.h) so every translation unit gets
 * its own bank-local copy: no cross-bank trampolines, and bank 0 (which holds
 * the profile + food log) stays exactly the size it was with the old per-file
 * copies. The `p` argument is the base of the region to read/write — pass the
 * hardware `_SRAM` pointer for direct SRAM access, or a staging buffer for the
 * profile's pack-then-copy path.
 */

/* Little-endian 16-bit read at byte offset `off`. */
static uint16_t sram_rd16(const uint8_t *p, uint16_t off) {
    return (uint16_t)((uint16_t)p[off] | ((uint16_t)p[off + 1u] << 8u));
}

/* Little-endian 16-bit write at byte offset `off`. */
static void sram_wr16(uint8_t *p, uint16_t off, uint16_t v) {
    p[off]      = (uint8_t)(v & 0xFFu);
    p[off + 1u] = (uint8_t)(v >> 8u);
}

/* Fold one byte into the rolling checksum. Seed new hashes with 0xA55A. */
static uint16_t sram_hash_byte(uint16_t sum, uint8_t b) {
    return (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ b);
}

/* Fold `len` bytes starting at `off` into the rolling checksum. */
static uint16_t sram_hash(uint16_t sum, const uint8_t *p, uint16_t off, uint16_t len) {
    uint16_t i;

    for (i = 0u; i != len; ++i) {
        sum = sram_hash_byte(sum, p[off + i]);
    }
    return sum;
}

#endif /* MUSCLOG_SRAM_H */
