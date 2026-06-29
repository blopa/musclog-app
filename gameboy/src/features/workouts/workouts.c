#pragma bank 7

#include "workouts.h"

#include "copies.h"
#include "exercise_db.h"
#include "exercises.h"
#include "input.h"
#include "list_cursor.h"
#include "rtc.h"
#include "ui_text.h"
#include "utils.h"
#include "weight_units.h"
#include "workout_session.h"
#include "workoutlog.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

#define WORKOUT_VISIBLE 4u
#define EXERCISE_VISIBLE 8u
#define WORKOUT_NO_EXERCISE 0xFFu
#define WORKOUT_DEFAULT_SET_COUNT 3u
#define WORKOUT_SET_COUNT_MIN 1u
#define WORKOUT_SET_COUNT_MAX 20u
#define WORKOUT_WEIGHT_MIN 0u
#define WORKOUT_WEIGHT_MAX 999u
#define WORKOUT_REPS_MIN 1u
#define WORKOUT_REPS_MAX 99u
#define WORKOUT_REST_SECONDS 60u
#define WORKOUT_REST_FRAMES 60u
#define PLAN_FIELD_SETS 0u
#define PLAN_FIELD_WEIGHT 1u
#define PLAN_FIELD_REPS 2u
#define PLAN_FIELD_COUNT 3u
#define SET_FIELD_WEIGHT 0u
#define SET_FIELD_REPS 1u
#define SET_FIELD_COUNT 2u

typedef struct WorkoutsState {
    ListCursor cursor;
    uint8_t dirty;
} WorkoutsState;

typedef enum WorkoutAction {
    WORKOUT_ACTION_NONE = 0u,
    WORKOUT_ACTION_START = 1u,
    WORKOUT_ACTION_HOME = 2u,
} WorkoutAction;

typedef enum WorkoutPlanResult {
    WORKOUT_PLAN_CANCEL = 0u,
    WORKOUT_PLAN_START = 1u,
} WorkoutPlanResult;

typedef enum WorkoutSetFlowResult {
    WORKOUT_SET_FLOW_NEXT_EXERCISE = 0u,
    WORKOUT_SET_FLOW_BACK_TO_PLAN = 1u,
    WORKOUT_SET_FLOW_END_WORKOUT = 2u,
} WorkoutSetFlowResult;

typedef enum WorkoutSetMenuAction {
    SET_MENU_ACTION_NONE = 0u,
    SET_MENU_ACTION_EDIT = 1u,
    SET_MENU_ACTION_SAVE = 2u,
    SET_MENU_ACTION_OVERVIEW = 3u,
    SET_MENU_ACTION_NEXT_EXERCISE = 4u,
    SET_MENU_ACTION_END_WORKOUT = 5u,
} WorkoutSetMenuAction;

typedef enum WorkoutDoneAction {
    WORKOUT_DONE_ADD = 0u,
    WORKOUT_DONE_FINISH = 1u,
} WorkoutDoneAction;

typedef struct ExercisePickerState {
    uint8_t filter;
    ListCursor cursor;
    uint8_t match_count;
    uint8_t dirty;
} ExercisePickerState;

typedef struct WorkoutPlanState {
    ExerciseCache exercise;
    uint8_t exercise_idx;
    uint8_t field;
    uint8_t set_count;
    uint16_t weight;
    uint8_t reps;
    uint8_t dirty;
} WorkoutPlanState;

typedef struct WorkoutSetState {
    uint8_t current_set;
    uint8_t total_sets;
    uint16_t weight;
    uint8_t reps;
    uint8_t dirty;
} WorkoutSetState;

typedef struct WorkoutSetEditState {
    uint8_t field;
    uint16_t weight;
    uint8_t reps;
    uint8_t dirty;
} WorkoutSetEditState;

static uint8_t exercise_matches[EXERCISE_COUNT];

/*
 * Workout detail screen scratch: the selected workout's set rows plus a flat
 * list of display rows (an exercise-name header followed by its set rows), so
 * the read-only detail list can scroll a single uniform window. Worst case is
 * one header per set, hence twice the set cap.
 */
#define WORKOUT_DETAIL_SET_CAP 64u
#define WORKOUT_DETAIL_VISIBLE 9u

typedef struct WorkoutDetailRow {
    uint8_t is_header; /* 1 = exercise-name header, 0 = set row */
    uint8_t value;     /* header: exercise_idx; set: index into detail_sets */
} WorkoutDetailRow;

static WorkoutLogSet workout_detail_sets[WORKOUT_DETAIL_SET_CAP];
static WorkoutDetailRow workout_detail_rows[WORKOUT_DETAIL_SET_CAP * 2u];

