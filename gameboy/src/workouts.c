#pragma bank 7

#include "workouts.h"

#include "copies.h"
#include "exercise_db.h"
#include "exercises.h"
#include "input.h"
#include "ui_text.h"
#include "utils.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

#define WORKOUT_VISIBLE          4u
#define WORKOUT_COUNT            8u
#define EXERCISE_VISIBLE         8u
#define WORKOUT_NO_EXERCISE      0xFFu
#define WORKOUT_DEFAULT_SET_COUNT 3u
#define WORKOUT_SET_COUNT_MIN    1u
#define WORKOUT_SET_COUNT_MAX    20u
#define REPS_COMPOUND            10u
#define REPS_DEFAULT             14u

typedef struct MockWorkout {
    const char *date;
    const char *name;
    uint8_t exercises;
    uint8_t sets;
    uint16_t volume_kg;
    uint8_t minutes;
} MockWorkout;

typedef struct WorkoutsState {
    uint8_t scroll;
    uint8_t focused;
    uint8_t dirty;
} WorkoutsState;

typedef enum WorkoutAction {
    WORKOUT_ACTION_NONE = 0u,
    WORKOUT_ACTION_START = 1u,
} WorkoutAction;

typedef struct ExercisePickerState {
    uint8_t filter;
    uint8_t scroll;
    uint8_t focused;
    uint8_t match_count;
    uint8_t dirty;
} ExercisePickerState;

typedef struct WorkoutRecommendation {
    uint16_t display_weight;
    uint8_t reps;
    uint8_t is_bodyweight;
} WorkoutRecommendation;

static uint8_t exercise_matches[EXERCISE_COUNT];

static const MockWorkout MOCK_WORKOUTS[WORKOUT_COUNT] = {
    { "06-21", "PUSH DAY",  6u, 24u, 12400u, 45u },
    { "06-19", "LEGS",      5u, 22u, 18600u, 58u },
    { "06-17", "PULL DAY",  6u, 26u, 15300u, 52u },
    { "06-14", "FULL BODY", 7u, 30u, 20800u, 64u },
    { "06-12", "UPPER",     5u, 21u, 11200u, 43u },
    { "06-10", "CARDIO",    2u, 10u,     0u, 35u },
    { "06-08", "LOWER",     6u, 27u, 19200u, 61u },
    { "06-06", "ARMS",      5u, 20u,  8200u, 38u },
};

static const char * const MUSCLE_FILTER_LABELS[EXERCISE_MUSCLE_GROUP_COUNT] = {
    "ABDOMEN",
    "ARMS",
    "BACK",
    "CHEST",
    "CORE",
    "FULL BODY",
    "GLUTES",
    "LEGS",
    "SHOULDERS",
};

static void print_right(uint8_t y, const char *text) {
    uint8_t len = (uint8_t)strlen(text);
    ui_print_at(len < 20u ? (uint8_t)(20u - len) : 0u, y, text);
}

static const char *filter_label(uint8_t filter) {
    if (filter == 0u) return STR_ALL;
    return MUSCLE_FILTER_LABELS[(uint8_t)(filter - 1u)];
}

static uint8_t filter_to_muscle(uint8_t filter) {
    return filter == 0u ? EX_FILTER_ALL : (uint8_t)(filter - 1u);
}

static void refresh_exercise_matches(ExercisePickerState *state) {
    state->match_count = ex_filter_by_muscle(
        filter_to_muscle(state->filter),
        exercise_matches,
        EXERCISE_COUNT
    );
    state->scroll = 0u;
    state->focused = 0u;
    state->dirty = 1u;
}

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

static uint16_t kg_tenths_to_lbs(uint16_t kg_tenths) {
    return (uint16_t)((((uint32_t)kg_tenths * 22046u) + 50000u) / 100000u);
}

