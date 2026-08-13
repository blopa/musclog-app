#ifndef MUSCLOG_OPTICAL_SHA256_H
#define MUSCLOG_OPTICAL_SHA256_H

#include <stdint.h>

typedef struct OpticalSha256 {
    uint32_t state[8];
    uint32_t byte_count;
    uint8_t block[64];
    uint8_t block_len;
} OpticalSha256;

void optical_sha256_init(OpticalSha256 *ctx);
void optical_sha256_byte(OpticalSha256 *ctx, uint8_t value);
void optical_sha256_finish(OpticalSha256 *ctx, uint8_t digest[32]);

#endif /* MUSCLOG_OPTICAL_SHA256_H */
