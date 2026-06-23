#include "profile.h"

#include <gb/gb.h>
#include <string.h>

/*
 * Profile data lives in cartridge SRAM bank 0, accessed through the hardware
 * _SRAM pointer (0xA000) after ENABLE_RAM + SWITCH_RAM(0) — the same idiom the
 * food log uses for bank 1 (see foodlog.c).
 *
 * A previous version stored this in a C array tagged `#pragma dataseg DATA_0`.
 * That array was never battery-backed (it landed in volatile WRAM), so the
 * profile silently vanished on every power cycle while the raw-_SRAM food log
 * survived — the onboarding screen reappeared on each boot. Always go through
 * _SRAM[] for persisted data; do not reintroduce a dataseg C array here.
 */

/* ── Checksum ─────────────────────────────────────────────────────────────── */

static uint16_t raw_rd16(const uint8_t *raw, uint8_t off) {
    return (uint16_t)((uint16_t)raw[off] | ((uint16_t)raw[off + 1u] << 8u));
}

static void raw_wr16(uint8_t *raw, uint8_t off, uint16_t v) {
    raw[off]      = (uint8_t)(v & 0xFFu);
    raw[off + 1u] = (uint8_t)(v >> 8u);
}

static void db_pack_without_checksum(const SaveData *data, uint8_t *raw) {
    memset(raw, 0, SRAM_SAVE_SIZE);

    raw_wr16(raw, SRAM_MAGIC, SAVE_MAGIC);
    raw[SRAM_VERSION] = SAVE_VERSION;
    raw[SRAM_FLAGS1] = (uint8_t)(
        ((data->units              & 1u) << FLAGS1_UNITS_BIT)          |
        ((data->gender             & 3u) << FLAGS1_GENDER_SHIFT)        |
        (((data->activity_level - 1u) & 7u) << FLAGS1_ACTIVITY_SHIFT)  |
        ((data->lifting_experience & 3u) << FLAGS1_EXPERIENCE_SHIFT)
    );
    raw[SRAM_FLAGS2] = (uint8_t)(
        ((data->fitness_focus        & 3u) << FLAGS2_FITNESS_SHIFT)      |
        ((data->weight_goal          & 3u) << FLAGS2_WEIGHT_GOAL_SHIFT)   |
        ((data->onboarding_complete  & 1u) << FLAGS2_ONBOARDING_BIT)     |
        ((data->rtc_is_set           & 1u) << FLAGS2_RTC_IS_SET_BIT)
    );

    raw[SRAM_AGE]          = data->age;
    raw[SRAM_HEIGHT]       = (uint8_t)(data->height_cm - DB_HEIGHT_CM_MIN);
    raw_wr16(raw, SRAM_WEIGHT, (uint16_t)(data->weight_kg_tenths - DB_WEIGHT_KG_TENTHS_MIN));
    raw_wr16(raw, SRAM_CAL_GOAL, data->calorie_goal);
    raw_wr16(raw, SRAM_PROTEIN_GOAL, data->protein_goal);
    raw_wr16(raw, SRAM_CARBS_GOAL, data->carbs_goal);
    raw_wr16(raw, SRAM_FAT_GOAL, data->fat_goal);
    raw[SRAM_FIBER_GOAL]   = (uint8_t)(data->fiber_goal & 0xFFu);
    raw[SRAM_RTC_YEAR_OFS] = (uint8_t)(data->rtc_base_date.year - 2000u);
    raw[SRAM_RTC_MONTH]    = data->rtc_base_date.month;
    raw[SRAM_RTC_DAY]      = data->rtc_base_date.day;
}

static uint16_t db_checksum_bytes(const uint8_t *raw) {
    uint16_t sum = 0xA55Au;
    uint8_t i;
    uint8_t b;

    for (i = 0u; i != SRAM_SAVE_SIZE; ++i) {
        b = (i == SRAM_CHECKSUM || i == (uint8_t)(SRAM_CHECKSUM + 1u)) ? 0u : raw[i];
        sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ b);
    }
    return sum;
}

static uint16_t db_checksum(const SaveData *data) {
    uint8_t raw[SRAM_SAVE_SIZE];

    db_pack_without_checksum(data, raw);
    return db_checksum_bytes(raw);
}

/* ── Public API ───────────────────────────────────────────────────────────── */

void db_init_defaults(SaveData *data) {
    memset(data, 0, sizeof(SaveData));
    data->magic               = SAVE_MAGIC;
    data->version             = SAVE_VERSION;
    data->onboarding_complete = 0u;
    data->units               = UNITS_METRIC;
    data->gender              = GENDER_MALE;
    data->age                 = 30u;
    data->height_cm           = 170u;
    data->weight_kg_tenths    = 750u;
    data->activity_level      = 2u;
    data->lifting_experience  = EXPERIENCE_BEGINNER;
    data->fitness_focus       = FITNESS_GENERAL;
    data->weight_goal         = WEIGHT_GOAL_MAINTAIN;
    data->rtc_is_set          = 0u;
    data->rtc_base_date.year  = 2025u;
    data->rtc_base_date.month = 1u;
    data->rtc_base_date.day   = 1u;
}

