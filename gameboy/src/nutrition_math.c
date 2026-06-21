#include "nutrition_math.h"

#include <stdint.h>

#define KCAL_PROTEIN 4u
#define KCAL_CARBS 4u
#define KCAL_FAT 9u

static uint16_t clamp_u16(uint16_t value, uint16_t min, uint16_t max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

static uint16_t calculate_bmr(const SaveData *data) {
    int32_t bmr;
    int16_t sex_offset;

    if (data->gender == GENDER_MALE) {
        sex_offset = 5;
    } else if (data->gender == GENDER_FEMALE) {
        sex_offset = -161;
    } else {
        sex_offset = -78;
    }

    bmr = (int32_t)data->weight_kg_tenths;
    bmr += (((int32_t)data->height_cm * 625L) + 50L) / 100L;
    bmr -= (int32_t)data->age * 5L;
    bmr += sex_offset;

    if (bmr < 0L) return 0u;
    if (bmr > 65535L) return 65535u;
    return (uint16_t)bmr;
}

static uint16_t activity_multiplier(uint8_t activity_level) {
    switch (activity_level) {
        case 1u: return 1200u;
        case 2u: return 1375u;
        case 3u: return 1550u;
        case 4u: return 1725u;
        case 5u: return 1900u;
        default: return 1375u;
    }
}

static uint16_t minimum_calories(uint8_t gender, uint16_t bmr) {
    uint16_t floor;
    uint16_t bmr_floor;

    if (gender == GENDER_MALE) {
        floor = 1500u;
    } else if (gender == GENDER_FEMALE) {
        floor = 1200u;
    } else {
        floor = 1350u;
    }

    bmr_floor = (uint16_t)((((uint32_t)bmr * 80u) + 50u) / 100u);
    return bmr_floor > floor ? bmr_floor : floor;
}

static int16_t calorie_adjustment(const SaveData *data) {
    uint16_t amount;

    if (data->weight_goal == WEIGHT_GOAL_MAINTAIN) return 0;

    if (data->weight_goal == WEIGHT_GOAL_LOSE) {
        amount = (uint16_t)((((uint32_t)data->weight_kg_tenths * 55u) + 50u) / 100u);
        return -(int16_t)clamp_u16(amount, 250u, 750u);
    }

    amount = (uint16_t)((((uint32_t)data->weight_kg_tenths * 275u) + 500u) / 1000u);
    return (int16_t)clamp_u16(amount, 150u, 400u);
}

static void macro_split(const SaveData *data, uint8_t *carbs, uint8_t *protein, uint8_t *fat) {
    if (data->weight_goal == WEIGHT_GOAL_LOSE) {
        *carbs = 40u;
        *protein = 30u;
        *fat = 30u;
        return;
    }

    switch (data->fitness_focus) {
        case FITNESS_MUSCLE:
            *carbs = 45u;
            *protein = 30u;
            *fat = 25u;
            break;
        case FITNESS_STRENGTH:
            *carbs = 50u;
            *protein = 30u;
            *fat = 20u;
            break;
        case FITNESS_ENDURANCE:
            *carbs = 55u;
            *protein = 20u;
            *fat = 25u;
            break;
        case FITNESS_GENERAL:
        default:
            *carbs = 45u;
            *protein = 25u;
            *fat = 30u;
            break;
    }
}

void nutrition_apply_generated_goals(SaveData *data) {
    uint16_t bmr;
    uint16_t tdee;
    int16_t adjusted;
    uint16_t target;
    uint8_t carbs_pct;
    uint8_t protein_pct;
    uint8_t fat_pct;
    uint16_t fiber;

    bmr = calculate_bmr(data);
    tdee = (uint16_t)((((uint32_t)bmr * activity_multiplier(data->activity_level)) + 500u) / 1000u);
    adjusted = (int16_t)tdee + calorie_adjustment(data);
    target = adjusted > 0 ? (uint16_t)adjusted : 0u;

    if (target < minimum_calories(data->gender, bmr)) {
        target = minimum_calories(data->gender, bmr);
    }

    macro_split(data, &carbs_pct, &protein_pct, &fat_pct);

    data->calorie_goal = target;
    data->protein_goal = (uint16_t)((((uint32_t)target * protein_pct) + 200u) / (100u * KCAL_PROTEIN));
    data->carbs_goal = (uint16_t)((((uint32_t)target * carbs_pct) + 200u) / (100u * KCAL_CARBS));
    data->fat_goal = (uint16_t)((((uint32_t)target * fat_pct) + 450u) / (100u * KCAL_FAT));

    fiber = (uint16_t)((((uint32_t)target * 14u) + 500u) / 1000u);
    data->fiber_goal = clamp_u16(fiber, 25u, 40u);
}
