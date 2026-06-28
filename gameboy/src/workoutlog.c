#pragma bank 7

#include "workoutlog.h"

#include "sram.h"
#include "volume_calc.h"

#define WL_MAGIC          0x574Cu  /* 'WL' */
#define WL_VERSION        1u

#define WL_OFF_MAGIC      0x00u
#define WL_OFF_VERSION    0x02u
#define WL_OFF_COUNT      0x03u
#define WL_OFF_BYTES      0x04u
#define WL_OFF_CHECKSUM   0x06u
#define WL_RECORDS_OFFSET 0x08u

#define WL_RECORD_HEADER_SIZE 7u
#define WL_SET_SIZE           4u
#define WL_CAPACITY           ((uint16_t)(8192u - WL_RECORDS_OFFSET))

static uint16_t wl_record_len_at(uint16_t off) {
    return (uint16_t)(WL_RECORD_HEADER_SIZE + (uint16_t)_SRAM[off + 4u] * WL_SET_SIZE);
}

static uint16_t wl_record_len_for(uint8_t set_count) {
    return (uint16_t)(WL_RECORD_HEADER_SIZE + (uint16_t)set_count * WL_SET_SIZE);
}

static uint16_t wl_checksum(uint8_t count, uint16_t bytes_used) {
    uint16_t sum = sram_hash_byte(0xA55Au, count);
    sum = sram_hash_byte(sum, (uint8_t)(bytes_used & 0xFFu));
    sum = sram_hash_byte(sum, (uint8_t)(bytes_used >> 8u));
    return sram_hash(sum, _SRAM, WL_RECORDS_OFFSET, bytes_used);
}

static void wl_finalize(uint8_t count, uint16_t bytes_used) {
    sram_wr16(_SRAM, WL_OFF_MAGIC, WL_MAGIC);
    _SRAM[WL_OFF_VERSION] = WL_VERSION;
    _SRAM[WL_OFF_COUNT] = count;
    sram_wr16(_SRAM, WL_OFF_BYTES, bytes_used);
    sram_wr16(_SRAM, WL_OFF_CHECKSUM, wl_checksum(count, bytes_used));
}

static uint8_t wl_header_ok(void) {
    return (uint8_t)(sram_rd16(_SRAM, WL_OFF_MAGIC) == WL_MAGIC &&
                     _SRAM[WL_OFF_VERSION] == WL_VERSION &&
                     sram_rd16(_SRAM, WL_OFF_BYTES) <= WL_CAPACITY);
}

static void wl_drop_oldest(uint8_t *count, uint16_t *bytes_used) {
    uint16_t oldest_len;
    uint16_t remaining;
    uint16_t i;

    if (*count == 0u) return;

    oldest_len = wl_record_len_at(WL_RECORDS_OFFSET);
    if (oldest_len > *bytes_used) {
        *count = 0u;
        *bytes_used = 0u;
        return;
    }

    remaining = (uint16_t)(*bytes_used - oldest_len);
    for (i = 0u; i != remaining; ++i) {
        _SRAM[WL_RECORDS_OFFSET + i] = _SRAM[WL_RECORDS_OFFSET + oldest_len + i];
    }

    *bytes_used = remaining;
    *count = (uint8_t)(*count - 1u);
}

static uint16_t wl_sets_volume_kg(uint8_t set_count, const WorkoutLogSet *sets) {
    uint8_t i;
    uint32_t volume = 0u;

    for (i = 0u; i != set_count; ++i) {
        volume += set_volume_1rm_kg(sets[i].weight_kg_tenths, sets[i].reps);
        if (volume > 65535u) return 65535u;
    }

    return (uint16_t)volume;
}

