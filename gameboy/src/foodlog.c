#include "foodlog.h"

#include <gb/gb.h>

#include "food_db.h"

/* ── Bank-1 layout constants ──────────────────────────────────────────────── */
#define FL_MAGIC          0x464Cu  /* 'FL' */
#define FL_VERSION        1u

#define FL_OFF_MAGIC      0x00u
#define FL_OFF_VERSION    0x02u
#define FL_OFF_COUNT      0x03u
#define FL_OFF_CHECKSUM   0x05u
#define FL_ENTRIES_OFFSET 0x08u

#define FL_ENTRY_SIZE     6u
/* 8 KB bank minus the 8-byte header, in whole 6-byte records. */
#define FL_CAPACITY       ((uint16_t)((8192u - FL_ENTRIES_OFFSET) / FL_ENTRY_SIZE))

/* ── Raw SRAM bank-1 access (caller must have ENABLE_RAM + SWITCH_RAM(1u)) ──── */

static uint16_t fl_rd16(uint16_t off) {
    return (uint16_t)((uint16_t)_SRAM[off] | ((uint16_t)_SRAM[off + 1u] << 8u));
}

static void fl_wr16(uint16_t off, uint16_t v) {
    _SRAM[off]      = (uint8_t)(v & 0xFFu);
    _SRAM[off + 1u] = (uint8_t)(v >> 8u);
}

static uint16_t fl_entry_off(uint16_t idx) {
    return (uint16_t)(FL_ENTRIES_OFFSET + idx * FL_ENTRY_SIZE);
}

/* Copy a 6-byte record from one slot to another within bank 1. */
static void fl_copy_entry(uint16_t dst, uint16_t src) {
    uint8_t i;
    for (i = 0u; i != FL_ENTRY_SIZE; ++i) {
        _SRAM[dst + i] = _SRAM[src + i];
    }
}

/* Rolling hash over the count field + all entry bytes (mirrors db_checksum). */
static uint16_t fl_checksum(uint16_t count) {
    uint16_t sum = 0xA55Au;
    uint16_t end = (uint16_t)(FL_ENTRIES_OFFSET + count * FL_ENTRY_SIZE);
    uint16_t i;

    sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ _SRAM[FL_OFF_COUNT]);
    sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ _SRAM[FL_OFF_COUNT + 1u]);
    for (i = FL_ENTRIES_OFFSET; i != end; ++i) {
        sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ _SRAM[i]);
    }
    return sum;
}

/* Stamp magic/version and recompute the stored checksum for `count` entries. */
static void fl_finalize(uint16_t count) {
    fl_wr16(FL_OFF_MAGIC, FL_MAGIC);
    _SRAM[FL_OFF_VERSION] = FL_VERSION;
    fl_wr16(FL_OFF_COUNT, count);
    fl_wr16(FL_OFF_CHECKSUM, fl_checksum(count));
}

/* Cheap header check used by runtime reads (full checksum is verified at boot). */
static uint8_t fl_header_ok(void) {
    return (uint8_t)(fl_rd16(FL_OFF_MAGIC) == FL_MAGIC &&
                     _SRAM[FL_OFF_VERSION] == FL_VERSION &&
                     fl_rd16(FL_OFF_COUNT) <= FL_CAPACITY);
}

/* ── Public API ───────────────────────────────────────────────────────────── */

