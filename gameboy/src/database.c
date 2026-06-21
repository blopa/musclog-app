#include "database.h"

#include <gb/gb.h>
#include <string.h>

/*
 * Raw SRAM bank 0 — SRAM_SAVE_SIZE bytes at offset 0.
 * All data is encoded/decoded explicitly; no struct-layout assumptions.
 */
#pragma dataseg DATA_0
static uint8_t sram_bank[SRAM_SAVE_SIZE];
#pragma dataseg DATA

/* ── Checksum ─────────────────────────────────────────────────────────────── */

static uint16_t db_checksum(const SaveData *data) {
    SaveData copy;
    const uint8_t *bytes;
    uint16_t sum = 0xA55Au;
    uint8_t i;

    copy = *data;
    copy.checksum = 0u;
    bytes = (const uint8_t *)&copy;

    for (i = 0u; i != sizeof(SaveData); ++i) {
        sum = (uint16_t)((sum << 5u) ^ (sum >> 1u) ^ bytes[i]);
    }
    return sum;
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
    uint16_t magic;
    uint8_t  flags1;
    uint8_t  flags2;
    uint16_t weight_off;

    ENABLE_RAM;
    SWITCH_RAM(0u);

    magic = (uint16_t)((uint16_t)sram_bank[SRAM_MAGIC + 1u] << 8u)
          | (uint16_t)sram_bank[SRAM_MAGIC];

    if (magic != SAVE_MAGIC || sram_bank[SRAM_VERSION] != SAVE_VERSION) {
        DISABLE_RAM;
        return 0u;
    }

    /* Decode SRAM_FLAGS1 */
    flags1 = sram_bank[SRAM_FLAGS1];
    out->units              = (flags1 >> FLAGS1_UNITS_BIT) & 1u;
    out->gender             = (flags1 >> FLAGS1_GENDER_SHIFT) & 3u;
    out->activity_level     = (uint8_t)(((flags1 >> FLAGS1_ACTIVITY_SHIFT) & 7u) + 1u);
    out->lifting_experience = (flags1 >> FLAGS1_EXPERIENCE_SHIFT) & 3u;

    /* Decode SRAM_FLAGS2 */
    flags2 = sram_bank[SRAM_FLAGS2];
    out->fitness_focus       = (flags2 >> FLAGS2_FITNESS_SHIFT) & 3u;
    out->weight_goal         = (flags2 >> FLAGS2_WEIGHT_GOAL_SHIFT) & 3u;
    out->onboarding_complete = (flags2 >> FLAGS2_ONBOARDING_BIT) & 1u;
    out->rtc_is_set          = (flags2 >> FLAGS2_RTC_IS_SET_BIT) & 1u;

    /* Decode scalar fields */
    out->age       = sram_bank[SRAM_AGE];
    out->height_cm = (uint16_t)(sram_bank[SRAM_HEIGHT] + DB_HEIGHT_CM_MIN);

    weight_off = (uint16_t)((uint16_t)sram_bank[SRAM_WEIGHT + 1u] << 8u)
               | (uint16_t)sram_bank[SRAM_WEIGHT];
    out->weight_kg_tenths = (uint16_t)(weight_off + DB_WEIGHT_KG_TENTHS_MIN);

    out->calorie_goal = (uint16_t)((uint16_t)sram_bank[SRAM_CAL_GOAL + 1u] << 8u)
                      | (uint16_t)sram_bank[SRAM_CAL_GOAL];
    out->protein_goal = (uint16_t)((uint16_t)sram_bank[SRAM_PROTEIN_GOAL + 1u] << 8u)
                      | (uint16_t)sram_bank[SRAM_PROTEIN_GOAL];
    out->carbs_goal   = (uint16_t)((uint16_t)sram_bank[SRAM_CARBS_GOAL + 1u] << 8u)
                      | (uint16_t)sram_bank[SRAM_CARBS_GOAL];
    out->fat_goal     = (uint16_t)((uint16_t)sram_bank[SRAM_FAT_GOAL + 1u] << 8u)
                      | (uint16_t)sram_bank[SRAM_FAT_GOAL];
    out->fiber_goal   = sram_bank[SRAM_FIBER_GOAL];

    /* Decode RTC calibration */
    out->rtc_base_date.year  = (uint16_t)(2000u + sram_bank[SRAM_RTC_YEAR_OFS]);
    out->rtc_base_date.month = sram_bank[SRAM_RTC_MONTH];
    out->rtc_base_date.day   = sram_bank[SRAM_RTC_DAY];

    /* Restore header fields used by db_is_valid */
    out->magic    = SAVE_MAGIC;
    out->version  = SAVE_VERSION;
    out->checksum = (uint16_t)((uint16_t)sram_bank[SRAM_CHECKSUM + 1u] << 8u)
                  | (uint16_t)sram_bank[SRAM_CHECKSUM];

    DISABLE_RAM;

    return db_is_valid(out);
}

