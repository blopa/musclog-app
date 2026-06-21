#ifndef MUSCLOG_UTILS_H
#define MUSCLOG_UTILS_H

#include <stdint.h>

static uint8_t clamp_u8(uint8_t value, uint8_t min, uint8_t max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

static uint16_t clamp_u16(uint16_t value, uint16_t min, uint16_t max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

static uint16_t add_clamped_u16(uint16_t value, uint16_t amount, uint16_t max) {
    if (value > (uint16_t)(max - amount)) return max;
    return (uint16_t)(value + amount);
}

static uint16_t sub_clamped_u16(uint16_t value, uint16_t amount, uint16_t min) {
    if (value < (uint16_t)(min + amount)) return min;
    return (uint16_t)(value - amount);
}

static uint8_t add_clamped_u8(uint8_t value, uint8_t amount, uint8_t max) {
    if (value > (uint8_t)(max - amount)) return max;
    return (uint8_t)(value + amount);
}

static uint8_t sub_clamped_u8(uint8_t value, uint8_t amount, uint8_t min) {
    if (value < (uint8_t)(min + amount)) return min;
    return (uint8_t)(value - amount);
}

#endif
