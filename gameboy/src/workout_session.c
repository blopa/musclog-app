#pragma bank 7

#include "workout_session.h"

#include "rtc.h"
#include "volume_calc.h"
#include "weight_units.h"
#include "workoutlog.h"

#define WORKOUT_SESSION_SET_CAP  64u
#define REPS_COMPOUND            10u
#define REPS_DEFAULT             14u

static WorkoutLogSet session_sets[WORKOUT_SESSION_SET_CAP];
static uint8_t session_muscle_sets[EXERCISE_MUSCLE_GROUP_COUNT];
static uint8_t session_set_total;
static uint8_t session_exercise_total;

/* ── Recommendation ─────────────────────────────────────────────────────────── */

static uint8_t experience_factor_centi(uint8_t experience) {
    switch (experience) {
        case EXPERIENCE_BEGINNER: return 40u;
        case EXPERIENCE_ADVANCED: return 140u;
        case EXPERIENCE_INTERMEDIATE:
        default:
            return 100u;
    }
}

static uint8_t age_factor_centi(uint8_t age) {
    if (age < 35u) return 100u;
    if (age < 50u) return 95u;
    if (age < 65u) return 90u;
    return 85u;
}

static uint16_t suggested_weight_kg_tenths(const SaveData *data, const ExerciseCache *exercise) {
    uint32_t kg_tenths;

    if (exercise->equipment_type == EX_EQUIPMENT_BODYWEIGHT ||
        exercise->load_multiplier_centi == 0u) {
        return 0u;
    }

    kg_tenths = data->weight_kg_tenths;
    kg_tenths = (kg_tenths * exercise->load_multiplier_centi + 50u) / 100u;
    kg_tenths = (kg_tenths * experience_factor_centi(data->lifting_experience) + 50u) / 100u;
    kg_tenths = (kg_tenths * age_factor_centi(data->age) + 50u) / 100u;

    return (uint16_t)kg_tenths;
}

void session_build_recommendation(const SaveData *data,
                                  const ExerciseCache *exercise,
                                  WorkoutRecommendation *out) BANKED {
    uint16_t kg_tenths = suggested_weight_kg_tenths(data, exercise);

    out->reps = exercise->mechanic_type == EX_MECHANIC_COMPOUND ? REPS_COMPOUND : REPS_DEFAULT;

    if (data->units == UNITS_IMPERIAL) {
        out->display_weight = kg_tenths_to_lbs(kg_tenths);
    } else {
        out->display_weight = (uint16_t)((kg_tenths + 5u) / 10u);
    }
}

static uint16_t display_weight_to_kg_tenths(const SaveData *data, uint16_t weight) {
    if (data->units == UNITS_IMPERIAL) {
        return lbs_to_kg_tenths(weight);
    }
    return (uint16_t)(weight * 10u);
}

/* ── Session accumulator ────────────────────────────────────────────────────── */

void session_reset(void) BANKED {
    uint8_t i;

    session_set_total = 0u;
    session_exercise_total = 0u;
    for (i = 0u; i != EXERCISE_MUSCLE_GROUP_COUNT; ++i) {
        session_muscle_sets[i] = 0u;
    }
}

static uint8_t session_has_exercise(uint8_t exercise_idx) {
    uint8_t i;

    for (i = 0u; i != session_set_total; ++i) {
        if (session_sets[i].exercise_idx == exercise_idx) return 1u;
    }

    return 0u;
}

void session_record_set(const SaveData *data, uint8_t exercise_idx,
                        uint8_t muscle_group, uint16_t display_weight, uint8_t reps) BANKED {
    WorkoutLogSet *saved;

    if (session_set_total >= WORKOUT_SESSION_SET_CAP) return;

    if (!session_has_exercise(exercise_idx) && session_exercise_total != 255u) {
        ++session_exercise_total;
    }

    saved = &session_sets[session_set_total];
    saved->exercise_idx = exercise_idx;
    saved->reps = reps;
    saved->weight_kg_tenths = display_weight_to_kg_tenths(data, display_weight);

    if (muscle_group < EXERCISE_MUSCLE_GROUP_COUNT) {
        ++session_muscle_sets[muscle_group];
    }

    ++session_set_total;
}

static uint8_t session_dominant_muscle(void) {
    uint8_t i;
    uint8_t best = 0u;
    uint8_t best_sets = 0u;

    for (i = 0u; i != EXERCISE_MUSCLE_GROUP_COUNT; ++i) {
        if (session_muscle_sets[i] > best_sets) {
            best_sets = session_muscle_sets[i];
            best = i;
        }
    }

    return best;
}

uint8_t session_set_count(void) BANKED {
    return session_set_total;
}

uint8_t session_exercise_count(void) BANKED {
    return session_exercise_total;
}

uint16_t session_volume_kg(void) BANKED {
    uint8_t i;
    uint32_t volume = 0u;

    for (i = 0u; i != session_set_total; ++i) {
        volume += set_volume_1rm_kg(session_sets[i].weight_kg_tenths, session_sets[i].reps);
        if (volume > 65535u) return 65535u;
    }

    return (uint16_t)volume;
}

uint8_t session_finish(SaveData *data) BANKED {
    CalDate today;
    uint8_t saved;

    if (session_set_total == 0u) return 0u;

    today = cal_current_date(data);
    saved = workoutlog_add(
        cal_day_number(today),
        session_dominant_muscle(),
        session_exercise_total,
        session_set_total,
        session_sets
    );
    session_reset();

    return saved;
}