static const char *const MUSCLE_FILTER_LABELS[EXERCISE_MUSCLE_GROUP_COUNT] = {
    "ABDOMEN", "ARMS", "BACK", "CHEST", "CORE", "FULL BODY", "GLUTES", "LEGS", "SHOULDERS",
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

static void format_filter_value(uint8_t filter, char *buf) {
    sprintf(buf, "< %s >", filter_label(filter));
}

static void refresh_exercise_matches(ExercisePickerState *state) {
    state->match_count =
        ex_filter_by_muscle(filter_to_muscle(state->filter), exercise_matches, EXERCISE_COUNT);
    list_cursor_reset(&state->cursor);
    state->dirty = 1u;
}

static void format_plan_weight(const SaveData *data, uint16_t weight, char *buf) {
    if (data->units == UNITS_IMPERIAL) {
        sprintf(buf, "%u LB", (unsigned int)weight);
    } else {
        sprintf(buf, "%u KG", (unsigned int)weight);
    }
}

/*
 * Inverse of cal_day_number (days since 2000-01-01) without the day-by-day cost
 * of cal_advance(2000-01-01, n): walks whole years then months, so it stays
 * cheap to call per list row even for day numbers years out. Kept local to this
 * bank-7 module to avoid growing the nearly-full non-banked rtc.c (bank 0).
 */
static CalDate workout_date_from_day_number(uint16_t n) {
    CalDate d;
    uint16_t days_in_year;
    uint8_t dim;

    d.year = 2000u;
    d.month = 1u;

    while (1) {
        days_in_year = cal_is_leap(d.year) ? 366u : 365u;
        if (n < days_in_year) break;
        n = (uint16_t)(n - days_in_year);
        ++d.year;
    }
    while (1) {
        dim = cal_days_in_month(d.month, d.year);
        if (n < dim) break;
        n = (uint16_t)(n - dim);
        ++d.month;
    }
    d.day = (uint8_t)(1u + n);
    return d;
}

static void format_workout_title(const WorkoutLogSummary *summary, char *buf) {
    CalDate date;
    char date_buf[9];
    const char *muscle;

    date = workout_date_from_day_number(summary->day_num);
    cal_format(&date, date_buf);

    muscle = summary->dominant_muscle < EXERCISE_MUSCLE_GROUP_COUNT
                 ? MUSCLE_FILTER_LABELS[summary->dominant_muscle]
                 : "WORKOUT";
    sprintf(buf, "%s %s", muscle, date_buf);
}

static void draw_workout_row(uint8_t y, uint8_t idx, uint8_t focused) {
    WorkoutLogSummary summary;
    char title[20];
    char buf[14];

    if (focused) {
        ui_fill_attr(0u, y, 20u, 1u, UI_PAL_SELECTED);
        ui_fill_attr(0u, (uint8_t)(y + 1u), 20u, 1u, UI_PAL_PANEL);
    }

    if (!workoutlog_get_summary(idx, &summary)) return;

    format_workout_title(&summary, title);

    ui_print_at(0u, y, focused ? ">" : " ");
    ui_print_at(2u, y, title);

    sprintf(buf, "%uEX %uS %uK", (unsigned int)summary.exercise_count,
            (unsigned int)summary.set_count, (unsigned int)(summary.volume_kg / 1000u));
    ui_print_at(2u, (uint8_t)(y + 1u), buf);
}

static void workout_week_stats(const SaveData *data, uint8_t *week_count, uint16_t *week_sets,
                               uint16_t *week_volume_kg) {
    CalDate today;
    WorkoutLogSummary summary;
    uint16_t today_num;
    uint16_t start_num;
    uint8_t count;
    uint8_t i;

    *week_count = 0u;
    *week_sets = 0u;
    *week_volume_kg = 0u;

    today = cal_current_date(data);
    today_num = cal_day_number(today);
    start_num = today_num > 6u ? (uint16_t)(today_num - 6u) : 0u;
    count = workoutlog_count();

    for (i = 0u; i != count; ++i) {
        if (!workoutlog_get_summary(i, &summary)) continue;
        if (summary.day_num < start_num || summary.day_num > today_num) continue;

        if (*week_count != 255u) ++(*week_count);
        *week_sets = add_clamped_u16(*week_sets, summary.set_count, 999u);
        *week_volume_kg = add_clamped_u16(*week_volume_kg, summary.volume_kg, 65535u);
    }
}

static void draw_workouts(const SaveData *data, const WorkoutsState *state) {
    uint8_t i;
    uint8_t abs_idx;
    uint8_t count;
    uint8_t end;
    uint8_t week_count;
    uint16_t week_sets;
    uint16_t week_volume_kg;
    char buf[12];

    count = workoutlog_count();
    workout_week_stats(data, &week_count, &week_sets, &week_volume_kg);

    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);

    ui_print_at(0u, 1u, STR_WORKOUTS);
    sprintf(buf, "%u %s", (unsigned int)count, STR_DONE);
    ui_print_at((uint8_t)(20u - (uint8_t)strlen(buf)), 1u, buf);
    ui_print_at(0u, 2u, STR_DIVIDER);

    ui_print_at(1u, 3u, STR_THIS_WEEK);
    sprintf(buf, "%u", (unsigned int)week_count);
    ui_print_at(15u, 3u, buf);
    ui_print_at(1u, 4u, STR_SETS);
    sprintf(buf, "%u", (unsigned int)week_sets);
    ui_print_at(6u, 4u, buf);
    ui_print_at(11u, 4u, STR_VOL);
    sprintf(buf, "%uK", (unsigned int)(week_volume_kg / 1000u));
    ui_print_at(15u, 4u, buf);
    ui_print_at(0u, 5u, STR_DIVIDER);

    if (count == 0u) {
        ui_print_center(9u, "NO WORKOUTS");
    } else {
        for (i = 0u; i != WORKOUT_VISIBLE; ++i) {
            abs_idx = (uint8_t)(state->cursor.scroll + i);
            if (abs_idx >= count) break;
            draw_workout_row((uint8_t)(6u + (i * 2u)), abs_idx,
                             (uint8_t)(i == state->cursor.focused));
        }

        end = (uint8_t)(state->cursor.scroll + WORKOUT_VISIBLE);
        if (end > count) end = count;
        sprintf(buf, "%u-%u OF %u", (unsigned int)(state->cursor.scroll + 1u), (unsigned int)end,
                (unsigned int)count);
        ui_print_center(14u, buf);
    }

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_MENU);
}

