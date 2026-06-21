#include "storage.h"

#include <gb/gb.h>
#include <string.h>

#pragma dataseg DATA_0
static SaveData sram_save;
#pragma dataseg DATA

static uint16_t storage_checksum(const SaveData *data) {
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

void storage_init_defaults(SaveData *data) {
    memset(data, 0, sizeof(SaveData));
    data->magic = SAVE_MAGIC;
    data->version = SAVE_VERSION;
    data->onboarding_complete = 0u;
    data->units = UNITS_METRIC;
    data->gender = GENDER_MALE;
    data->age = 30u;
    data->height_cm = 170u;
    data->weight_kg_tenths = 750u;
    data->activity_level = 2u;
    data->lifting_experience = EXPERIENCE_BEGINNER;
    data->fitness_focus = FITNESS_GENERAL;
    data->weight_goal = WEIGHT_GOAL_MAINTAIN;
    data->day_counter = 0u;
}

uint8_t storage_is_valid(const SaveData *data) {
    if (data->magic != SAVE_MAGIC) return 0u;
    if (data->version != SAVE_VERSION) return 0u;
    if (data->checksum != storage_checksum(data)) return 0u;
    return 1u;
}

uint8_t storage_load(SaveData *out) {
    ENABLE_RAM;
    SWITCH_RAM(0u);
    *out = sram_save;
    DISABLE_RAM;

    return storage_is_valid(out);
}

void storage_save(const SaveData *data) {
    SaveData copy;

    copy = *data;
    copy.magic = SAVE_MAGIC;
    copy.version = SAVE_VERSION;
    copy.onboarding_complete = 1u;
    copy.checksum = storage_checksum(&copy);

    ENABLE_RAM;
    SWITCH_RAM(0u);
    sram_save = copy;
    DISABLE_RAM;
}

void storage_erase(void) {
    SaveData blank;

    memset(&blank, 0, sizeof(SaveData));

    ENABLE_RAM;
    SWITCH_RAM(0u);
    sram_save = blank;
    DISABLE_RAM;
}
