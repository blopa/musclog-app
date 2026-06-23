#pragma bank 5

#include "workouts.h"

#include "copies.h"
#include "input.h"
#include "ui_text.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

#define WORKOUT_VISIBLE 4u
#define WORKOUT_COUNT   8u

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

void workouts_show(void) BANKED {
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
            (void)workouts_action_menu();
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
