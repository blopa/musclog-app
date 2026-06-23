#pragma bank 5

#include "onboarding.h"

#include "copies.h"
#include "database.h"
#include "input.h"
#include "nutrition_math.h"
#include "rtc.h"
#include "ui_text.h"
#include "utils.h"

#include <gb/gb.h>
#include <gbdk/console.h>
#include <stdio.h>

#define AGE_MIN       13u
#define AGE_MAX       99u
#define HEIGHT_IN_MIN 47u
#define HEIGHT_IN_MAX 91u
#define WEIGHT_LB_MIN 66u
#define WEIGHT_LB_MAX 551u
#define CAL_MIN       800u
#define CAL_MAX       6000u
#define MACRO_MAX     999u
#define FIBER_MAX     99u

typedef enum OnboardingStep {
    STEP_WELCOME,
    STEP_AGE,
    STEP_HEIGHT,
    STEP_WEIGHT,
    STEP_EXPERIENCE,
    STEP_FITNESS,
    STEP_WEIGHT_GOAL,
    STEP_REVIEW,
    STEP_EDIT_CALORIES,
    STEP_EDIT_PROTEIN,
    STEP_EDIT_CARBS,
    STEP_EDIT_FAT,
    STEP_EDIT_FIBER
} OnboardingStep;

/* Back-pointer for each step: step_prev[step] = where B-button returns. */
static const OnboardingStep step_prev[] = {
    STEP_WELCOME,        /* STEP_WELCOME: no back */
    STEP_WELCOME,        /* STEP_AGE */
    STEP_AGE,            /* STEP_HEIGHT */
    STEP_HEIGHT,         /* STEP_WEIGHT */
    STEP_WEIGHT,         /* STEP_EXPERIENCE */
    STEP_EXPERIENCE,     /* STEP_FITNESS */
    STEP_FITNESS,        /* STEP_WEIGHT_GOAL */
    STEP_WEIGHT_GOAL,    /* STEP_REVIEW */
    STEP_REVIEW,         /* STEP_EDIT_CALORIES */
    STEP_EDIT_CALORIES,  /* STEP_EDIT_PROTEIN */
    STEP_EDIT_PROTEIN,   /* STEP_EDIT_CARBS */
    STEP_EDIT_CARBS,     /* STEP_EDIT_FAT */
    STEP_EDIT_FAT,       /* STEP_EDIT_FIBER */
};

/* Forward-pointer for each step: step_next[step] = where A/Start advances. */
static const OnboardingStep step_next[] = {
    STEP_AGE,            /* STEP_WELCOME */
    STEP_HEIGHT,         /* STEP_AGE */
    STEP_WEIGHT,         /* STEP_HEIGHT */
    STEP_EXPERIENCE,     /* STEP_WEIGHT */
    STEP_FITNESS,        /* STEP_EXPERIENCE */
    STEP_WEIGHT_GOAL,    /* STEP_FITNESS */
    STEP_REVIEW,         /* STEP_WEIGHT_GOAL */
    STEP_REVIEW,         /* STEP_REVIEW: special-cased in handle_accept */
    STEP_EDIT_PROTEIN,   /* STEP_EDIT_CALORIES */
    STEP_EDIT_CARBS,     /* STEP_EDIT_PROTEIN */
    STEP_EDIT_FAT,       /* STEP_EDIT_CARBS */
    STEP_EDIT_FIBER,     /* STEP_EDIT_FAT */
    STEP_REVIEW,         /* STEP_EDIT_FIBER */
};

typedef struct OnboardingState {
    SaveData *data;
    OnboardingStep step;
    uint8_t selected;
    uint8_t height_inches;
    uint16_t weight_lbs;
    uint8_t dirty;
    uint8_t done;
} OnboardingState;

static const char *experience_options[] = { STR_BEGINNER, STR_INTERMEDIATE, STR_ADVANCED };
static const char *fitness_options[] = { STR_MUSCLE, STR_STRENGTH, STR_ENDURANCE, STR_GENERAL };
static const char *weight_goal_options[] = { STR_LOSE, STR_MAINTAIN, STR_GAIN };
static const char *review_options[] = { STR_SAVE_PROFILE, STR_EDIT_TARGETS };

