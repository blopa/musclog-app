#ifndef MUSCLOG_EXERCISE_DB_H
#define MUSCLOG_EXERCISE_DB_H

#include <gb/gb.h>
#include <stdint.h>

#include "exercises.h"

/*
 * Read access to the bundled exercise table in ROM bank 6.
 *
 * The public readers are NONBANKED because they temporarily SWITCH_ROM() to
 * EXERCISES_BANK. Banked callers must not dereference exercises[] directly.
 */

#define EX_NAME_VISIBLE 18u
#define EX_FILTER_ALL 0xFFu

typedef struct ExerciseCache {
    char name[EX_NAME_VISIBLE + 1u];
    uint8_t muscle_group;
    uint8_t equipment_type;
    uint8_t mechanic_type;
    uint16_t load_multiplier_centi;
} ExerciseCache;

void ex_load(uint8_t idx, ExerciseCache *out) NONBANKED;
uint8_t ex_filter_by_muscle(uint8_t muscle_filter, uint8_t *matches, uint8_t cap) NONBANKED;

#endif /* MUSCLOG_EXERCISE_DB_H */
