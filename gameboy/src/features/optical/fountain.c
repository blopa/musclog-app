#pragma bank 12

#include "fountain.h"

#include <gb/gb.h>

#include "optical_math.h"
#include "qrcodegen.h"

/* Full C port of utils/optical/fountain.ts (decimen v0.3, MIT). Integer PRNG
 * operations are exact. GBDK has no floating-point runtime, so robust-soliton
 * values use Q12/Q24 fixed point. Sequences within a conservative 1% of a CDF
 * boundary are omitted; arbitrary sequence gaps are legal on the wire. */
#define Q12_ONE 4096l
#define Q12_LN2 2839l
#define Q12_SOLITON_C 410l
#define Q24_ONE 16777216ul
#define CDF_GUARD_DIVISOR 100ul
#define MAX_SELECTED_BLOCKS 64u

static uint16_t selected[MAX_SELECTED_BLOCKS];
static uint16_t scratch[MAX_SELECTED_BLOCKS];
static uint8_t fountain_block[OPTICAL_FOUNTAIN_BLOCK_LEN];
static uint16_t distribution_k;
static uint16_t distribution_spike;
static int32_t distribution_r_q12;
static uint32_t distribution_total;

typedef struct Splitmix32 {
    uint32_t state;
} Splitmix32;

static uint32_t splitmix32_next(Splitmix32 *rnd) {
    uint32_t t;
    rnd->state += 0x9E3779B9ul;
    t = rnd->state ^ (rnd->state >> 16u);
    t = optical_mul32(t, 0x21F0AAADul);
    t ^= t >> 15u;
    t = optical_mul32(t, 0x735A2D97ul);
    t ^= t >> 15u;
    return t;
}

static uint32_t frame_seed(uint16_t session_id, uint32_t seq) {
    uint32_t h = optical_mul32((uint32_t)(session_id + 1u), 0x9E3779B1ul) ^ (seq + 0x85EBCA6Bul);
    h = optical_mul32(h ^ (h >> 13u), 0xC2B2AE35ul);
    return h ^ (h >> 16u);
}

static int32_t q12_mul(int32_t a, int32_t b) {
    uint8_t negative = (uint8_t)((a < 0l) != (b < 0l));
    uint32_t left = (uint32_t)(a < 0l ? -a : a);
    uint32_t right = (uint32_t)(b < 0l ? -b : b);
    int32_t value = (int32_t)((optical_mul32(left, right) + Q12_ONE / 2l) / Q12_ONE);
    return negative ? -value : value;
}

static int32_t dlog_q12(int32_t x) {
    int8_t e = 0;
    int32_t m = x;
    int32_t z;
    int32_t z2;
    int32_t term;
    int32_t sum = 0l;
    uint8_t n;
    while (m >= 6144l) {
        m /= 2l;
        ++e;
    }
    while (m < 3072l) {
        m *= 2l;
        --e;
    }
    z = (int32_t)(optical_mul32((uint32_t)(m > Q12_ONE ? m - Q12_ONE : Q12_ONE - m), Q12_ONE) /
                  (uint32_t)(m + Q12_ONE));
    if (m < Q12_ONE) z = -z;
    z2 = q12_mul(z, z);
    term = z;
    for (n = 1u; n <= 21u; n = (uint8_t)(n + 2u)) {
        sum += term / (int32_t)n;
        term = q12_mul(term, z2);
    }
    return (e < 0 ? -(int32_t)optical_mul32((uint32_t)(-e), Q12_LN2)
                  : (int32_t)optical_mul32((uint32_t)e, Q12_LN2)) +
           2l * sum;
}

static uint16_t integer_sqrt(uint32_t value) {
    uint32_t bit = 1ul << 30u;
    uint32_t result = 0ul;
    while (bit > value)
        bit >>= 2u;
    while (bit != 0ul) {
        if (value >= result + bit) {
            value -= result + bit;
            result = (result >> 1u) + bit;
        } else {
            result >>= 1u;
        }
        bit >>= 2u;
    }
    return (uint16_t)result;
}

static uint32_t degree_weight(uint16_t k, uint16_t degree, int32_t r_q12, uint16_t spike) {
    uint32_t rho = degree == 1u ? Q24_ONE / k : Q24_ONE / optical_mul32(degree, degree - 1u);
    uint32_t tau = 0ul;
    if (degree < spike) {
        tau = ((uint32_t)r_q12 << 12u) / optical_mul32(degree, k);
    } else if (degree == spike) {
        int32_t value = dlog_q12(r_q12 * 2l);
        if (value > 0l) tau = ((uint32_t)q12_mul(r_q12, value) << 12u) / k;
    }
    return rho + tau;
}

void fountain_prepare(uint16_t block_count) BANKED {
    int32_t log_q12;
    int32_t sqrt_q12;
    uint16_t degree;

    distribution_k = block_count;
    distribution_spike = 1u;
    distribution_r_q12 = Q12_ONE;
    distribution_total = Q24_ONE;
    if (block_count <= 1u) return;

    log_q12 = dlog_q12((int32_t)block_count * 2l * Q12_ONE);
    sqrt_q12 = (int32_t)integer_sqrt((uint32_t)block_count << 12u) * 64l;
    distribution_r_q12 = q12_mul(q12_mul(Q12_SOLITON_C, log_q12), sqrt_q12);
    if (distribution_r_q12 < Q12_ONE) distribution_r_q12 = Q12_ONE;
    distribution_spike = (uint16_t)(((uint32_t)block_count << 12u) / (uint32_t)distribution_r_q12);
    if (optical_mul32(distribution_spike, (uint32_t)distribution_r_q12) <
        ((uint32_t)block_count << 12u)) {
        ++distribution_spike;
    }
    if (distribution_spike > block_count) distribution_spike = block_count;

    distribution_total = 0ul;
    for (degree = 1u; degree <= block_count; ++degree) {
        distribution_total +=
            degree_weight(block_count, degree, distribution_r_q12, distribution_spike);
    }
}

