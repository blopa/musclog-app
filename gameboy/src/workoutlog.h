#ifndef MUSCLOG_WORKOUTLOG_H
#define MUSCLOG_WORKOUTLOG_H

#include <gb/gb.h>
#include <stdint.h>

/*
 * Persistent workout log.
 *
 * Saved workouts live in SRAM bank 2, separate from the bank-0 profile and the
 * bank-1 food log. Records are variable length: a compact workout header plus
 * one 4-byte set record per completed set. Exercise names are not stored; set
 * rows reference the bundled ROM exercise table by exercise_idx.
 */

typedef struct WorkoutLogSet {
    uint8_t  exercise_idx;
    uint8_t  reps;
    uint16_t weight_kg_tenths;
} WorkoutLogSet;

typedef struct WorkoutLogSummary {
    uint16_t day_num;
    uint8_t  dominant_muscle;
    uint8_t  exercise_count;
    uint8_t  set_count;
    uint16_t volume_kg;
} WorkoutLogSummary;

void    workoutlog_init(void) BANKED;
void    workoutlog_erase(void) BANKED;
uint8_t workoutlog_count(void) BANKED;
uint8_t workoutlog_get_summary(uint8_t newest_idx, WorkoutLogSummary *out) BANKED;
uint8_t workoutlog_add(uint16_t day_num,
                       uint8_t dominant_muscle,
                       uint8_t exercise_count,
                       uint8_t set_count,
                       const WorkoutLogSet *sets) BANKED;

#endif /* MUSCLOG_WORKOUTLOG_H */