static uint8_t cm_to_inches(uint16_t cm) {
    uint16_t inches = (uint16_t)((((uint32_t)cm * 100u) + 127u) / 254u);
    return clamp_u8((uint8_t)inches, HEIGHT_IN_MIN, HEIGHT_IN_MAX);
}

static uint16_t inches_to_cm(uint8_t inches) {
    return (uint16_t)((((uint16_t)inches * 254u) + 50u) / 100u);
}

static uint16_t kg_tenths_to_lbs(uint16_t kg_tenths) {
    return (uint16_t)((((uint32_t)kg_tenths * 1000u) + 2268u) / 4536u);
}

static uint16_t lbs_to_kg_tenths(uint16_t lbs) {
    return (uint16_t)((((uint32_t)lbs * 4536u) + 500u) / 1000u);
}

static uint8_t menu_selected_for_step(const OnboardingState *state, OnboardingStep step) {
    switch (step) {
        case STEP_EXPERIENCE:   return state->data->lifting_experience;
        case STEP_FITNESS:      return state->data->fitness_focus;
        case STEP_WEIGHT_GOAL:  return state->data->weight_goal;
        case STEP_REVIEW:       return 0u;
        default:                return state->selected;
    }
}

static void enter_step(OnboardingState *state, OnboardingStep step) {
    state->step = step;
    state->selected = menu_selected_for_step(state, step);
    state->dirty = 1u;
}

static void step_back(OnboardingState *state) {
    enter_step(state, step_prev[state->step]);
}

static const char *gender_label(uint8_t gender) {
    if (gender == GENDER_FEMALE) return STR_FEMALE;
    if (gender == GENDER_OTHER) return STR_OTHER;
    return STR_MALE;
}

static const char *activity_label(uint8_t activity_level) {
    switch (activity_level) {
        case 1u: return STR_ACTIVITY_LOW;
        case 2u: return STR_ACTIVITY_LIGHT;
        case 3u: return STR_ACTIVITY_MODERATE;
        case 4u: return STR_ACTIVITY_ACTIVE;
        case 5u: return STR_ACTIVITY_VERY_ACTIVE;
        default: return STR_ACTIVITY_LIGHT;
    }
}