static WorkoutAction workouts_action_menu(void) {
    const char *options[2];
    uint8_t selected;

    options[0] = STR_START_WORKOUT;
    options[1] = STR_HOME;

    selected = ui_menu_select(STR_WORKOUTS, options, 2u);
    if (selected == UI_MENU_CANCEL) return WORKOUT_ACTION_NONE;
    return selected == 0u ? WORKOUT_ACTION_START : WORKOUT_ACTION_HOME;
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
    char filter_buf[14];

    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);
    ui_print_center(1u, STR_SELECT_EXERCISE);
    ui_print_at(0u, 2u, STR_DIVIDER);

    ui_fill_attr(0u, 4u, 20u, 1u, UI_PAL_PANEL);
    format_filter_value(state->filter, filter_buf);
    ui_print_at(1u, 4u, STR_FILTER);
    ui_print_at(7u, 4u, filter_buf);
    ui_print_at(0u, 5u, STR_DIVIDER);

    if (state->match_count == 0u) {
        ui_print_center(9u, STR_NO_EXERCISES);
    } else {
        for (i = 0u; i != EXERCISE_VISIBLE; ++i) {
            match_idx = (uint8_t)(state->cursor.scroll + i);
            if (match_idx >= state->match_count) break;
            draw_exercise_row((uint8_t)(6u + i), match_idx, (uint8_t)(i == state->cursor.focused));
        }

        end = (uint8_t)(state->cursor.scroll + EXERCISE_VISIBLE);
        if (end > state->match_count) end = state->match_count;

        sprintf(buf, "%u-%u OF %u", (unsigned int)(state->cursor.scroll + 1u), (unsigned int)end,
                (unsigned int)state->match_count);
        ui_print_center(14u, buf);
    }

    ui_print_center(15u, STR_HINT_FILTER);
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_PICK);
}

static void cycle_filter(ExercisePickerState *state, uint8_t reverse) {
    if (reverse) {
        state->filter =
            state->filter == 0u ? EXERCISE_MUSCLE_GROUP_COUNT : (uint8_t)(state->filter - 1u);
    } else {
        state->filter =
            state->filter == EXERCISE_MUSCLE_GROUP_COUNT ? 0u : (uint8_t)(state->filter + 1u);
    }
    refresh_exercise_matches(state);
}

static uint8_t workout_exercise_picker(void) {
    ExercisePickerState state;
    InputState input;

    state.filter = 0u;
    refresh_exercise_matches(&state);

    input_init(&input);
    while (1) {
        if (state.dirty) {
            draw_exercise_picker(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return WORKOUT_NO_EXERCISE;

        if (input_pressed(&input, J_LEFT)) {
            cycle_filter(&state, 1u);
            continue;
        }

        if (input_pressed(&input, J_RIGHT)) {
            cycle_filter(&state, 0u);
            continue;
        }

        if (state.match_count == 0u) continue;

        if (input_pressed(&input, J_DOWN) &&
            list_cursor_down(&state.cursor, state.match_count, EXERCISE_VISIBLE)) {
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_UP) && list_cursor_up(&state.cursor)) {
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_A | J_START)) {
            return exercise_matches[list_cursor_index(&state.cursor)];
        }
    }
}