uint8_t db_is_valid(const SaveData *data) {
    if (data->magic   != SAVE_MAGIC)   return 0u;
    if (data->version != SAVE_VERSION) return 0u;
    if (data->checksum != db_checksum(data)) return 0u;
    return 1u;
}

/*
 * db_load — decode packed SRAM bytes into a SaveData struct.
 *
 * Returns 1 if magic, version, and checksum are all valid; 0 otherwise.
 */
uint8_t db_load(SaveData *out) {
    uint8_t  flags1;
    uint8_t  flags2;
    uint16_t weight_off;
    uint8_t  raw[SRAM_SAVE_SIZE];
    uint8_t  i;

    ENABLE_RAM;
    SWITCH_RAM(0u);

    for (i = 0u; i != SRAM_SAVE_SIZE; ++i) {
        raw[i] = _SRAM[i];
    }

    DISABLE_RAM;

    if (raw_rd16(raw, SRAM_MAGIC) != SAVE_MAGIC || raw[SRAM_VERSION] != SAVE_VERSION) return 0u;
    if (raw_rd16(raw, SRAM_CHECKSUM) != db_checksum_bytes(raw)) return 0u;

    /* Decode SRAM_FLAGS1 */
    flags1 = raw[SRAM_FLAGS1];
    out->units              = (flags1 >> FLAGS1_UNITS_BIT) & 1u;
    out->gender             = (flags1 >> FLAGS1_GENDER_SHIFT) & 3u;
    out->activity_level     = (uint8_t)(((flags1 >> FLAGS1_ACTIVITY_SHIFT) & 7u) + 1u);
    out->lifting_experience = (flags1 >> FLAGS1_EXPERIENCE_SHIFT) & 3u;

    /* Decode SRAM_FLAGS2 */
    flags2 = raw[SRAM_FLAGS2];
    out->fitness_focus       = (flags2 >> FLAGS2_FITNESS_SHIFT) & 3u;
    out->weight_goal         = (flags2 >> FLAGS2_WEIGHT_GOAL_SHIFT) & 3u;
    out->onboarding_complete = (flags2 >> FLAGS2_ONBOARDING_BIT) & 1u;
    out->rtc_is_set          = (flags2 >> FLAGS2_RTC_IS_SET_BIT) & 1u;

    /* Decode scalar fields */
    out->age       = raw[SRAM_AGE];
    out->height_cm = (uint16_t)(raw[SRAM_HEIGHT] + DB_HEIGHT_CM_MIN);

    weight_off = raw_rd16(raw, SRAM_WEIGHT);
    out->weight_kg_tenths = (uint16_t)(weight_off + DB_WEIGHT_KG_TENTHS_MIN);

    out->calorie_goal = raw_rd16(raw, SRAM_CAL_GOAL);
    out->protein_goal = raw_rd16(raw, SRAM_PROTEIN_GOAL);
    out->carbs_goal   = raw_rd16(raw, SRAM_CARBS_GOAL);
    out->fat_goal     = raw_rd16(raw, SRAM_FAT_GOAL);
    out->fiber_goal   = raw[SRAM_FIBER_GOAL];

    /* Decode RTC calibration */
    out->rtc_base_date.year  = (uint16_t)(2000u + raw[SRAM_RTC_YEAR_OFS]);
    out->rtc_base_date.month = raw[SRAM_RTC_MONTH];
    out->rtc_base_date.day   = raw[SRAM_RTC_DAY];

    /* Restore header fields used by db_is_valid */
    out->magic    = SAVE_MAGIC;
    out->version  = SAVE_VERSION;
    out->checksum = raw_rd16(raw, SRAM_CHECKSUM);

    return 1u;
}

/*
 * db_save — encode SaveData into packed SRAM bytes and write to bank 0.
 *
 * Saves data exactly as given; caller is responsible for setting
 * onboarding_complete before calling. Recomputes the checksum.
 */
void db_save(const SaveData *data) {
    uint8_t  raw[SRAM_SAVE_SIZE];
    uint8_t  i;
    uint16_t checksum;

    db_pack_without_checksum(data, raw);
    checksum = db_checksum_bytes(raw);
    raw_wr16(raw, SRAM_CHECKSUM, checksum);

    ENABLE_RAM;
    SWITCH_RAM(0u);
    for (i = 0u; i != SRAM_SAVE_SIZE; ++i) {
        _SRAM[i] = raw[i];
    }
    DISABLE_RAM;
}

/* db_erase — zero the save block; the next boot will trigger onboarding. */
void db_erase(void) {
    uint8_t i;

    ENABLE_RAM;
    SWITCH_RAM(0u);
    for (i = 0u; i != SRAM_SAVE_SIZE; ++i) {
        _SRAM[i] = 0u;
    }
    DISABLE_RAM;
}
