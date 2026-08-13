#ifndef MUSCLOG_OPTICAL_MATH_H
#define MUSCLOG_OPTICAL_MATH_H

#include <stdint.h>

/* SDCC places its generic 32-bit multiply helper in the already-full fixed ROM
 * bank. Keep optical arithmetic bank-local instead. */
static uint32_t optical_mul32(uint32_t a, uint32_t b) {
    uint32_t result = 0ul;
    while (b != 0ul) {
        if (b & 1ul) result += a;
        a <<= 1u;
        b >>= 1u;
    }
    return result;
}

#endif /* MUSCLOG_OPTICAL_MATH_H */