static void draw_plan_row(uint8_t y, const char *label, const char *value, uint8_t focused) {
    ui_fill_attr(0u, y, 20u, 1u, focused ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_clear_row(y);
    ui_print_at(1u, y, focused ? ">" : " ");
    ui_print_at(3u, y, label);
    print_right(y, value);
}

static void draw_workout_plan_rows(const SaveData *data, const WorkoutPlanState *state) {
    char sets_buf[4];
    char weight_buf[14];
    char reps_buf[4];

    sprintf(sets_buf, "%u", (unsigned int)state->set_count);
    format_plan_weight(data, state->weight, weight_buf);
    sprintf(reps_buf, "%u", (unsigned int)state->reps);

    draw_plan_row(7u, STR_SETS, sets_buf, state->field == PLAN_FIELD_SETS);
    draw_plan_row(9u, STR_WEIGHT, weight_buf, state->field == PLAN_FIELD_WEIGHT);
    draw_plan_row(11u, STR_REPS, reps_buf, state->field == PLAN_FIELD_REPS);
}

static void draw_workout_plan(const SaveData *data, const WorkoutPlanState *state) {
    ui_title(STR_FREE_SESSION);
    ui_print_center(4u, state->exercise.name);
    ui_print_at(0u, 5u, STR_DIVIDER);

    draw_workout_plan_rows(data, state);

    ui_print_center(14u, STR_HINT_EDIT_ROW);
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_OK);
}

static void adjust_plan_field(WorkoutPlanState *state, uint8_t increase) {
    if (state->field == PLAN_FIELD_SETS) {
        state->set_count = increase ? add_clamped_u8(state->set_count, 1u, WORKOUT_SET_COUNT_MAX)
                                    : sub_clamped_u8(state->set_count, 1u, WORKOUT_SET_COUNT_MIN);
    } else if (state->field == PLAN_FIELD_WEIGHT) {
        state->weight = increase ? add_clamped_u16(state->weight, 1u, WORKOUT_WEIGHT_MAX)
                                 : sub_clamped_u16(state->weight, 1u, WORKOUT_WEIGHT_MIN);
    } else {
        state->reps = increase ? add_clamped_u8(state->reps, 1u, WORKOUT_REPS_MAX)
                               : sub_clamped_u8(state->reps, 1u, WORKOUT_REPS_MIN);
    }
    state->dirty = 1u;
}

static void init_workout_plan(const SaveData *data, uint8_t exercise_idx, WorkoutPlanState *state) {
    WorkoutRecommendation recommendation;

    ex_load(exercise_idx, &state->exercise);
    session_build_recommendation(data, &state->exercise, &recommendation);

    state->exercise_idx = exercise_idx;
    state->field = PLAN_FIELD_SETS;
    state->set_count = WORKOUT_DEFAULT_SET_COUNT;
    state->weight = recommendation.display_weight;
    state->reps = recommendation.reps;
    state->dirty = 1u;
}

static uint8_t workout_plan_screen(const SaveData *data, WorkoutPlanState *state) {
    InputState input;
    uint8_t frame_drawn = 0u;

    state->dirty = 1u;
    input_init(&input);
    while (1) {
        if (state->dirty) {
            if (frame_drawn)
                draw_workout_plan_rows(data, state);
            else {
                draw_workout_plan(data, state);
                frame_drawn = 1u;
            }
            state->dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return WORKOUT_PLAN_CANCEL;
        if (input_pressed(&input, J_A | J_START)) return WORKOUT_PLAN_START;

        if (input_pressed(&input, J_UP)) {
            state->field = state->field == 0u ? (uint8_t)(PLAN_FIELD_COUNT - 1u)
                                              : (uint8_t)(state->field - 1u);
            state->dirty = 1u;
        } else if (input_pressed(&input, J_DOWN)) {
            state->field = (uint8_t)((state->field + 1u) % PLAN_FIELD_COUNT);
            state->dirty = 1u;
        } else if (input_pressed(&input, J_RIGHT)) {
            adjust_plan_field(state, 1u);
        } else if (input_pressed(&input, J_LEFT)) {
            adjust_plan_field(state, 0u);
        }
    }
}

static void draw_workout_set(const SaveData *data, const ExerciseCache *exercise,
                             const WorkoutSetState *state) {
    char set_buf[10];
    char weight_buf[14];
    char reps_buf[8];

    sprintf(set_buf, "SET %u/%u", (unsigned int)state->current_set,
            (unsigned int)state->total_sets);
    format_plan_weight(data, state->weight, weight_buf);
    sprintf(reps_buf, "%u", (unsigned int)state->reps);

    ui_title(STR_FREE_SESSION);
    ui_print_center(4u, exercise->name);
    ui_print_at(0u, 5u, STR_DIVIDER);
    ui_print_center(6u, set_buf);

    draw_plan_row(8u, STR_REPS, reps_buf, 0u);
    draw_plan_row(10u, STR_WEIGHT, weight_buf, 0u);

    ui_print_center(13u, STR_HINT_SET_OPTIONS);
    ui_print_center(14u, STR_HINT_SAVE_SET);
    ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_MENU);
}