static void build_recommendation(
    const SaveData *data,
    const ExerciseCache *exercise,
    WorkoutRecommendation *out
) {
    uint16_t kg_tenths = suggested_weight_kg_tenths(data, exercise);

    out->is_bodyweight = (uint8_t)(exercise->equipment_type == EX_EQUIPMENT_BODYWEIGHT);
    out->reps = exercise->mechanic_type == EX_MECHANIC_COMPOUND ? REPS_COMPOUND : REPS_DEFAULT;

    if (data->units == UNITS_IMPERIAL) {
        out->display_weight = kg_tenths_to_lbs(kg_tenths);
    } else {
        out->display_weight = (uint16_t)((kg_tenths + 5u) / 10u);
    }
}

static void format_recommended_weight(
    const SaveData *data,
    const WorkoutRecommendation *rec,
    char *buf
) {
    if (rec->is_bodyweight) {
        strcpy(buf, STR_BODYWEIGHT);
    } else if (data->units == UNITS_IMPERIAL) {
        sprintf(buf, "%u LB", (unsigned int)rec->display_weight);
    } else {
        sprintf(buf, "%u KG", (unsigned int)rec->display_weight);
    }
}

static void draw_workout_row(uint8_t y, uint8_t idx, uint8_t focused) {
    const MockWorkout *workout;
    char buf[12];
    uint8_t len;
    uint8_t x;

    if (idx >= WORKOUT_COUNT) return;

    workout = &MOCK_WORKOUTS[idx];

    if (focused) {
        ui_fill_attr(0u, y, 20u, 1u, UI_PAL_SELECTED);
        ui_fill_attr(0u, (uint8_t)(y + 1u), 20u, 1u, UI_PAL_PANEL);
    }

    ui_print_at(0u, y, focused ? ">" : " ");
    ui_print_at(2u, y, workout->name);

    sprintf(buf, "%uM", (unsigned int)workout->minutes);
    len = (uint8_t)strlen(buf);
    x = len < 20u ? (uint8_t)(20u - len) : 17u;
    ui_print_at(x, y, buf);

    sprintf(buf, "%uEX %uS %uK",
            (unsigned int)workout->exercises,
            (unsigned int)workout->sets,
            (unsigned int)(workout->volume_kg / 1000u));
    ui_print_at(2u, (uint8_t)(y + 1u), workout->date);
    ui_print_at(8u, (uint8_t)(y + 1u), buf);
}

static void draw_workouts(const WorkoutsState *state) {
    uint8_t i;
    uint8_t abs_idx;
    char buf[12];

    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);

    ui_print_at(0u, 1u, STR_WORKOUTS);
    sprintf(buf, "%u %s", (unsigned int)WORKOUT_COUNT, STR_DONE);
    ui_print_at((uint8_t)(20u - (uint8_t)strlen(buf)), 1u, buf);
    ui_print_at(0u, 2u, STR_DIVIDER);

    ui_print_at(1u, 3u, STR_THIS_WEEK);
    ui_print_at(15u, 3u, "3");
    ui_print_at(1u, 4u, STR_AVG);
    ui_print_at(5u, 4u, "49M");
    ui_print_at(11u, 4u, STR_VOL);
    ui_print_at(15u, 4u, "13K");
    ui_print_at(0u, 5u, STR_DIVIDER);

    for (i = 0u; i != WORKOUT_VISIBLE; ++i) {
        abs_idx = (uint8_t)(state->scroll + i);
        draw_workout_row((uint8_t)(6u + (i * 2u)),
                         abs_idx,
                         (uint8_t)(i == state->focused));
    }

    sprintf(buf, "%u-%u OF %u",
            (unsigned int)(state->scroll + 1u),
            (unsigned int)(state->scroll + WORKOUT_VISIBLE),
            (unsigned int)WORKOUT_COUNT);
    ui_print_center(14u, buf);

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_MENU);
}

