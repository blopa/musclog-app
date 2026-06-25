#include "exercise_db.h"

#include <gb/gb.h>

static uint8_t caller_bank(void) NONBANKED {
    return CURRENT_BANK == 0u ? 1u : CURRENT_BANK;
}

static void clear_exercise(ExerciseCache *out) NONBANKED {
    out->name[0] = '\0';
    out->muscle_group = 0u;
    out->equipment_type = 0u;
    out->mechanic_type = 0u;
    out->load_multiplier_centi = 0u;
}

static void copy_exercise(const exercise_t *exercise, ExerciseCache *out) NONBANKED {
    const char *src;
    uint8_t i;

    out->muscle_group = exercise->muscle_group;
    out->equipment_type = exercise->equipment_type;
    out->mechanic_type = exercise->mechanic_type;
    out->load_multiplier_centi = exercise->load_multiplier_centi;

    src = exercise->name;
    for (i = 0u; i != EX_NAME_VISIBLE && src[i] != '\0'; ++i) {
        out->name[i] = src[i];
    }
    out->name[i] = '\0';
}

void ex_load(uint8_t idx, ExerciseCache *out) NONBANKED {
    uint8_t saved_bank = caller_bank();

    if (idx >= EXERCISE_COUNT) {
        clear_exercise(out);
        return;
    }

    SWITCH_ROM(EXERCISES_BANK);
    copy_exercise(&exercises[idx], out);
    SWITCH_ROM(saved_bank);
}

uint8_t ex_filter_by_muscle(uint8_t muscle_filter, uint8_t *matches, uint8_t cap) NONBANKED {
    uint8_t saved_bank = caller_bank();
    uint8_t count = 0u;
    uint8_t i;

    SWITCH_ROM(EXERCISES_BANK);
    for (i = 0u; i != EXERCISE_COUNT && count != cap; ++i) {
        if (muscle_filter == EX_FILTER_ALL || exercises[i].muscle_group == muscle_filter) {
            matches[count++] = i;
        }
    }
    SWITCH_ROM(saved_bank);

    return count;
}