static void draw_set_edit_rows(const SaveData *data, const WorkoutSetEditState *state) {
    char weight_buf[14];
    char reps_buf[8];

    format_plan_weight(data, state->weight, weight_buf);
    sprintf(reps_buf, "%u", (unsigned int)state->reps);

    draw_plan_row(8u, STR_WEIGHT, weight_buf, state->field == SET_FIELD_WEIGHT);
    draw_plan_row(10u, STR_REPS, reps_buf, state->field == SET_FIELD_REPS);
}

static void draw_set_edit(const SaveData *data, const ExerciseCache *exercise,
                          const WorkoutSetEditState *state) {
    ui_title(STR_EDIT_SET);
    ui_print_center(4u, exercise->name);
    ui_print_at(0u, 5u, STR_DIVIDER);

    draw_set_edit_rows(data, state);

    ui_print_center(14u, STR_HINT_EDIT_ROW);
    ui_footer(STR_FOOTER_CANCEL, STR_FOOTER_OK);
}

static void adjust_set_edit_field(WorkoutSetEditState *state, uint8_t increase) {
    if (state->field == SET_FIELD_WEIGHT) {
        state->weight = increase ? add_clamped_u16(state->weight, 1u, WORKOUT_WEIGHT_MAX)
                                 : sub_clamped_u16(state->weight, 1u, WORKOUT_WEIGHT_MIN);
    } else {
        state->reps = increase ? add_clamped_u8(state->reps, 1u, WORKOUT_REPS_MAX)
                               : sub_clamped_u8(state->reps, 1u, WORKOUT_REPS_MIN);
    }
    state->dirty = 1u;
}

static void workout_set_edit_screen(const SaveData *data, const ExerciseCache *exercise,
                                    WorkoutSetState *set) {
    InputState input;
    WorkoutSetEditState state;
    uint8_t frame_drawn = 0u;

    state.field = SET_FIELD_WEIGHT;
    state.weight = set->weight;
    state.reps = set->reps;
    state.dirty = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            if (frame_drawn)
                draw_set_edit_rows(data, &state);
            else {
                draw_set_edit(data, exercise, &state);
                frame_drawn = 1u;
            }
            state.dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_A | J_START)) {
            set->weight = state.weight;
            set->reps = state.reps;
            set->dirty = 1u;
            return;
        }

        if (input_pressed(&input, J_UP)) {
            state.field =
                state.field == 0u ? (uint8_t)(SET_FIELD_COUNT - 1u) : (uint8_t)(state.field - 1u);
            state.dirty = 1u;
        } else if (input_pressed(&input, J_DOWN)) {
            state.field = (uint8_t)((state.field + 1u) % SET_FIELD_COUNT);
            state.dirty = 1u;
        } else if (input_pressed(&input, J_RIGHT)) {
            adjust_set_edit_field(&state, 1u);
        } else if (input_pressed(&input, J_LEFT)) {
            adjust_set_edit_field(&state, 0u);
        }
    }
}

static void update_rest_timer(uint8_t seconds) {
    char timer_buf[8];
    uint8_t fill;

    sprintf(timer_buf, "%u SEC", (unsigned int)seconds);
    ui_clear_row(9u);
    ui_print_center(9u, timer_buf);

    fill = ui_bar_fill(seconds, WORKOUT_REST_SECONDS, 18u);
    ui_draw_bar(1u, 11u, 18u, fill);
}

static void draw_rest_timer(const ExerciseCache *exercise, uint8_t next_set, uint8_t total_sets,
                            uint8_t seconds) {
    char set_buf[16];

    sprintf(set_buf, "NEXT SET %u/%u", (unsigned int)next_set, (unsigned int)total_sets);

    ui_title(STR_REST);
    ui_print_center(5u, exercise->name);
    ui_print_center(7u, set_buf);
    update_rest_timer(seconds);

    ui_print_center(14u, STR_HINT_REST_SKIP);
    ui_footer("", STR_FOOTER_SKIP_TIMER);
}

static void workout_rest_timer(const ExerciseCache *exercise, uint8_t next_set,
                               uint8_t total_sets) {
    InputState input;
    uint8_t seconds = WORKOUT_REST_SECONDS;
    uint8_t frames = 0u;
    uint8_t dirty = 1u;
    uint8_t frame_drawn = 0u;

    input_init(&input);
    while (seconds > 0u) {
        if (dirty) {
            if (frame_drawn)
                update_rest_timer(seconds);
            else {
                draw_rest_timer(exercise, next_set, total_sets, seconds);
                frame_drawn = 1u;
            }
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_A | J_START)) return;

        ++frames;
        if (frames >= WORKOUT_REST_FRAMES) {
            frames = 0u;
            --seconds;
            dirty = 1u;
        }
    }
}