static WorkoutAction workouts_action_menu(void) {
    static const char *OPTIONS[1] = {
        STR_START_WORKOUT,
    };
    InputState input;
    uint8_t dirty = 1u;

    input_init(&input);
    while (1) {
        if (dirty) {
            ui_draw_menu(STR_WORKOUTS, OPTIONS, 1u, 0u);
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return WORKOUT_ACTION_NONE;
        if (input_pressed(&input, J_A | J_START)) return WORKOUT_ACTION_START;
    }
}

static void draw_exercise_row(uint8_t y, uint8_t match_idx, uint8_t focused) {
    ExerciseCache exercise;

    ex_load(exercise_matches[match_idx], &exercise);

    ui_fill_attr(0u, y, 20u, 1u, focused ? UI_PAL_SELECTED : UI_PAL_NORMAL);
    ui_print_at(0u, y, focused ? ">" : " ");
    ui_print_at(2u, y, exercise.name);
}

static void draw_exercise_picker(const ExercisePickerState *state) {
    uint8_t i;
    uint8_t match_idx;
    uint8_t end;
    char buf[14];

    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);
    ui_print_center(1u, STR_SELECT_EXERCISE);
    ui_print_at(0u, 2u, STR_DIVIDER);

    ui_fill_attr(0u, 4u, 20u, 1u, UI_PAL_PANEL);
    ui_print_at(1u, 4u, STR_FILTER);
    ui_print_at(9u, 4u, filter_label(state->filter));
    ui_print_at(0u, 5u, STR_DIVIDER);

    if (state->match_count == 0u) {
        ui_print_center(9u, STR_NO_EXERCISES);
    } else {
        for (i = 0u; i != EXERCISE_VISIBLE; ++i) {
            match_idx = (uint8_t)(state->scroll + i);
            if (match_idx >= state->match_count) break;
            draw_exercise_row((uint8_t)(6u + i), match_idx, (uint8_t)(i == state->focused));
        }

        end = (uint8_t)(state->scroll + EXERCISE_VISIBLE);
        if (end > state->match_count) end = state->match_count;

        sprintf(buf, "%u-%u OF %u",
                (unsigned int)(state->scroll + 1u),
                (unsigned int)end,
                (unsigned int)state->match_count);
        ui_print_center(14u, buf);
    }

    ui_print_center(15u, STR_HINT_FILTER);
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_PICK);
}

static void cycle_filter(ExercisePickerState *state, uint8_t reverse) {
    if (reverse) {
        state->filter = state->filter == 0u
            ? EXERCISE_MUSCLE_GROUP_COUNT
            : (uint8_t)(state->filter - 1u);
    } else {
        state->filter = state->filter == EXERCISE_MUSCLE_GROUP_COUNT
            ? 0u
            : (uint8_t)(state->filter + 1u);
    }
    refresh_exercise_matches(state);
}