void foodlog_init(void) {
    uint8_t valid;
    uint16_t count;

    ENABLE_RAM;
    SWITCH_RAM(1u);

    valid = fl_header_ok();
    if (valid) {
        count = fl_rd16(FL_OFF_COUNT);
        valid = (uint8_t)(fl_rd16(FL_OFF_CHECKSUM) == fl_checksum(count));
    }
    if (!valid) {
        fl_finalize(0u);
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
}

void foodlog_erase(void) {
    ENABLE_RAM;
    SWITCH_RAM(1u);
    fl_finalize(0u);
    SWITCH_RAM(0u);
    DISABLE_RAM;
}

uint8_t foodlog_add(uint16_t day_num, uint16_t food_idx, uint16_t grams) {
    uint16_t count;
    uint16_t i;
    uint16_t off;

    ENABLE_RAM;
    SWITCH_RAM(1u);

    count = fl_rd16(FL_OFF_COUNT);

    /* Full: drop the oldest entry by shifting the rest down one slot. */
    if (count >= FL_CAPACITY) {
        for (i = 0u; (uint16_t)(i + 1u) != count; ++i) {
            fl_copy_entry(fl_entry_off(i), fl_entry_off((uint16_t)(i + 1u)));
        }
        count = (uint16_t)(count - 1u);
    }

    off = fl_entry_off(count);
    fl_wr16(off, day_num);
    fl_wr16((uint16_t)(off + 2u), food_idx);
    fl_wr16((uint16_t)(off + 4u), grams);

    fl_finalize((uint16_t)(count + 1u));

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return 1u;
}

uint8_t foodlog_count_for_day(uint16_t day_num) {
    uint16_t count;
    uint16_t i;
    uint8_t  n = 0u;

    ENABLE_RAM;
    SWITCH_RAM(1u);

    if (fl_header_ok()) {
        count = fl_rd16(FL_OFF_COUNT);
        for (i = 0u; i != count; ++i) {
            if (fl_rd16(fl_entry_off(i)) == day_num && n != 255u) ++n;
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return n;
}

uint8_t foodlog_get_for_day(uint16_t day_num, uint8_t nth,
                            uint16_t *food_idx, uint16_t *grams) {
    uint16_t count;
    uint16_t i;
    uint8_t  seen = 0u;
    uint8_t  found = 0u;
    uint16_t off;

    ENABLE_RAM;
    SWITCH_RAM(1u);

    if (fl_header_ok()) {
        count = fl_rd16(FL_OFF_COUNT);
        for (i = 0u; i != count; ++i) {
            off = fl_entry_off(i);
            if (fl_rd16(off) != day_num) continue;
            if (seen == nth) {
                *food_idx = fl_rd16((uint16_t)(off + 2u));
                *grams    = fl_rd16((uint16_t)(off + 4u));
                found = 1u;
                break;
            }
            ++seen;
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return found;
}

void foodlog_delete_for_day(uint16_t day_num, uint8_t nth) {
    uint16_t count;
    uint16_t i;
    uint8_t  seen = 0u;
    uint16_t target = 0u;
    uint8_t  found = 0u;

    ENABLE_RAM;
    SWITCH_RAM(1u);

    if (!fl_header_ok()) {
        SWITCH_RAM(0u);
        DISABLE_RAM;
        return;
    }

    count = fl_rd16(FL_OFF_COUNT);
    for (i = 0u; i != count; ++i) {
        if (fl_rd16(fl_entry_off(i)) != day_num) continue;
        if (seen == nth) { target = i; found = 1u; break; }
        ++seen;
    }

    if (found) {
        for (i = target; (uint16_t)(i + 1u) != count; ++i) {
            fl_copy_entry(fl_entry_off(i), fl_entry_off((uint16_t)(i + 1u)));
        }
        fl_finalize((uint16_t)(count - 1u));
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
}

void foodlog_scale(const FoodCache *fc, uint16_t grams,
                   uint16_t *cal, uint16_t *pro, uint16_t *carb,
                   uint16_t *fat, uint16_t *fib) {
    *cal  = (uint16_t)(((uint32_t)fc->kcal * grams + 50u) / 100u);
    *pro  = (uint16_t)(((uint32_t)fc->protein_dg * grams + 500u) / 1000u);
    *carb = (uint16_t)(((uint32_t)fc->carbs_dg   * grams + 500u) / 1000u);
    *fat  = (uint16_t)(((uint32_t)fc->fat_dg     * grams + 500u) / 1000u);
    *fib  = (uint16_t)(((uint32_t)fc->fiber_dg   * grams + 500u) / 1000u);
}

uint16_t foodlog_digestible_carbs(uint16_t carbs, uint16_t fiber) {
    return carbs > fiber ? (uint16_t)(carbs - fiber) : 0u;
}

void foodlog_sum_day(uint16_t day_num,
                     uint16_t *cal, uint16_t *pro, uint16_t *carb,
                     uint16_t *fat, uint16_t *fib) {
    uint16_t count;
    uint16_t i;
    uint16_t off;
    uint16_t food_idx;
    uint16_t grams;
    FoodCache fc;
    uint16_t c, p, cb, f, fb;

    *cal = 0u; *pro = 0u; *carb = 0u; *fat = 0u; *fib = 0u;

    ENABLE_RAM;
    SWITCH_RAM(1u);

    if (fl_header_ok()) {
        count = fl_rd16(FL_OFF_COUNT);
        for (i = 0u; i != count; ++i) {
            off = fl_entry_off(i);
            if (fl_rd16(off) != day_num) continue;
            food_idx = fl_rd16((uint16_t)(off + 2u));
            grams    = fl_rd16((uint16_t)(off + 4u));
            /* ff_load switches ROM food banks (not the RAM bank), so reading the
             * food while bank-1 SRAM is mapped is safe. */
            ff_load(food_idx, &fc);
            foodlog_scale(&fc, grams, &c, &p, &cb, &f, &fb);
            *cal  = (uint16_t)(*cal  + c);
            *pro  = (uint16_t)(*pro  + p);
            *carb = (uint16_t)(*carb + cb);
            *fat  = (uint16_t)(*fat  + f);
            *fib  = (uint16_t)(*fib  + fb);
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
}