static uint8_t workout_save_set_or_rest(const SaveData *data, const WorkoutPlanState *plan,
                                        WorkoutSetState *state) {
    session_record_set(data, plan->exercise_idx, plan->exercise.muscle_group, state->weight,
                       state->reps);

    if (state->current_set >= state->total_sets) return 1u;

    workout_rest_timer(&plan->exercise, (uint8_t)(state->current_set + 1u), state->total_sets);
    ++state->current_set;
    state->dirty = 1u;

    return 0u;
}

static uint8_t workout_set_action_menu(void) {
    static const char *OPTIONS[5] = {
        STR_EDIT_SET, STR_SAVE_SET, STR_EX_OVERVIEW, STR_NEXT_EXERCISE, STR_END_WORKOUT,
    };
    uint8_t selected = ui_menu_select(STR_SET_OPTIONS, OPTIONS, 5u);

    /* Menu order maps 1:1 onto SET_MENU_ACTION_EDIT..END_WORKOUT (NONE = 0). */
    if (selected == UI_MENU_CANCEL) return SET_MENU_ACTION_NONE;
    return (uint8_t)(selected + 1u);
}

static void sync_plan_from_set(WorkoutPlanState *plan, const WorkoutSetState *set) {
    plan->weight = set->weight;
    plan->reps = set->reps;
    plan->dirty = 1u;
}

static uint8_t workout_set_flow(const SaveData *data, WorkoutPlanState *plan) {
    InputState input;
    WorkoutSetState state;
    uint8_t action;

    state.current_set = 1u;
    state.total_sets = plan->set_count;
    state.weight = plan->weight;
    state.reps = plan->reps;
    state.dirty = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            draw_workout_set(data, &plan->exercise, &state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) {
            sync_plan_from_set(plan, &state);
            return WORKOUT_SET_FLOW_BACK_TO_PLAN;
        }

        if (input_pressed(&input, J_A | J_START)) {
            if (workout_save_set_or_rest(data, plan, &state)) {
                sync_plan_from_set(plan, &state);
                return WORKOUT_SET_FLOW_NEXT_EXERCISE;
            }
            continue;
        }

        if (input_pressed(&input, J_SELECT)) {
            action = workout_set_action_menu();
            input_init(&input);

            if (action == SET_MENU_ACTION_EDIT) {
                workout_set_edit_screen(data, &plan->exercise, &state);
                input_init(&input);
            } else if (action == SET_MENU_ACTION_SAVE) {
                if (workout_save_set_or_rest(data, plan, &state)) {
                    sync_plan_from_set(plan, &state);
                    return WORKOUT_SET_FLOW_NEXT_EXERCISE;
                }
            } else if (action == SET_MENU_ACTION_OVERVIEW) {
                sync_plan_from_set(plan, &state);
                return WORKOUT_SET_FLOW_BACK_TO_PLAN;
            } else if (action == SET_MENU_ACTION_NEXT_EXERCISE) {
                sync_plan_from_set(plan, &state);
                return WORKOUT_SET_FLOW_NEXT_EXERCISE;
            } else if (action == SET_MENU_ACTION_END_WORKOUT) {
                sync_plan_from_set(plan, &state);
                return WORKOUT_SET_FLOW_END_WORKOUT;
            }
            state.dirty = 1u;
        }
    }
}

static void draw_exercise_complete(const char *exercise_name, uint8_t selected) {
    char buf[20];

    ui_title(STR_WELL_DONE);
    ui_print_center(5u, exercise_name);

    sprintf(buf, "%uEX %uS %uK", (unsigned int)session_exercise_count(),
            (unsigned int)session_set_count(), (unsigned int)(session_volume_kg() / 1000u));
    ui_print_center(7u, buf);

    ui_fill_attr(0u, 10u, 20u, 1u, selected == WORKOUT_DONE_ADD ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_print_at(1u, 10u, selected == WORKOUT_DONE_ADD ? ">" : " ");
    ui_print_at(3u, 10u, STR_ADD_EXERCISE);

    ui_fill_attr(0u, 12u, 20u, 1u,
                 selected == WORKOUT_DONE_FINISH ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_print_at(1u, 12u, selected == WORKOUT_DONE_FINISH ? ">" : " ");
    ui_print_at(3u, 12u, STR_FINISH_WORKOUT);

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_OK);
}

/*
 * Shown after an exercise is completed: a short congrats with the running
 * session totals and a choice to add another exercise or finish the workout.
 * Returns WORKOUT_DONE_ADD or WORKOUT_DONE_FINISH (B defaults to ADD so the
 * session is never finished by accident).
 */
static uint8_t workout_exercise_complete_menu(const char *exercise_name) {
    InputState input;
    uint8_t selected = WORKOUT_DONE_ADD;
    uint8_t dirty = 1u;

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_exercise_complete(exercise_name, selected);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_UP | J_DOWN)) {
            selected = selected == WORKOUT_DONE_ADD ? WORKOUT_DONE_FINISH : WORKOUT_DONE_ADD;
            dirty = 1u;
        }

        if (input_pressed(&input, J_B)) return WORKOUT_DONE_ADD;

        if (input_pressed(&input, J_A | J_START)) return selected;
    }
}