static uint8_t sample_degree(uint16_t k, Splitmix32 *rnd) {
    uint32_t cumulative = 0ul;
    uint32_t target;
    uint32_t difference;
    uint16_t u_q12;
    uint16_t degree;

    if (k == 1u) {
        (void)splitmix32_next(rnd);
        return 1u;
    }
    if (distribution_k != k) fountain_prepare(k);

    u_q12 = (uint16_t)(splitmix32_next(rnd) >> 20u);
    target = optical_mul32(distribution_total >> 12u, u_q12);
    for (degree = 1u; degree <= k; ++degree) {
        cumulative += degree_weight(k, degree, distribution_r_q12, distribution_spike);
        difference = cumulative > target ? cumulative - target : target - cumulative;
        if (difference < distribution_total / CDF_GUARD_DIVISOR) return 0u;
        if (cumulative >= target) return degree > 255u ? 0u : (uint8_t)degree;
    }
    return k > 255u ? 0u : (uint8_t)k;
}

static uint8_t contains_selected(uint8_t count, uint16_t value) {
    uint8_t i;
    for (i = 0u; i != count; ++i) {
        if (selected[i] == value) return 1u;
    }
    return 0u;
}

static void sort_selected(uint8_t count) {
    uint8_t i;
    uint8_t j;
    uint16_t value;
    for (i = 1u; i != count; ++i) {
        value = selected[i];
        j = i;
        while (j != 0u && selected[j - 1u] > value) {
            selected[j] = selected[j - 1u];
            --j;
        }
        selected[j] = value;
    }
}

static uint8_t frame_indices(uint16_t k, uint16_t session_id, uint32_t seq) {
    Splitmix32 rnd;
    uint8_t degree;
    uint8_t i;
    uint16_t j;
    uint16_t remaining;
    uint16_t value;
    if (k == 0u) return 0u;
    rnd.state = frame_seed(session_id, seq);
    degree = sample_degree(k, &rnd);
    if (degree == 0u || degree > k || degree > MAX_SELECTED_BLOCKS) return 0u;

    if (degree > (k >> 3u)) {
        if (k > MAX_SELECTED_BLOCKS) return 0u;
        for (i = 0u; i != (uint8_t)k; ++i)
            scratch[i] = i;
        for (i = 0u; i != degree; ++i) {
            remaining = (uint16_t)(k - i);
            if (remaining == 0u) return 0u;
            j = (uint16_t)(i + splitmix32_next(&rnd) % remaining);
            value = scratch[i];
            scratch[i] = scratch[j];
            scratch[j] = value;
            selected[i] = scratch[i];
        }
    } else {
        i = 0u;
        while (i != degree) {
            value = (uint16_t)(splitmix32_next(&rnd) % k);
            if (!contains_selected(i, value)) selected[i++] = value;
        }
    }
    sort_selected(degree);
    return degree;
}

static void write_u16(uint8_t *out, uint16_t offset, uint16_t value) {
    out[offset] = (uint8_t)value;
    out[offset + 1u] = (uint8_t)(value >> 8u);
}

static void write_u32(uint8_t *out, uint16_t offset, uint32_t value) {
    out[offset] = (uint8_t)value;
    out[offset + 1u] = (uint8_t)(value >> 8u);
    out[offset + 2u] = (uint8_t)(value >> 16u);
    out[offset + 3u] = (uint8_t)(value >> 24u);
}

static void base44_encode(const uint8_t *bytes, char *text) {
    static const char alphabet[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$%*+-./:";
    uint16_t input = 0u;
    uint16_t output = 0u;
    uint16_t value;
    while (input != OPTICAL_FRAME_LEN) {
        value = (uint16_t)((uint16_t)bytes[input] * 256u + bytes[input + 1u]);
        text[output++] = alphabet[value / 1936u];
        text[output++] = alphabet[(value / 44u) % 44u];
        text[output++] = alphabet[value % 44u];
        input = (uint16_t)(input + 2u);
    }
}

void fountain_build_next(const OpticalExportInfo *info, uint32_t *next_seq) BANKED {
    uint8_t degree;
    uint32_t seq;
    uint8_t *frame;
    char *text;
    uint16_t i;

    do {
        seq = (*next_seq)++;
        degree = frame_indices(info->block_count, info->session_id, seq);
    } while (degree == 0u);

    optical_export_xor_blocks(selected, degree, fountain_block);

    ENABLE_RAM;
    SWITCH_RAM(QR_SRAM_BANK);
    frame = (uint8_t *)_SRAM + OPTICAL_SRAM_FRAME_OFFSET;
    text = (char *)_SRAM + OPTICAL_SRAM_TEXT_OFFSET;
    frame[0] = 0xD1u;
    frame[1] = 0x0Cu;
    write_u16(frame, 2u, info->session_id);
    write_u32(frame, 4u, seq);
    write_u16(frame, 8u, info->block_count);
    write_u16(frame, 10u, OPTICAL_FOUNTAIN_BLOCK_LEN);
    write_u32(frame, 12u, info->total_len);
    write_u32(frame, 16u, info->payload_fnv);
    for (i = 0u; i != OPTICAL_FOUNTAIN_BLOCK_LEN; ++i) {
        frame[OPTICAL_FRAME_HEADER_LEN + i] = fountain_block[i];
    }
    base44_encode(frame, text);
    SWITCH_RAM(0u);
    DISABLE_RAM;
}