void workoutlog_init(void) BANKED {
    uint8_t valid;
    uint8_t count;
    uint16_t bytes_used;

    ENABLE_RAM;
    SWITCH_RAM(2u);

    valid = wl_header_ok();
    if (valid) {
        count = _SRAM[WL_OFF_COUNT];
        bytes_used = sram_rd16(_SRAM, WL_OFF_BYTES);
        valid = (uint8_t)(sram_rd16(_SRAM, WL_OFF_CHECKSUM) == wl_checksum(count, bytes_used));
    }
    if (!valid) {
        wl_finalize(0u, 0u);
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
}

void workoutlog_erase(void) BANKED {
    ENABLE_RAM;
    SWITCH_RAM(2u);
    wl_finalize(0u, 0u);
    SWITCH_RAM(0u);
    DISABLE_RAM;
}

uint8_t workoutlog_count(void) BANKED {
    uint8_t count = 0u;

    ENABLE_RAM;
    SWITCH_RAM(2u);

    if (wl_header_ok()) count = _SRAM[WL_OFF_COUNT];

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return count;
}

uint8_t workoutlog_is_full(uint8_t set_count) BANKED {
    uint8_t count;
    uint16_t bytes_used;
    uint16_t record_len;
    uint8_t full;

    record_len = wl_record_len_for(set_count);

    ENABLE_RAM;
    SWITCH_RAM(2u);

    if (!wl_header_ok()) {
        full = 0u;
    } else {
        count = _SRAM[WL_OFF_COUNT];
        bytes_used = sram_rd16(_SRAM, WL_OFF_BYTES);
        full = (uint8_t)(count >= 255u || (uint16_t)(bytes_used + record_len) > WL_CAPACITY);
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return full;
}

uint8_t workoutlog_get_summary(uint8_t newest_idx, WorkoutLogSummary *out) BANKED {
    uint8_t count;
    uint8_t target;
    uint8_t i;
    uint8_t found = 0u;
    uint16_t off;
    uint16_t len;

    ENABLE_RAM;
    SWITCH_RAM(2u);

    if (wl_header_ok()) {
        count = _SRAM[WL_OFF_COUNT];
        if (newest_idx < count) {
            target = (uint8_t)(count - 1u - newest_idx);
            off = WL_RECORDS_OFFSET;

            for (i = 0u; i != count; ++i) {
                len = wl_record_len_at(off);
                if (i == target) {
                    out->day_num = sram_rd16(_SRAM, off);
                    out->dominant_muscle = _SRAM[off + 2u];
                    out->exercise_count = _SRAM[off + 3u];
                    out->set_count = _SRAM[off + 4u];
                    out->volume_kg = sram_rd16(_SRAM, (uint16_t)(off + 5u));
                    found = 1u;
                    break;
                }
                off = (uint16_t)(off + len);
            }
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return found;
}

uint8_t workoutlog_get_sets(uint8_t newest_idx, WorkoutLogSet *out, uint8_t max) BANKED {
    uint8_t count;
    uint8_t target;
    uint8_t set_count;
    uint8_t i;
    uint8_t read = 0u;
    uint16_t off;
    uint16_t len;
    uint16_t set_off;

    ENABLE_RAM;
    SWITCH_RAM(2u);

    if (wl_header_ok()) {
        count = _SRAM[WL_OFF_COUNT];
        if (newest_idx < count) {
            target = (uint8_t)(count - 1u - newest_idx);
            off = WL_RECORDS_OFFSET;

            for (i = 0u; i != count; ++i) {
                len = wl_record_len_at(off);
                if (i == target) {
                    set_count = _SRAM[off + 4u];
                    set_off = (uint16_t)(off + WL_RECORD_HEADER_SIZE);
                    while (read != set_count && read != max) {
                        out[read].exercise_idx = _SRAM[set_off];
                        out[read].reps = _SRAM[set_off + 1u];
                        out[read].weight_kg_tenths = sram_rd16(_SRAM, (uint16_t)(set_off + 2u));
                        set_off = (uint16_t)(set_off + WL_SET_SIZE);
                        ++read;
                    }
                    break;
                }
                off = (uint16_t)(off + len);
            }
        }
    }

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return read;
}

uint8_t workoutlog_add(uint16_t day_num,
                       uint8_t dominant_muscle,
                       uint8_t exercise_count,
                       uint8_t set_count,
                       const WorkoutLogSet *sets) BANKED {
    uint8_t count;
    uint8_t i;
    uint16_t bytes_used;
    uint16_t record_len;
    uint16_t off;
    uint16_t set_off;
    uint16_t volume_kg;

    if (set_count == 0u) return 0u;

    record_len = wl_record_len_for(set_count);
    if (record_len > WL_CAPACITY) return 0u;

    volume_kg = wl_sets_volume_kg(set_count, sets);

    ENABLE_RAM;
    SWITCH_RAM(2u);

    if (!wl_header_ok()) {
        wl_finalize(0u, 0u);
    }

    count = _SRAM[WL_OFF_COUNT];
    bytes_used = sram_rd16(_SRAM, WL_OFF_BYTES);

    while ((count == 255u || (uint16_t)(bytes_used + record_len) > WL_CAPACITY) && count > 0u) {
        wl_drop_oldest(&count, &bytes_used);
    }

    if ((uint16_t)(bytes_used + record_len) > WL_CAPACITY) {
        SWITCH_RAM(0u);
        DISABLE_RAM;
        return 0u;
    }

    off = (uint16_t)(WL_RECORDS_OFFSET + bytes_used);
    sram_wr16(_SRAM, off, day_num);
    _SRAM[off + 2u] = dominant_muscle;
    _SRAM[off + 3u] = exercise_count;
    _SRAM[off + 4u] = set_count;
    sram_wr16(_SRAM, (uint16_t)(off + 5u), volume_kg);

    set_off = (uint16_t)(off + WL_RECORD_HEADER_SIZE);
    for (i = 0u; i != set_count; ++i) {
        _SRAM[set_off] = sets[i].exercise_idx;
        _SRAM[set_off + 1u] = sets[i].reps;
        sram_wr16(_SRAM, (uint16_t)(set_off + 2u), sets[i].weight_kg_tenths);
        set_off = (uint16_t)(set_off + WL_SET_SIZE);
    }

    wl_finalize((uint8_t)(count + 1u), (uint16_t)(bytes_used + record_len));

    SWITCH_RAM(0u);
    DISABLE_RAM;
    return 1u;
}