static uint8_t workout_exercise_picker(void) {
    ExercisePickerState state;
    InputState input;
    uint8_t abs_idx;

    state.filter = 0u;
    refresh_exercise_matches(&state);

    input_init(&input);
    while (1) {
        if (state.dirty) {
            draw_exercise_picker(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return WORKOUT_NO_EXERCISE;

        if (input_pressed(&input, J_LEFT)) {
            cycle_filter(&state, 1u);
            continue;
        }

        if (input_pressed(&input, J_SELECT | J_RIGHT)) {
            cycle_filter(&state, 0u);
            continue;
        }

        if (state.match_count == 0u) continue;

        abs_idx = (uint8_t)(state.scroll + state.focused);

        if (input_pressed(&input, J_DOWN) && (uint8_t)(abs_idx + 1u) < state.match_count) {
            if (state.focused < (uint8_t)(EXERCISE_VISIBLE - 1u) &&
                (uint8_t)(state.focused + 1u) < state.match_count) {
                ++state.focused;
            } else {
                ++state.scroll;
            }
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_UP)) {
            if (state.focused > 0u) {
                --state.focused;
                state.dirty = 1u;
            } else if (state.scroll > 0u) {
                --state.scroll;
                state.dirty = 1u;
            }
        }

        if (input_pressed(&input, J_A | J_START)) {
            return exercise_matches[(uint8_t)(state.scroll + state.focused)];
        }
    }
}

static void draw_plan_row(uint8_t y, const char *label, const char *value, uint8_t focused) {
    ui_fill_attr(0u, y, 20u, 1u, focused ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_print_at(1u, y, focused ? ">" : " ");
    ui_print_at(3u, y, label);
    print_right(y, value);
}

static void draw_workout_plan(
    const SaveData *data,
    uint8_t set_count,
    const ExerciseCache *exercise,
    const WorkoutRecommendation *recommendation
) {
    char sets_buf[4];
    char weight_buf[14];
    char reps_buf[4];

    sprintf(sets_buf, "%u", (unsigned int)set_count);
    format_recommended_weight(data, recommendation, weight_buf);
    sprintf(reps_buf, "%u", (unsigned int)recommendation->reps);

    ui_title(STR_FREE_SESSION);
    ui_print_center(4u, exercise->name);
    ui_print_at(0u, 5u, STR_DIVIDER);

    draw_plan_row(7u, STR_SETS, sets_buf, 1u);
    draw_plan_row(9u, STR_WEIGHT, weight_buf, 0u);
    draw_plan_row(11u, STR_REPS, reps_buf, 0u);

    ui_print_center(14u, STR_HINT_SETS);
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_OK);
}

static uint8_t workout_plan_screen(const SaveData *data, uint8_t exercise_idx) {
    InputState input;
    ExerciseCache exercise;
    WorkoutRecommendation recommendation;
    uint8_t set_count = WORKOUT_DEFAULT_SET_COUNT;
    uint8_t dirty = 1u;

    ex_load(exercise_idx, &exercise);
    build_recommendation(data, &exercise, &recommendation);

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_workout_plan(data, set_count, &exercise, &recommendation);
            dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return 0u;
        if (input_pressed(&input, J_A | J_START)) return 1u;

        if (input_pressed(&input, J_UP)) {
            set_count = add_clamped_u8(set_count, 1u, WORKOUT_SET_COUNT_MAX);
            dirty = 1u;
        }
        if (input_pressed(&input, J_DOWN)) {
            set_count = sub_clamped_u8(set_count, 1u, WORKOUT_SET_COUNT_MIN);
            dirty = 1u;
        }
        if (input_pressed(&input, J_RIGHT)) {
            set_count = add_clamped_u8(set_count, 5u, WORKOUT_SET_COUNT_MAX);
            dirty = 1u;
        }
        if (input_pressed(&input, J_LEFT)) {
            set_count = sub_clamped_u8(set_count, 5u, WORKOUT_SET_COUNT_MIN);
            dirty = 1u;
        }
    }
}

static void workout_start_free_session(SaveData *data) {
    uint8_t exercise_idx;

    while (1) {
        exercise_idx = workout_exercise_picker();
        if (exercise_idx == WORKOUT_NO_EXERCISE) return;
        if (workout_plan_screen(data, exercise_idx)) return;
    }
}

void workouts_show(SaveData *data) BANKED {
    WorkoutsState state;
    InputState input;
    uint8_t abs_idx;

    state.scroll = 0u;
    state.focused = 0u;
    state.dirty = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            draw_workouts(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_SELECT)) {
            if (workouts_action_menu() == WORKOUT_ACTION_START) {
                workout_start_free_session(data);
            }
            state.dirty = 1u;
            continue;
        }

        abs_idx = (uint8_t)(state.scroll + state.focused);

        if (input_pressed(&input, J_DOWN) && (uint8_t)(abs_idx + 1u) < WORKOUT_COUNT) {
            if (state.focused < (uint8_t)(WORKOUT_VISIBLE - 1u)) {
                ++state.focused;
            } else {
                ++state.scroll;
            }
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_UP)) {
            if (state.focused > 0u) {
                --state.focused;
                state.dirty = 1u;
            } else if (state.scroll > 0u) {
                --state.scroll;
                state.dirty = 1u;
            }
        }
    }
}
