#pragma bank 1

#include "metrics.h"

#include <gb/gb.h>

/* ── Bank-0 metrics sub-region layout (disjoint from the profile at 0x00..0x16) ── */
#define MX_MAGIC          0x4257u  /* 'BW' */
#define MX_VERSION        1u

#define MX_BASE           0x40u    /* profile keeps 0x00..0x3F; metrics start here */
#define MX_OFF_MAGIC      (MX_BASE + 0x00u)
#define MX_OFF_VERSION    (MX_BASE + 0x02u)
#define MX_OFF_COUNT      (MX_BASE + 0x03u)
#define MX_OFF_CHECKSUM   (MX_BASE + 0x05u)
#define MX_ENTRIES_OFFSET (MX_BASE + 0x08u)

#define MX_ENTRY_SIZE     4u
/* 8 KB bank minus the metrics base+header, in whole 4-byte records. */
#define MX_CAPACITY       ((uint16_t)((8192u - MX_ENTRIES_OFFSET) / MX_ENTRY_SIZE))

/* ── Raw SRAM bank-0 access (caller must have ENABLE_RAM + SWITCH_RAM(0u)) ──── */

static uint16_t mx_rd16(uint16_t off) {
    return (uint16_t)((uint16_t)_SRAM[off] | ((uint16_t)_SRAM[off + 1u] << 8u));
}

static void mx_wr16(uint16_t off, uint16_t v) {
    _SRAM[off]      = (uint8_t)(v & 0xFFu);
    _SRAM[off + 1u] = (uint8_t)(v >> 8u);
}

static uint16_t mx_entry_off(uint16_t idx) {
    return (uint16_t)(MX_ENTRIES_OFFSET + idx * MX_ENTRY_SIZE);
}

/* Copy a 4-byte record from one slot to another within the metrics region. */
static void mx_copy_entry(uint16_t dst, uint16_t src) {
    uint8_t i;
    for (i = 0u; i != MX_ENTRY_SIZE; ++i) {
        _SRAM[dst + i] = _SRAM[src + i];
    }
}

/* Rolling hash over the count field + all entry bytes (mirrors foodlog/profile). */
static uint16_t mx_checksum(uint16_t count) {
    uint16_t sum = 0xA55Au;
    uint16_t end = (uint16_t)(MX_ENTRIES_OFFSET + count * MX_ENTRY_SIZE);
    uint16_t i;

    sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ _SRAM[MX_OFF_COUNT]);
    sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ _SRAM[MX_OFF_COUNT + 1u]);
    for (i = MX_ENTRIES_OFFSET; i != end; ++i) {
        sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ _SRAM[i]);
    }
    return sum;
}

/* Stamp magic/version and recompute the stored checksum for `count` entries. */
static void mx_finalize(uint16_t count) {
    mx_wr16(MX_OFF_MAGIC, MX_MAGIC);
    _SRAM[MX_OFF_VERSION] = MX_VERSION;
    mx_wr16(MX_OFF_COUNT, count);
    mx_wr16(MX_OFF_CHECKSUM, mx_checksum(count));
}

/* Cheap header check used by runtime reads (full checksum is verified at boot). */
static uint8_t mx_header_ok(void) {
    return (uint8_t)(mx_rd16(MX_OFF_MAGIC) == MX_MAGIC &&
                     _SRAM[MX_OFF_VERSION] == MX_VERSION &&
                     mx_rd16(MX_OFF_COUNT) <= MX_CAPACITY);
}

/* ── Public API ───────────────────────────────────────────────────────────── */

void metrics_init(void) BANKED {
    uint8_t valid;
    uint16_t count;

    ENABLE_RAM;
    SWITCH_RAM(0u);

    valid = mx_header_ok();
    if (valid) {
        count = mx_rd16(MX_OFF_COUNT);
        valid = (uint8_t)(mx_rd16(MX_OFF_CHECKSUM) == mx_checksum(count));
    }
    if (!valid) {
        mx_finalize(0u);
    }

    DISABLE_RAM;
}

