#ifndef MUSCLOG_WORKOUT_SESSION_H
#define MUSCLOG_WORKOUT_SESSION_H

#include <gb/gb.h>
#include <stdint.h>

#include "exercise_db.h"
#include "profile.h"

/*
 * The non-UI half of the free-workout flow: the in-RAM session accumulator
 * (sets logged so far, per-muscle counts, totals) and the starting-weight
 * recommendation math. workouts.c owns the screens and drives this module;
 * keeping the model here keeps that file focused on rendering + input and lets
 * the logic be reasoned about (and unit-tested) without a Game Boy.
 *
 * Both files live in ROM bank 7, so these calls are ordinary (non-BANKED).
 */

typedef struct WorkoutRecommendation {
    uint16_t display_weight; /* in the user's unit system (kg or lb) */
    uint8_t reps;
} WorkoutRecommendation;

/* ── Recommendation ─────────────────────────────────────────────────────────── */

/* Suggested starting weight + rep target for `exercise`, in display units. */
void session_build_recommendation(const SaveData *data, const ExerciseCache *exercise,
                                  WorkoutRecommendation *out) BANKED;

/* ── Session accumulator ────────────────────────────────────────────────────── */

/* Begin a fresh session (clears logged sets and totals). */
void session_reset(void) BANKED;

/* Record one completed set. `display_weight` is in the user's unit system and is
 * converted to stored metric internally. */
void session_record_set(const SaveData *data, uint8_t exercise_idx, uint8_t muscle_group,
                        uint16_t display_weight, uint8_t reps) BANKED;

/* Running totals for the "exercise complete" summary. */
uint8_t session_set_count(void) BANKED;
uint8_t session_exercise_count(void) BANKED;
uint16_t session_volume_kg(void) BANKED;

/* Persist the session to the workout log (no-op if empty). Returns 1 if saved.
 * Resets the accumulator afterwards. */
uint8_t session_finish(SaveData *data) BANKED;

#endif /* MUSCLOG_WORKOUT_SESSION_H */