static void draw_box_row(uint8_t y, const char *value, uint8_t focused) {
    ui_print_at(0u, (uint8_t)(y - 1u), STR_BOX_BORDER);
    ui_fill_attr(1u, y, 18u, 1u, focused ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_print_at(0u, y, STR_BOX_EMPTY);
    ui_print_at(1u, y, focused ? ">" : " ");
    ui_print_at(3u, y, value);
    ui_print_at(0u, (uint8_t)(y + 1u), STR_BOX_BORDER);
}

static void draw_unit_row(const OnboardingState *state) {
    ui_print_at(0u, 3u, STR_BOX_BORDER);
    ui_fill_attr(1u, 4u, 8u, 1u, state->data->units == UNITS_METRIC ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_fill_attr(10u, 4u, 9u, 1u, state->data->units == UNITS_IMPERIAL ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_print_at(0u, 4u, STR_BOX_SPLIT);
    ui_print_at(state->data->units == UNITS_METRIC ? 1u : 10u, 4u, ">");
    ui_print_at(2u, 4u, STR_METRIC);
    ui_print_at(11u, 4u, STR_IMPERIAL);
    ui_print_at(0u, 5u, STR_BOX_BORDER);
}

static void draw_welcome(const OnboardingState *state) {
    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_at(1u, 0u, "[#][][]");
    ui_print_at(8u, 0u, STR_LETS_START);

    ui_print_at(0u, 2u, state->selected == 0u ? ">" : " ");
    ui_print_at(1u, 2u, STR_UNIT_SYSTEM);
    draw_unit_row(state);

    ui_print_at(0u, 7u, state->selected == 1u ? ">" : " ");
    ui_print_at(1u, 7u, STR_BIOLOGICAL_SEX);
    draw_box_row(9u, gender_label(state->data->gender), state->selected == 1u);

    ui_print_at(0u, 11u, state->selected == 2u ? ">" : " ");
    ui_print_at(1u, 11u, STR_ACTIVITY_LEVEL);
    draw_box_row(13u, activity_label(state->data->activity_level), state->selected == 2u);

    ui_print_center(15u, STR_HINT_FIELD_SET);
    ui_footer("", STR_FOOTER_NEXT);
}

static void format_height(const OnboardingState *state, char *buffer) {
    uint8_t feet;
    uint8_t inches;

    if (state->data->units == UNITS_IMPERIAL) {
        feet = (uint8_t)(state->height_inches / 12u);
        inches = (uint8_t)(state->height_inches % 12u);
        sprintf(buffer, "%u'%u\"", feet, inches);
    } else {
        sprintf(buffer, "%u CM", state->data->height_cm);
    }
}

static void format_weight(const OnboardingState *state, char *buffer) {
    if (state->data->units == UNITS_IMPERIAL) {
        sprintf(buffer, "%u LB", state->weight_lbs);
    } else {
        sprintf(buffer, "%u.%u KG", state->data->weight_kg_tenths / 10u, state->data->weight_kg_tenths % 10u);
    }
}

static void draw_review(const OnboardingState *state) {
    uint8_t i;
    char row[20];

    ui_title(STR_REVIEW);
    sprintf(row, "CAL %u KCAL", state->data->calorie_goal);
    ui_print_at(1u, 5u, row);
    sprintf(row, "P%u C%u", state->data->protein_goal, state->data->carbs_goal);
    ui_print_at(1u, 7u, row);
    sprintf(row, "F%u FI%u", state->data->fat_goal, state->data->fiber_goal);
    ui_print_at(1u, 8u, row);

    for (i = 0u; i != 2u; ++i) {
        ui_print_at(1u, (uint8_t)(11u + i), i == state->selected ? ">" : " ");
        ui_print_at(3u, (uint8_t)(11u + i), review_options[i]);
    }

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_OK);
}

static void draw_edit_screen(const OnboardingState *state) {
    char value[16];

    switch (state->step) {
        case STEP_EDIT_CALORIES:
            sprintf(value, "%u KCAL", state->data->calorie_goal);
            ui_draw_value_screen(STR_EDIT_CAL, STR_CALORIES, value, STR_HINT_STEP_10);
            break;
        case STEP_EDIT_PROTEIN:
            sprintf(value, "%u G", state->data->protein_goal);
            ui_draw_value_screen(STR_EDIT_PRO, STR_PROTEIN, value, STR_HINT_STEP_1);
            break;
        case STEP_EDIT_CARBS:
            sprintf(value, "%u G", state->data->carbs_goal);
            ui_draw_value_screen(STR_EDIT_CARB, STR_CARBS, value, STR_HINT_STEP_1);
            break;
        case STEP_EDIT_FAT:
            sprintf(value, "%u G", state->data->fat_goal);
            ui_draw_value_screen(STR_EDIT_FAT, STR_FAT, value, STR_HINT_STEP_1);
            break;
        case STEP_EDIT_FIBER:
            sprintf(value, "%u G", state->data->fiber_goal);
            ui_draw_value_screen(STR_EDIT_FIBER, STR_FIBER, value, STR_HINT_STEP_1);
            break;
        default:
            break;
    }
}

static uint8_t is_value_step(OnboardingStep step) {
    switch (step) {
        case STEP_AGE:
        case STEP_HEIGHT:
        case STEP_WEIGHT:
        case STEP_EDIT_CALORIES:
        case STEP_EDIT_PROTEIN:
        case STEP_EDIT_CARBS:
        case STEP_EDIT_FAT:
        case STEP_EDIT_FIBER:
            return 1u;
        default:
            return 0u;
    }
}

static void format_value_step(const OnboardingState *state, char *value) {
    switch (state->step) {
        case STEP_AGE:
            sprintf(value, "%u YEARS", state->data->age);
            break;
        case STEP_HEIGHT:
            format_height(state, value);
            break;
        case STEP_WEIGHT:
            format_weight(state, value);
            break;
        case STEP_EDIT_CALORIES:
            sprintf(value, "%u KCAL", state->data->calorie_goal);
            break;
        case STEP_EDIT_PROTEIN:
            sprintf(value, "%u G", state->data->protein_goal);
            break;
        case STEP_EDIT_CARBS:
            sprintf(value, "%u G", state->data->carbs_goal);
            break;
        case STEP_EDIT_FAT:
            sprintf(value, "%u G", state->data->fat_goal);
            break;
        case STEP_EDIT_FIBER:
            sprintf(value, "%u G", state->data->fiber_goal);
            break;
        default:
            value[0] = '\0';
            break;
    }
}

static void update_value_step(const OnboardingState *state) {
    char value[16];

    format_value_step(state, value);
    ui_clear_row(8u);
    ui_print_center(8u, value);
}

static void render_step(const OnboardingState *state) {
    char value[16];

    switch (state->step) {
        case STEP_WELCOME:
            draw_welcome(state);
            break;
        case STEP_AGE:
            format_value_step(state, value);
            ui_draw_value_screen(STR_AGE, STR_YOUR_AGE, value, STR_HINT_CHANGE);
            break;
        case STEP_HEIGHT:
            format_value_step(state, value);
            ui_draw_value_screen(STR_HEIGHT, STR_YOUR_HEIGHT, value, STR_HINT_CHANGE);
            break;
        case STEP_WEIGHT:
            format_value_step(state, value);
            ui_draw_value_screen(STR_WEIGHT, STR_YOUR_WEIGHT, value, STR_HINT_CHANGE);
            break;
        case STEP_EXPERIENCE:
            ui_draw_menu(STR_EXPERIENCE, experience_options, 3u, state->selected);
            break;
        case STEP_FITNESS:
            ui_draw_menu(STR_FOCUS, fitness_options, 4u, state->selected);
            break;
        case STEP_WEIGHT_GOAL:
            ui_draw_menu(STR_GOAL, weight_goal_options, 3u, state->selected);
            break;
        case STEP_REVIEW:
            draw_review(state);
            break;
        case STEP_EDIT_CALORIES:
        case STEP_EDIT_PROTEIN:
        case STEP_EDIT_CARBS:
        case STEP_EDIT_FAT:
        case STEP_EDIT_FIBER:
            draw_edit_screen(state);
            break;
    }
}

static void menu_input(OnboardingState *state, const InputState *input, uint8_t count) {
    if (input_pressed(input, J_UP)) {
        state->selected = state->selected == 0u ? (uint8_t)(count - 1u) : (uint8_t)(state->selected - 1u);
        state->dirty = 1u;
    } else if (input_pressed(input, J_DOWN)) {
        state->selected = (uint8_t)((state->selected + 1u) % count);
        state->dirty = 1u;
    }
}

static void setup_input(OnboardingState *state, const InputState *input) {
    if (input_pressed(input, J_UP)) {
        state->selected = state->selected == 0u ? 2u : (uint8_t)(state->selected - 1u);
        state->dirty = 1u;
    } else if (input_pressed(input, J_DOWN)) {
        state->selected = (uint8_t)((state->selected + 1u) % 3u);
        state->dirty = 1u;
    } else if (input_pressed(input, J_LEFT | J_RIGHT)) {
        if (state->selected == 0u) {
            state->data->units = state->data->units == UNITS_METRIC ? UNITS_IMPERIAL : UNITS_METRIC;
            state->height_inches = cm_to_inches(state->data->height_cm);
            state->weight_lbs = kg_tenths_to_lbs(state->data->weight_kg_tenths);
        } else if (state->selected == 1u) {
            if (input_pressed(input, J_LEFT)) {
                state->data->gender = state->data->gender == GENDER_MALE ? GENDER_OTHER : (uint8_t)(state->data->gender - 1u);
            } else {
                state->data->gender = (uint8_t)((state->data->gender + 1u) % 3u);
            }
        } else {
            if (input_pressed(input, J_LEFT)) {
                state->data->activity_level = state->data->activity_level <= 1u ? 5u : (uint8_t)(state->data->activity_level - 1u);
            } else {
                state->data->activity_level = state->data->activity_level >= 5u ? 1u : (uint8_t)(state->data->activity_level + 1u);
            }
        }
        state->dirty = 1u;
    }
}

static uint8_t spinner_u8(const InputState *input, uint8_t v, uint8_t small_step, uint8_t large_step, uint8_t mn, uint8_t mx) {
    if (input_pressed(input, J_UP))    v = add_clamped_u8(v, small_step, mx);
    if (input_pressed(input, J_DOWN))  v = sub_clamped_u8(v, small_step, mn);
    if (input_pressed(input, J_RIGHT)) v = add_clamped_u8(v, large_step, mx);
    if (input_pressed(input, J_LEFT))  v = sub_clamped_u8(v, large_step, mn);
    return v;
}

static uint16_t spinner_u16(const InputState *input, uint16_t v, uint16_t small_step, uint16_t large_step, uint16_t mn, uint16_t mx) {
    if (input_pressed(input, J_UP))    v = add_clamped_u16(v, small_step, mx);
    if (input_pressed(input, J_DOWN))  v = sub_clamped_u16(v, small_step, mn);
    if (input_pressed(input, J_RIGHT)) v = add_clamped_u16(v, large_step, mx);
    if (input_pressed(input, J_LEFT))  v = sub_clamped_u16(v, large_step, mn);
    return v;
}

static void spinner_input(OnboardingState *state, const InputState *input) {
    if (state->step == STEP_AGE) {
        state->data->age = spinner_u8(input, state->data->age, 1u, 10u, AGE_MIN, AGE_MAX);
    } else if (state->step == STEP_HEIGHT) {
        if (state->data->units == UNITS_IMPERIAL) {
            state->height_inches = spinner_u8(input, state->height_inches, 1u, 12u, HEIGHT_IN_MIN, HEIGHT_IN_MAX);
            state->data->height_cm = inches_to_cm(state->height_inches);
        } else {
            state->data->height_cm = spinner_u16(input, state->data->height_cm, 1u, 10u, DB_HEIGHT_CM_MIN, DB_HEIGHT_CM_MAX);
        }
    } else { /* STEP_WEIGHT */
        if (state->data->units == UNITS_IMPERIAL) {
            state->weight_lbs = spinner_u16(input, state->weight_lbs, 1u, 10u, WEIGHT_LB_MIN, WEIGHT_LB_MAX);
            state->data->weight_kg_tenths = lbs_to_kg_tenths(state->weight_lbs);
        } else {
            state->data->weight_kg_tenths = spinner_u16(input, state->data->weight_kg_tenths, 5u, 50u, DB_WEIGHT_KG_TENTHS_MIN, DB_WEIGHT_KG_TENTHS_MAX);
        }
    }

    if (input_pressed(input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) {
        state->dirty = 1u;
    }
}

static void edit_goal_input(OnboardingState *state, const InputState *input) {
    uint16_t *value;
    uint16_t  min;
    uint16_t  max;
    uint16_t  small;
    uint16_t  large;

    switch (state->step) {
        case STEP_EDIT_CALORIES:
            value = &state->data->calorie_goal;
            min = CAL_MIN; max = CAL_MAX; small = 10u; large = 100u;
            break;
        case STEP_EDIT_PROTEIN:
            value = &state->data->protein_goal;
            min = 0u; max = MACRO_MAX; small = 1u; large = 10u;
            break;
        case STEP_EDIT_CARBS:
            value = &state->data->carbs_goal;
            min = 0u; max = MACRO_MAX; small = 1u; large = 10u;
            break;
        case STEP_EDIT_FAT:
            value = &state->data->fat_goal;
            min = 0u; max = MACRO_MAX; small = 1u; large = 10u;
            break;
        case STEP_EDIT_FIBER:
            value = &state->data->fiber_goal;
            min = 0u; max = FIBER_MAX; small = 1u; large = 10u;
            break;
        default:
            return;
    }

    if (input_pressed(input, J_UP))    *value = add_clamped_u16(*value, small, max);
    if (input_pressed(input, J_DOWN))  *value = sub_clamped_u16(*value, small, min);
    if (input_pressed(input, J_RIGHT)) *value = add_clamped_u16(*value, large, max);
    if (input_pressed(input, J_LEFT))  *value = sub_clamped_u16(*value, large, min);

    if (input_pressed(input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) {
        state->dirty = 1u;
    }
}

static void handle_accept(OnboardingState *state) {
    switch (state->step) {
        case STEP_WELCOME:
            state->height_inches = cm_to_inches(state->data->height_cm);
            state->weight_lbs = kg_tenths_to_lbs(state->data->weight_kg_tenths);
            break;
        case STEP_EXPERIENCE:
            state->data->lifting_experience = state->selected;
            break;
        case STEP_FITNESS:
            state->data->fitness_focus = state->selected;
            break;
        case STEP_WEIGHT_GOAL:
            state->data->weight_goal = state->selected;
            nutrition_apply_generated_goals(state->data);
            break;
        case STEP_REVIEW:
            if (state->selected == 0u) {
                state->data->onboarding_complete = 1u;
                db_save(state->data);
                /* Ask for current date & time so the MBC3 RTC is calibrated
                 * before the user reaches the home screen.  The hardware day
                 * counter then ticks on its own — no software update needed. */
                rtc_setup_date(state->data);
                state->done = 1u;
            } else {
                enter_step(state, STEP_EDIT_CALORIES);
            }
            return;
        default:
            break;
    }
    enter_step(state, step_next[state->step]);
}

static void handle_input(OnboardingState *state, const InputState *input) {
    if (input_pressed(input, J_B)) {
        step_back(state);
        return;
    }

    switch (state->step) {
        case STEP_WELCOME:
            setup_input(state, input);
            break;
        case STEP_EXPERIENCE:
            menu_input(state, input, 3u);
            break;
        case STEP_FITNESS:
            menu_input(state, input, 4u);
            break;
        case STEP_WEIGHT_GOAL:
            menu_input(state, input, 3u);
            break;
        case STEP_REVIEW:
            menu_input(state, input, 2u);
            break;
        case STEP_AGE:
        case STEP_HEIGHT:
        case STEP_WEIGHT:
            spinner_input(state, input);
            break;
        case STEP_EDIT_CALORIES:
        case STEP_EDIT_PROTEIN:
        case STEP_EDIT_CARBS:
        case STEP_EDIT_FAT:
        case STEP_EDIT_FIBER:
            edit_goal_input(state, input);
            break;
    }

    if (input_pressed(input, J_A | J_START)) {
        handle_accept(state);
    }
}

void onboarding_run(SaveData *data) BANKED {
    OnboardingState state;
    InputState input;
    OnboardingStep rendered_step;

    db_init_defaults(data);
    nutrition_apply_generated_goals(data);

    state.data = data;
    state.step = STEP_WELCOME;
    state.selected = 0u;
    state.height_inches = cm_to_inches(data->height_cm);
    state.weight_lbs = kg_tenths_to_lbs(data->weight_kg_tenths);
    state.dirty = 1u;
    state.done = 0u;
    rendered_step = (OnboardingStep)0xFFu;

    input_init(&input);
    while (!state.done) {
        if (state.dirty) {
            if (state.step == rendered_step && is_value_step(state.step)) {
                update_value_step(&state);
            } else {
                render_step(&state);
                rendered_step = state.step;
            }
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);
        handle_input(&state, &input);
    }
}
