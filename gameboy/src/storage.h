#ifndef MUSCLOG_STORAGE_H
#define MUSCLOG_STORAGE_H

#include <stdint.h>

#define SAVE_MAGIC 0x4D47u
#define SAVE_VERSION 1u

#define UNITS_METRIC 0u
#define UNITS_IMPERIAL 1u

#define GENDER_MALE 0u
#define GENDER_FEMALE 1u
#define GENDER_OTHER 2u

#define EXPERIENCE_BEGINNER 0u
#define EXPERIENCE_INTERMEDIATE 1u
#define EXPERIENCE_ADVANCED 2u

#define FITNESS_MUSCLE 0u
#define FITNESS_STRENGTH 1u
#define FITNESS_ENDURANCE 2u
#define FITNESS_GENERAL 3u

#define WEIGHT_GOAL_LOSE 0u
#define WEIGHT_GOAL_MAINTAIN 1u
#define WEIGHT_GOAL_GAIN 2u

typedef struct SaveData {
    uint16_t magic;
    uint8_t version;
    uint16_t checksum;
    uint8_t onboarding_complete;

    uint8_t units;
    uint8_t gender;
    uint8_t age;
    uint16_t height_cm;
    uint16_t weight_kg_tenths;

    uint8_t activity_level;
    uint8_t lifting_experience;
    uint8_t fitness_focus;
    uint8_t weight_goal;

    uint16_t calorie_goal;
    uint16_t protein_goal;
    uint16_t carbs_goal;
    uint16_t fat_goal;
    uint16_t fiber_goal;

    uint16_t day_counter;
} SaveData;

void storage_init_defaults(SaveData *data);
uint8_t storage_is_valid(const SaveData *data);
uint8_t storage_load(SaveData *out);
void storage_save(const SaveData *data);
void storage_erase(void);

#endif
