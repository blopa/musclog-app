#include "onboarding.h"

#include "input.h"
#include "nutrition_math.h"
#include "storage.h"
#include "ui_text.h"

#include <gb/gb.h>
#include <gbdk/console.h>
#include <stdio.h>

#define AGE_MIN 13u
#define AGE_MAX 99u
#define HEIGHT_CM_MIN 120u
#define HEIGHT_CM_MAX 230u
#define HEIGHT_IN_MIN 47u
#define HEIGHT_IN_MAX 91u
#define WEIGHT_KG_TENTHS_MIN 300u
#define WEIGHT_KG_TENTHS_MAX 2500u
#define WEIGHT_LB_MIN 66u
#define WEIGHT_LB_MAX 551u
#define CAL_MIN 800u
#define CAL_MAX 6000u
#define MACRO_MAX 999u
#define FIBER_MAX 99u

typedef enum OnboardingStep {
    STEP_WELCOME,
    STEP_UNITS,
    STEP_GENDER,
    STEP_AGE,
    STEP_HEIGHT,
    STEP_WEIGHT,
    STEP_ACTIVITY,
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

typedef struct OnboardingState {
    SaveData *data;
    OnboardingStep step;
    uint8_t selected;
    uint8_t height_inches;
    uint16_t weight_lbs;
    uint8_t dirty;
    uint8_t done;
} OnboardingState;

static const char *activity_options[] = { "LOW", "LIGHT", "MODERATE", "ACTIVE", "VERY ACTIVE" };
static const char *experience_options[] = { "BEGINNER", "INTERMEDIATE", "ADVANCED" };
static const char *fitness_options[] = { "MUSCLE", "STRENGTH", "ENDURANCE", "GENERAL" };
static const char *weight_goal_options[] = { "LOSE", "MAINTAIN", "GAIN" };
static const char *review_options[] = { "SAVE PROFILE", "EDIT TARGETS" };

static uint8_t clamp_u8(uint8_t value, uint8_t min, uint8_t max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

static uint16_t clamp_u16(uint16_t value, uint16_t min, uint16_t max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

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
        case STEP_UNITS:
            return state->data->units;
        case STEP_GENDER:
            return state->data->gender;
        case STEP_ACTIVITY:
            return state->data->activity_level > 0u ? (uint8_t)(state->data->activity_level - 1u) : 0u;
        case STEP_EXPERIENCE:
            return state->data->lifting_experience;
        case STEP_FITNESS:
            return state->data->fitness_focus;
        case STEP_WEIGHT_GOAL:
            return state->data->weight_goal;
        case STEP_REVIEW:
            return 0u;
        default:
            return state->selected;
    }
}

static void enter_step(OnboardingState *state, OnboardingStep step) {
    state->step = step;
    state->selected = menu_selected_for_step(state, step);
    state->dirty = 1u;
}

static void step_back(OnboardingState *state) {
    switch (state->step) {
        case STEP_AGE:
            enter_step(state, STEP_WELCOME);
            break;
        case STEP_HEIGHT:
            enter_step(state, STEP_AGE);
            break;
        case STEP_WEIGHT:
            enter_step(state, STEP_HEIGHT);
            break;
        case STEP_ACTIVITY:
            enter_step(state, STEP_WEIGHT);
            break;
        case STEP_EXPERIENCE:
            enter_step(state, STEP_WEIGHT);
            break;
        case STEP_FITNESS:
            enter_step(state, STEP_EXPERIENCE);
            break;
        case STEP_WEIGHT_GOAL:
            enter_step(state, STEP_FITNESS);
            break;
        case STEP_REVIEW:
            enter_step(state, STEP_WEIGHT_GOAL);
            break;
        case STEP_EDIT_CALORIES:
            enter_step(state, STEP_REVIEW);
            break;
        case STEP_EDIT_PROTEIN:
            enter_step(state, STEP_EDIT_CALORIES);
            break;
        case STEP_EDIT_CARBS:
            enter_step(state, STEP_EDIT_PROTEIN);
            break;
        case STEP_EDIT_FAT:
            enter_step(state, STEP_EDIT_CARBS);
            break;
        case STEP_EDIT_FIBER:
            enter_step(state, STEP_EDIT_FAT);
            break;
        case STEP_WELCOME:
        default:
            break;
    }
}

static const char *gender_label(uint8_t gender) {
    if (gender == GENDER_FEMALE) return "FEMALE";
    if (gender == GENDER_OTHER) return "OTHER";
    return "MALE";
}

static const char *activity_label(uint8_t activity_level) {
    switch (activity_level) {
        case 1u: return "LOW";
        case 2u: return "LIGHT";
        case 3u: return "MODERATE";
        case 4u: return "ACTIVE";
        case 5u: return "VERY ACTIVE";
        default: return "LIGHT";
    }
}

static void draw_box_row(uint8_t y, const char *value, uint8_t focused) {
    ui_print_at(0u, (uint8_t)(y - 1u), "+------------------+");
    ui_fill_attr(1u, y, 18u, 1u, focused ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_print_at(0u, y, "|                  |");
    ui_print_at(1u, y, focused ? ">" : " ");
    ui_print_at(3u, y, value);
    ui_print_at(0u, (uint8_t)(y + 1u), "+------------------+");
}

static void draw_unit_row(const OnboardingState *state) {
    ui_print_at(0u, 3u, "+------------------+");
    ui_fill_attr(1u, 4u, 8u, 1u, state->data->units == UNITS_METRIC ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_fill_attr(10u, 4u, 9u, 1u, state->data->units == UNITS_IMPERIAL ? UI_PAL_SELECTED : UI_PAL_PANEL);
    ui_print_at(0u, 4u, "|        |         |");
    ui_print_at(state->data->units == UNITS_METRIC ? 1u : 10u, 4u, ">");
    ui_print_at(2u, 4u, "METRIC");
    ui_print_at(11u, 4u, "IMP");
    ui_print_at(0u, 5u, "+------------------+");
}

static void draw_welcome(const OnboardingState *state) {
    ui_clear();

    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_at(1u, 0u, "[#][][]");
    ui_print_at(8u, 0u, "LET'S START");

    ui_print_at(0u, 2u, state->selected == 0u ? ">UNIT SYSTEM" : " UNIT SYSTEM");
    draw_unit_row(state);

    ui_print_at(0u, 7u, state->selected == 1u ? ">BIOLOGICAL SEX" : " BIOLOGICAL SEX");
    draw_box_row(9u, gender_label(state->data->gender), state->selected == 1u);

    ui_print_at(0u, 11u, state->selected == 2u ? ">ACTIVITY LEVEL" : " ACTIVITY LEVEL");
    draw_box_row(13u, activity_label(state->data->activity_level), state->selected == 2u);

    ui_print_center(15u, "UP/DN FIELD  L/R SET");
    ui_footer("", "A/ST NEXT");
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

static void draw_number_screen(const OnboardingState *state) {
    char value[16];

    if (state->step == STEP_AGE) {
        sprintf(value, "%u YEARS", state->data->age);
        ui_draw_value_screen("AGE", "YOUR AGE", value, "UP/DOWN CHANGE");
    } else if (state->step == STEP_HEIGHT) {
        format_height(state, value);
        ui_draw_value_screen("HEIGHT", "YOUR HEIGHT", value, "UP/DOWN CHANGE");
    } else if (state->step == STEP_WEIGHT) {
        format_weight(state, value);
        ui_draw_value_screen("WEIGHT", "YOUR WEIGHT", value, "UP/DOWN CHANGE");
    }
}

static void draw_review(const OnboardingState *state) {
    uint8_t i;
    char row[20];

    ui_title("REVIEW");
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

    ui_footer("B BACK", "A/ST OK");
}

static void draw_edit_screen(const OnboardingState *state) {
    char value[16];

    switch (state->step) {
        case STEP_EDIT_CALORIES:
            sprintf(value, "%u KCAL", state->data->calorie_goal);
            ui_draw_value_screen("EDIT CAL", "CALORIES", value, "UP/DN 10");
            break;
        case STEP_EDIT_PROTEIN:
            sprintf(value, "%u G", state->data->protein_goal);
            ui_draw_value_screen("EDIT PRO", "PROTEIN", value, "UP/DN 1");
            break;
        case STEP_EDIT_CARBS:
            sprintf(value, "%u G", state->data->carbs_goal);
            ui_draw_value_screen("EDIT CARB", "CARBS", value, "UP/DN 1");
            break;
        case STEP_EDIT_FAT:
            sprintf(value, "%u G", state->data->fat_goal);
            ui_draw_value_screen("EDIT FAT", "FAT", value, "UP/DN 1");
            break;
        case STEP_EDIT_FIBER:
            sprintf(value, "%u G", state->data->fiber_goal);
            ui_draw_value_screen("EDIT FIBER", "FIBER", value, "UP/DN 1");
            break;
        default:
            break;
    }
}

static void render_step(const OnboardingState *state) {
    switch (state->step) {
        case STEP_WELCOME:
            draw_welcome(state);
            break;
        case STEP_AGE:
        case STEP_HEIGHT:
        case STEP_WEIGHT:
            draw_number_screen(state);
            break;
        case STEP_ACTIVITY:
            ui_draw_menu("ACTIVITY", activity_options, 5u, state->selected);
            break;
        case STEP_EXPERIENCE:
            ui_draw_menu("EXPERIENCE", experience_options, 3u, state->selected);
            break;
        case STEP_FITNESS:
            ui_draw_menu("FOCUS", fitness_options, 4u, state->selected);
            break;
        case STEP_WEIGHT_GOAL:
            ui_draw_menu("GOAL", weight_goal_options, 3u, state->selected);
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

static uint16_t add_clamped_u16(uint16_t value, uint16_t amount, uint16_t max) {
    if (value > (uint16_t)(max - amount)) return max;
    return (uint16_t)(value + amount);
}

static uint16_t sub_clamped_u16(uint16_t value, uint16_t amount, uint16_t min) {
    if (value < (uint16_t)(min + amount)) return min;
    return (uint16_t)(value - amount);
}

static uint8_t add_clamped_u8(uint8_t value, uint8_t amount, uint8_t max) {
    if (value > (uint8_t)(max - amount)) return max;
    return (uint8_t)(value + amount);
}

static uint8_t sub_clamped_u8(uint8_t value, uint8_t amount, uint8_t min) {
    if (value < (uint8_t)(min + amount)) return min;
    return (uint8_t)(value - amount);
}

static void spinner_input(OnboardingState *state, const InputState *input) {
    if (state->step == STEP_AGE) {
        if (input_pressed(input, J_UP)) state->data->age = add_clamped_u8(state->data->age, 1u, AGE_MAX);
        if (input_pressed(input, J_DOWN)) state->data->age = sub_clamped_u8(state->data->age, 1u, AGE_MIN);
        if (input_pressed(input, J_RIGHT)) state->data->age = add_clamped_u8(state->data->age, 10u, AGE_MAX);
        if (input_pressed(input, J_LEFT)) state->data->age = sub_clamped_u8(state->data->age, 10u, AGE_MIN);
    } else if (state->step == STEP_HEIGHT) {
        if (state->data->units == UNITS_IMPERIAL) {
            if (input_pressed(input, J_UP)) state->height_inches = add_clamped_u8(state->height_inches, 1u, HEIGHT_IN_MAX);
            if (input_pressed(input, J_DOWN)) state->height_inches = sub_clamped_u8(state->height_inches, 1u, HEIGHT_IN_MIN);
            if (input_pressed(input, J_RIGHT)) state->height_inches = add_clamped_u8(state->height_inches, 12u, HEIGHT_IN_MAX);
            if (input_pressed(input, J_LEFT)) state->height_inches = sub_clamped_u8(state->height_inches, 12u, HEIGHT_IN_MIN);
            state->data->height_cm = inches_to_cm(state->height_inches);
        } else {
            if (input_pressed(input, J_UP)) state->data->height_cm = add_clamped_u16(state->data->height_cm, 1u, HEIGHT_CM_MAX);
            if (input_pressed(input, J_DOWN)) state->data->height_cm = sub_clamped_u16(state->data->height_cm, 1u, HEIGHT_CM_MIN);
            if (input_pressed(input, J_RIGHT)) state->data->height_cm = add_clamped_u16(state->data->height_cm, 10u, HEIGHT_CM_MAX);
            if (input_pressed(input, J_LEFT)) state->data->height_cm = sub_clamped_u16(state->data->height_cm, 10u, HEIGHT_CM_MIN);
        }
    } else if (state->step == STEP_WEIGHT) {
        if (state->data->units == UNITS_IMPERIAL) {
            if (input_pressed(input, J_UP)) state->weight_lbs = add_clamped_u16(state->weight_lbs, 1u, WEIGHT_LB_MAX);
            if (input_pressed(input, J_DOWN)) state->weight_lbs = sub_clamped_u16(state->weight_lbs, 1u, WEIGHT_LB_MIN);
            if (input_pressed(input, J_RIGHT)) state->weight_lbs = add_clamped_u16(state->weight_lbs, 10u, WEIGHT_LB_MAX);
            if (input_pressed(input, J_LEFT)) state->weight_lbs = sub_clamped_u16(state->weight_lbs, 10u, WEIGHT_LB_MIN);
            state->data->weight_kg_tenths = lbs_to_kg_tenths(state->weight_lbs);
        } else {
            if (input_pressed(input, J_UP)) state->data->weight_kg_tenths = add_clamped_u16(state->data->weight_kg_tenths, 5u, WEIGHT_KG_TENTHS_MAX);
            if (input_pressed(input, J_DOWN)) state->data->weight_kg_tenths = sub_clamped_u16(state->data->weight_kg_tenths, 5u, WEIGHT_KG_TENTHS_MIN);
            if (input_pressed(input, J_RIGHT)) state->data->weight_kg_tenths = add_clamped_u16(state->data->weight_kg_tenths, 50u, WEIGHT_KG_TENTHS_MAX);
            if (input_pressed(input, J_LEFT)) state->data->weight_kg_tenths = sub_clamped_u16(state->data->weight_kg_tenths, 50u, WEIGHT_KG_TENTHS_MIN);
        }
    }

    if (input_pressed(input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) {
        state->dirty = 1u;
    }
}

static void edit_goal_input(OnboardingState *state, const InputState *input) {
    uint16_t *value = 0;
    uint16_t min = 0u;
    uint16_t max = MACRO_MAX;
    uint16_t small = 1u;
    uint16_t large = 10u;

    switch (state->step) {
        case STEP_EDIT_CALORIES:
            value = &state->data->calorie_goal;
            min = CAL_MIN;
            max = CAL_MAX;
            small = 10u;
            large = 100u;
            break;
        case STEP_EDIT_PROTEIN:
            value = &state->data->protein_goal;
            break;
        case STEP_EDIT_CARBS:
            value = &state->data->carbs_goal;
            break;
        case STEP_EDIT_FAT:
            value = &state->data->fat_goal;
            break;
        case STEP_EDIT_FIBER:
            value = &state->data->fiber_goal;
            max = FIBER_MAX;
            break;
        default:
            return;
    }

    if (input_pressed(input, J_UP)) *value = add_clamped_u16(*value, small, max);
    if (input_pressed(input, J_DOWN)) *value = sub_clamped_u16(*value, small, min);
    if (input_pressed(input, J_RIGHT)) *value = add_clamped_u16(*value, large, max);
    if (input_pressed(input, J_LEFT)) *value = sub_clamped_u16(*value, large, min);

    if (input_pressed(input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) {
        state->dirty = 1u;
    }
}

static void handle_accept(OnboardingState *state) {
    switch (state->step) {
        case STEP_WELCOME:
            state->height_inches = cm_to_inches(state->data->height_cm);
            state->weight_lbs = kg_tenths_to_lbs(state->data->weight_kg_tenths);
            enter_step(state, STEP_AGE);
            break;
        case STEP_AGE:
            enter_step(state, STEP_HEIGHT);
            break;
        case STEP_HEIGHT:
            enter_step(state, STEP_WEIGHT);
            break;
        case STEP_WEIGHT:
            enter_step(state, STEP_EXPERIENCE);
            break;
        case STEP_ACTIVITY:
            state->data->activity_level = (uint8_t)(state->selected + 1u);
            enter_step(state, STEP_EXPERIENCE);
            break;
        case STEP_EXPERIENCE:
            state->data->lifting_experience = state->selected;
            enter_step(state, STEP_FITNESS);
            break;
        case STEP_FITNESS:
            state->data->fitness_focus = state->selected;
            enter_step(state, STEP_WEIGHT_GOAL);
            break;
        case STEP_WEIGHT_GOAL:
            state->data->weight_goal = state->selected;
            nutrition_apply_generated_goals(state->data);
            enter_step(state, STEP_REVIEW);
            break;
        case STEP_REVIEW:
            if (state->selected == 0u) {
                storage_save(state->data);
                state->done = 1u;
            } else {
                enter_step(state, STEP_EDIT_CALORIES);
            }
            break;
        case STEP_EDIT_CALORIES:
            enter_step(state, STEP_EDIT_PROTEIN);
            break;
        case STEP_EDIT_PROTEIN:
            enter_step(state, STEP_EDIT_CARBS);
            break;
        case STEP_EDIT_CARBS:
            enter_step(state, STEP_EDIT_FAT);
            break;
        case STEP_EDIT_FAT:
            enter_step(state, STEP_EDIT_FIBER);
            break;
        case STEP_EDIT_FIBER:
            enter_step(state, STEP_REVIEW);
            break;
    }
}

static void handle_input(OnboardingState *state, const InputState *input) {
    if (input_pressed(input, J_B)) {
        step_back(state);
        return;
    }

    switch (state->step) {
        case STEP_UNITS:
        case STEP_GENDER:
            break;
        case STEP_WELCOME:
            setup_input(state, input);
            break;
        case STEP_ACTIVITY:
            menu_input(state, input, 5u);
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

void onboarding_run(SaveData *data) {
    OnboardingState state;
    InputState input;

    storage_init_defaults(data);
    nutrition_apply_generated_goals(data);

    state.data = data;
    state.step = STEP_WELCOME;
    state.selected = 0u;
    state.height_inches = cm_to_inches(data->height_cm);
    state.weight_lbs = kg_tenths_to_lbs(data->weight_kg_tenths);
    state.dirty = 1u;
    state.done = 0u;

    input_init(&input);
    while (!state.done) {
        if (state.dirty) {
            render_step(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);
        handle_input(&state, &input);
    }
}