/* ── Post-workout overview ──────────────────────────────────────────────────── */

static void draw_workout_overview(uint8_t n_exercises, uint8_t sets, uint16_t volume_kg) {
    char buf[14];

    ui_title(STR_WORKOUT_DONE);
    ui_print_center(5u, STR_WELL_DONE);
    ui_print_at(0u, 6u, STR_DIVIDER);

    ui_print_at(1u, 8u, STR_EXERCISES);
    sprintf(buf, "%u", (unsigned int)n_exercises);
    print_right(8u, buf);

    ui_print_at(1u, 10u, STR_SETS);
    sprintf(buf, "%u", (unsigned int)sets);
    print_right(10u, buf);

    ui_print_at(1u, 12u, STR_VOLUME);
    sprintf(buf, "%uK", (unsigned int)(volume_kg / 1000u));
    print_right(12u, buf);

    ui_footer("", STR_FOOTER_CONTINUE);
}

/*
 * Shown once a workout has been saved: the final session totals plus a single
 * CONTINUE button back to the workout history. Any button dismisses it.
 */
static void workout_show_overview(uint8_t n_exercises, uint8_t sets, uint16_t volume_kg) {
    InputState input;
    uint8_t dirty = 1u;

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_workout_overview(n_exercises, sets, volume_kg);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_A | J_START | J_B)) return;
    }
}

static void workout_finish_with_overview(SaveData *data) {
    uint8_t n_exercises = session_exercise_count();
    uint8_t sets = session_set_count();
    uint16_t volume_kg = session_volume_kg();

    if (sets != 0u && workoutlog_is_full(sets)) {
        if (ui_confirm(STR_WKT_LOG_FULL, STR_WKT_LOG_FULL_Q)) {
            /* User chose to save; workoutlog_add will drop the oldest entry. */
            if (session_finish(data)) {
                workout_show_overview(n_exercises, sets, volume_kg);
            }
        } else {
            session_reset();
        }
        return;
    }

    if (session_finish(data) && sets != 0u) {
        workout_show_overview(n_exercises, sets, volume_kg);
    }
}

/* ── Saved-workout detail ───────────────────────────────────────────────────── */

static uint8_t build_detail_rows(uint8_t set_count) {
    uint8_t i;
    uint8_t row_count = 0u;
    uint8_t prev_ex = WORKOUT_NO_EXERCISE;
    uint8_t ex;

    for (i = 0u; i != set_count; ++i) {
        ex = workout_detail_sets[i].exercise_idx;
        if (ex != prev_ex) {
            workout_detail_rows[row_count].is_header = 1u;
            workout_detail_rows[row_count].value = ex;
            ++row_count;
            prev_ex = ex;
        }
        workout_detail_rows[row_count].is_header = 0u;
        workout_detail_rows[row_count].value = i;
        ++row_count;
    }

    return row_count;
}

static void draw_detail_row(const SaveData *data, uint8_t y, uint8_t row_idx, uint8_t row_count) {
    const WorkoutDetailRow *row;
    const WorkoutLogSet *set;
    ExerciseCache exercise;
    uint16_t weight;
    char buf[14];

    if (row_idx >= row_count) return;

    row = &workout_detail_rows[row_idx];
    if (row->is_header) {
        ex_load(row->value, &exercise);
        ui_fill_attr(0u, y, 20u, 1u, UI_PAL_PANEL);
        ui_print_at(0u, y, exercise.name);
        return;
    }

    set = &workout_detail_sets[row->value];
    if (data->units == UNITS_IMPERIAL) {
        weight = kg_tenths_to_lbs(set->weight_kg_tenths);
    } else {
        weight = (uint16_t)((set->weight_kg_tenths + 5u) / 10u);
    }

    if (weight == 0u) {
        sprintf(buf, "%u %s", (unsigned int)set->reps, STR_REPS_SHORT);
    } else {
        sprintf(buf, "%u X %u %s", (unsigned int)set->reps, (unsigned int)weight,
                data->units == UNITS_IMPERIAL ? "LB" : "KG");
    }
    ui_print_at(2u, y, buf);
}