/*
 * db_save — encode SaveData into packed SRAM bytes and write to bank 0.
 *
 * Always stamps onboarding_complete=1 and recomputes the checksum.
 */
void db_save(const SaveData *data) {
    SaveData stamped;
    uint8_t  flags1;
    uint8_t  flags2;
    uint16_t weight_off;
    uint16_t checksum;
    uint8_t  year_ofs;

    stamped = *data;
    stamped.magic               = SAVE_MAGIC;
    stamped.version             = SAVE_VERSION;
    stamped.onboarding_complete = 1u;
    stamped.checksum            = 0u;
    checksum = db_checksum(&stamped);

    /* Pack SRAM_FLAGS1: [7:6]=experience [5:3]=activity-1 [2:1]=gender [0]=units */
    flags1 = (uint8_t)(
        ((data->units              & 1u) << FLAGS1_UNITS_BIT)          |
        ((data->gender             & 3u) << FLAGS1_GENDER_SHIFT)        |
        (((data->activity_level - 1u) & 7u) << FLAGS1_ACTIVITY_SHIFT)  |
        ((data->lifting_experience & 3u) << FLAGS1_EXPERIENCE_SHIFT)
    );

    /* Pack SRAM_FLAGS2: [5]=rtc_is_set [4]=onboarding [3:2]=weight_goal [1:0]=fitness */
    flags2 = (uint8_t)(
        ((data->fitness_focus & 3u) << FLAGS2_FITNESS_SHIFT)      |
        ((data->weight_goal   & 3u) << FLAGS2_WEIGHT_GOAL_SHIFT)   |
        (1u                         << FLAGS2_ONBOARDING_BIT)      |
        ((data->rtc_is_set    & 1u) << FLAGS2_RTC_IS_SET_BIT)
    );

    weight_off = (uint16_t)(data->weight_kg_tenths - DB_WEIGHT_KG_TENTHS_MIN);
    year_ofs   = (uint8_t)(data->rtc_base_date.year - 2000u);

    ENABLE_RAM;
    SWITCH_RAM(0u);

    sram_bank[SRAM_MAGIC]             = (uint8_t)(SAVE_MAGIC & 0xFFu);
    sram_bank[SRAM_MAGIC + 1u]        = (uint8_t)(SAVE_MAGIC >> 8u);
    sram_bank[SRAM_VERSION]           = SAVE_VERSION;
    sram_bank[SRAM_CHECKSUM]          = (uint8_t)(checksum   & 0xFFu);
    sram_bank[SRAM_CHECKSUM + 1u]     = (uint8_t)(checksum   >> 8u);
    sram_bank[SRAM_FLAGS1]            = flags1;
    sram_bank[SRAM_FLAGS2]            = flags2;
    sram_bank[SRAM_AGE]               = data->age;
    sram_bank[SRAM_HEIGHT]            = (uint8_t)(data->height_cm - DB_HEIGHT_CM_MIN);
    sram_bank[SRAM_WEIGHT]            = (uint8_t)(weight_off  & 0xFFu);
    sram_bank[SRAM_WEIGHT + 1u]       = (uint8_t)(weight_off  >> 8u);
    sram_bank[SRAM_CAL_GOAL]          = (uint8_t)(data->calorie_goal  & 0xFFu);
    sram_bank[SRAM_CAL_GOAL + 1u]     = (uint8_t)(data->calorie_goal  >> 8u);
    sram_bank[SRAM_PROTEIN_GOAL]      = (uint8_t)(data->protein_goal  & 0xFFu);
    sram_bank[SRAM_PROTEIN_GOAL + 1u] = (uint8_t)(data->protein_goal  >> 8u);
    sram_bank[SRAM_CARBS_GOAL]        = (uint8_t)(data->carbs_goal    & 0xFFu);
    sram_bank[SRAM_CARBS_GOAL + 1u]   = (uint8_t)(data->carbs_goal    >> 8u);
    sram_bank[SRAM_FAT_GOAL]          = (uint8_t)(data->fat_goal      & 0xFFu);
    sram_bank[SRAM_FAT_GOAL + 1u]     = (uint8_t)(data->fat_goal      >> 8u);
    sram_bank[SRAM_FIBER_GOAL]        = (uint8_t)(data->fiber_goal    & 0xFFu);
    sram_bank[SRAM_RTC_YEAR_OFS]      = year_ofs;
    sram_bank[SRAM_RTC_MONTH]         = data->rtc_base_date.month;
    sram_bank[SRAM_RTC_DAY]           = data->rtc_base_date.day;

    DISABLE_RAM;
}

/* db_erase — zero the save block; the next boot will trigger onboarding. */
void db_erase(void) {
    uint8_t i;

    ENABLE_RAM;
    SWITCH_RAM(0u);
    for (i = 0u; i != SRAM_SAVE_SIZE; ++i) {
        sram_bank[i] = 0u;
    }
    DISABLE_RAM;
}