void metrics_erase(void) BANKED {
    ENABLE_RAM;
    SWITCH_RAM(0u);
    mx_finalize(0u);
    DISABLE_RAM;
}

uint8_t metrics_set_for_day(uint16_t day_num, uint16_t weight_kg_tenths) BANKED {
    uint16_t count;
    uint16_t i;
    uint16_t off;

    ENABLE_RAM;
    SWITCH_RAM(0u);

    if (!mx_header_ok()) {
        mx_finalize(0u);
    }
    count = mx_rd16(MX_OFF_COUNT);

    /* Upsert: replace today's record in place if it already exists. */
    for (i = 0u; i != count; ++i) {
        off = mx_entry_off(i);
        if (mx_rd16(off) == day_num) {
            mx_wr16((uint16_t)(off + 2u), weight_kg_tenths);
            mx_finalize(count);
            DISABLE_RAM;
            return 1u;
        }
    }

    /* Full: drop the oldest entry by shifting the rest down one slot. */
    if (count >= MX_CAPACITY) {
        for (i = 0u; (uint16_t)(i + 1u) != count; ++i) {
            mx_copy_entry(mx_entry_off(i), mx_entry_off((uint16_t)(i + 1u)));
        }
        count = (uint16_t)(count - 1u);
    }

    off = mx_entry_off(count);
    mx_wr16(off, day_num);
    mx_wr16((uint16_t)(off + 2u), weight_kg_tenths);
    mx_finalize((uint16_t)(count + 1u));

    DISABLE_RAM;
    return 1u;
}

uint16_t metrics_count(void) BANKED {
    uint16_t count = 0u;

    ENABLE_RAM;
    SWITCH_RAM(0u);
    if (mx_header_ok()) count = mx_rd16(MX_OFF_COUNT);
    DISABLE_RAM;
    return count;
}

uint8_t metrics_get(uint16_t idx, uint16_t *day_num, uint16_t *weight_kg_tenths) BANKED {
    uint16_t count;
    uint8_t  found = 0u;
    uint16_t off;

    ENABLE_RAM;
    SWITCH_RAM(0u);

    if (mx_header_ok()) {
        count = mx_rd16(MX_OFF_COUNT);
        if (idx < count) {
            off = mx_entry_off(idx);
            *day_num          = mx_rd16(off);
            *weight_kg_tenths = mx_rd16((uint16_t)(off + 2u));
            found = 1u;
        }
    }

    DISABLE_RAM;
    return found;
}

uint8_t metrics_latest(uint16_t *day_num, uint16_t *weight_kg_tenths) BANKED {
    uint16_t count;
    uint8_t  found = 0u;
    uint16_t off;

    ENABLE_RAM;
    SWITCH_RAM(0u);

    if (mx_header_ok()) {
        count = mx_rd16(MX_OFF_COUNT);
        if (count != 0u) {
            off = mx_entry_off((uint16_t)(count - 1u));
            *day_num          = mx_rd16(off);
            *weight_kg_tenths = mx_rd16((uint16_t)(off + 2u));
            found = 1u;
        }
    }

    DISABLE_RAM;
    return found;
}

void metrics_min_max(uint16_t *min_kg_tenths, uint16_t *max_kg_tenths) BANKED {
    uint16_t count;
    uint16_t i;
    uint16_t w;
    uint16_t mn = 0u;
    uint16_t mx = 0u;

    ENABLE_RAM;
    SWITCH_RAM(0u);

    if (mx_header_ok()) {
        count = mx_rd16(MX_OFF_COUNT);
        for (i = 0u; i != count; ++i) {
            w = mx_rd16((uint16_t)(mx_entry_off(i) + 2u));
            if (i == 0u) {
                mn = w;
                mx = w;
            } else {
                if (w < mn) mn = w;
                if (w > mx) mx = w;
            }
        }
    }

    DISABLE_RAM;
    *min_kg_tenths = mn;
    *max_kg_tenths = mx;
}