static void draw_workout_detail(const SaveData *data, const WorkoutLogSummary *summary,
                                uint8_t row_count, uint8_t scroll) {
    char title[20];
    char buf[14];
    uint8_t i;
    uint8_t end;

    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_WORKOUT_DETAIL);

    format_workout_title(summary, title);
    ui_print_at(0u, 1u, title);
    ui_print_at(0u, 2u, STR_DIVIDER);

    sprintf(buf, "%uEX %uS %uK", (unsigned int)summary->exercise_count,
            (unsigned int)summary->set_count, (unsigned int)(summary->volume_kg / 1000u));
    ui_print_center(3u, buf);
    ui_print_at(0u, 4u, STR_DIVIDER);

    for (i = 0u; i != WORKOUT_DETAIL_VISIBLE; ++i) {
        draw_detail_row(data, (uint8_t)(5u + i), (uint8_t)(scroll + i), row_count);
    }

    if (row_count > WORKOUT_DETAIL_VISIBLE) {
        end = (uint8_t)(scroll + WORKOUT_DETAIL_VISIBLE);
        if (end > row_count) end = row_count;
        sprintf(buf, "%u-%u OF %u", (unsigned int)(scroll + 1u), (unsigned int)end,
                (unsigned int)row_count);
        ui_print_center(15u, buf);
    }

    ui_footer(STR_FOOTER_BACK, "");
}

/*
 * Read-only screen for a saved workout (newest_idx, 0 = most recent): the
 * generated title, the session totals, and every logged set grouped under its
 * exercise name. Up/Down scrolls the set list; B returns to the history.
 */
static void workout_show_detail(const SaveData *data, uint8_t newest_idx) {
    WorkoutLogSummary summary;
    InputState input;
    uint8_t set_count;
    uint8_t row_count;
    uint8_t scroll = 0u;
    uint8_t dirty = 1u;

    if (!workoutlog_get_summary(newest_idx, &summary)) return;

    set_count = workoutlog_get_sets(newest_idx, workout_detail_sets, WORKOUT_DETAIL_SET_CAP);
    row_count = build_detail_rows(set_count);

    input_init(&input);
    while (1) {
        if (dirty) {
            draw_workout_detail(data, &summary, row_count, scroll);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_DOWN) && row_count > WORKOUT_DETAIL_VISIBLE &&
            (uint8_t)(scroll + WORKOUT_DETAIL_VISIBLE) < row_count) {
            ++scroll;
            dirty = 1u;
        }

        if (input_pressed(&input, J_UP) && scroll > 0u) {
            --scroll;
            dirty = 1u;
        }
    }
}

static void workout_start_free_session(SaveData *data) {
    uint8_t exercise_idx;
    uint8_t flow_result;
    WorkoutPlanState plan;

    session_reset();

    while (1) {
        exercise_idx = workout_exercise_picker();
        if (exercise_idx == WORKOUT_NO_EXERCISE) {
            workout_finish_with_overview(data);
            return;
        }

        init_workout_plan(data, exercise_idx, &plan);

        while (1) {
            if (workout_plan_screen(data, &plan) == WORKOUT_PLAN_CANCEL) break;

            flow_result = workout_set_flow(data, &plan);
            if (flow_result == WORKOUT_SET_FLOW_BACK_TO_PLAN) continue;
            if (flow_result == WORKOUT_SET_FLOW_END_WORKOUT) {
                workout_finish_with_overview(data);
                return;
            }

            /* Exercise completed: congratulate and let the user add another
             * exercise or finish (and save) the whole workout. */
            if (workout_exercise_complete_menu(plan.exercise.name) == WORKOUT_DONE_FINISH) {
                workout_finish_with_overview(data);
                return;
            }
            break;
        }
    }
}

void workouts_show(SaveData *data) BANKED {
    WorkoutsState state;
    InputState input;
    WorkoutAction action;
    uint8_t count;

    list_cursor_reset(&state.cursor);
    state.dirty = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            draw_workouts(data, &state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_SELECT)) {
            action = workouts_action_menu();
            if (action == WORKOUT_ACTION_HOME) return;
            if (action == WORKOUT_ACTION_START) {
                workout_start_free_session(data);
                list_cursor_reset(&state.cursor);
            }
            state.dirty = 1u;
            continue;
        }

        count = workoutlog_count();

        if (input_pressed(&input, J_A | J_START) && list_cursor_index(&state.cursor) < count) {
            workout_show_detail(data, list_cursor_index(&state.cursor));
            state.dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_DOWN) &&
            list_cursor_down(&state.cursor, count, WORKOUT_VISIBLE)) {
            state.dirty = 1u;
        }

        if (input_pressed(&input, J_UP) && list_cursor_up(&state.cursor)) {
            state.dirty = 1u;
        }
    }
}
