#pragma bank 1

#include "settings.h"

#include "copies.h"
#include "custom_foods.h"
#include "foodlog.h"
#include "input.h"
#include "metrics.h"
#include "onboarding.h"
#include "profile.h"
#include "spinner.h"
#include "ui_text.h"
#include "utils.h"
#include "weight_units.h"
#include "workoutlog.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

/* Spinner/validation bounds (mirrors the onboarding constants). */
#define AGE_MIN       13u
#define AGE_MAX       99u
#define HEIGHT_IN_MIN 47u
#define HEIGHT_IN_MAX 91u
#define CAL_MIN       800u
#define CAL_MAX       6000u
#define MACRO_MAX     999u
#define FIBER_MAX     99u

/*
 * Field order in the scrollable list. Profile fields first, macro targets last,
 * matching the order the onboarding flow collects them.
 */
typedef enum SettingsField {
    SET_UNITS,
    SET_SEX,
    SET_AGE,
    SET_HEIGHT,
    SET_WEIGHT,
    SET_ACTIVITY,
    SET_EXPERIENCE,
    SET_FOCUS,
    SET_GOAL,
    SET_CALORIES,
    SET_PROTEIN,
    SET_CARBS,
    SET_FAT,
    SET_FIBER,
    SET_FIELD_COUNT
} SettingsField;

/* Visible field rows (4..15); the list scrolls when SET_FIELD_COUNT exceeds this. */
#define FIRST_ROW 4u
#define VIS_ROWS  12u

typedef struct SettingsState {
    SaveData *data;
    uint8_t   field;        /* currently focused SettingsField */
    uint8_t   top;          /* first visible field (scroll offset) */
    uint8_t   height_inches;/* imperial working value for SET_HEIGHT */
    uint16_t  weight_lbs;   /* imperial working value for SET_WEIGHT */
    uint8_t   dirty;
} SettingsState;

static const char *experience_options[] = { STR_BEGINNER, STR_INTERMEDIATE, STR_ADVANCED };
static const char *fitness_options[]    = { STR_MUSCLE, STR_STRENGTH, STR_ENDURANCE, STR_GENERAL };
static const char *weight_goal_options[] = { STR_LOSE, STR_MAINTAIN, STR_GAIN };

static uint8_t cm_to_inches(uint16_t cm) {
    uint16_t inches = (uint16_t)((((uint32_t)cm * 100u) + 127u) / 254u);
    return clamp_u8((uint8_t)inches, HEIGHT_IN_MIN, HEIGHT_IN_MAX);
}

static uint16_t inches_to_cm(uint8_t inches) {
    return (uint16_t)((((uint16_t)inches * 254u) + 50u) / 100u);
}

static const char *gender_label(uint8_t gender) {
    if (gender == GENDER_FEMALE) return STR_FEMALE;
    if (gender == GENDER_OTHER) return STR_OTHER;
    return STR_MALE;
}

/* Short activity label so the value fits beside the row label (V.ACTIVE vs VERY ACTIVE). */
static const char *activity_label(uint8_t activity_level) {
    switch (activity_level) {
        case 1u: return STR_ACTIVITY_LOW;
        case 2u: return STR_ACTIVITY_LIGHT;
        case 3u: return STR_ACTIVITY_MODERATE;
        case 4u: return STR_ACTIVITY_ACTIVE;
        case 5u: return STR_ACT_VERY;
        default: return STR_ACTIVITY_LIGHT;
    }
}

/* Short row label shown on the left of each field. */
static const char *field_label(uint8_t field) {
    switch (field) {
        case SET_UNITS:      return STR_UNITS;
        case SET_SEX:        return STR_SEX;
        case SET_AGE:        return STR_AGE;
        case SET_HEIGHT:     return STR_HEIGHT;
        case SET_WEIGHT:     return STR_WEIGHT;
        case SET_ACTIVITY:   return STR_ACTIVITY;
        case SET_EXPERIENCE: return STR_EXP;
        case SET_FOCUS:      return STR_FOCUS;
        case SET_GOAL:       return STR_GOAL;
        case SET_CALORIES:   return STR_CALORIES;
        case SET_PROTEIN:    return STR_PROTEIN;
        case SET_CARBS:      return STR_CARBS;
        case SET_FAT:        return STR_FAT;
        case SET_FIBER:      return STR_FIBER;
        default:             return "";
    }
}

/* 1 for fields edited with the spinner; 0 for fields that cycle through options. */
static uint8_t is_numeric(uint8_t field) {
    switch (field) {
        case SET_AGE:
        case SET_HEIGHT:
        case SET_WEIGHT:
        case SET_CALORIES:
        case SET_PROTEIN:
        case SET_CARBS:
        case SET_FAT:
        case SET_FIBER:
            return 1u;
        default:
            return 0u;
    }
}

static void format_value(const SettingsState *s, char *buf) {
    const SaveData *d = s->data;

    switch (s->field) {
        case SET_UNITS:
            strcpy(buf, d->units == UNITS_IMPERIAL ? STR_IMPERIAL : STR_METRIC);
            break;
        case SET_SEX:
            strcpy(buf, gender_label(d->gender));
            break;
        case SET_AGE:
            sprintf(buf, "%u", (unsigned int)d->age);
            break;
        case SET_HEIGHT:
            if (d->units == UNITS_IMPERIAL) {
                sprintf(buf, "%u'%u\"", (unsigned int)(s->height_inches / 12u),
                        (unsigned int)(s->height_inches % 12u));
            } else {
                sprintf(buf, "%u CM", (unsigned int)d->height_cm);
            }
            break;
        case SET_WEIGHT:
            if (d->units == UNITS_IMPERIAL) {
                sprintf(buf, "%u LB", (unsigned int)s->weight_lbs);
            } else {
                sprintf(buf, "%u.%u KG", (unsigned int)(d->weight_kg_tenths / 10u),
                        (unsigned int)(d->weight_kg_tenths % 10u));
            }
            break;
        case SET_ACTIVITY:
            strcpy(buf, activity_label(d->activity_level));
            break;
        case SET_EXPERIENCE:
            strcpy(buf, experience_options[d->lifting_experience]);
            break;
        case SET_FOCUS:
            strcpy(buf, fitness_options[d->fitness_focus]);
            break;
        case SET_GOAL:
            strcpy(buf, weight_goal_options[d->weight_goal]);
            break;
        case SET_CALORIES:
            /* No "KCAL" suffix here: the row label already names the field and
             * the long value would otherwise collide with it. */
            sprintf(buf, "%u", (unsigned int)d->calorie_goal);
            break;
        case SET_PROTEIN:
            sprintf(buf, "%uG", (unsigned int)d->protein_goal);
            break;
        case SET_CARBS:
            sprintf(buf, "%uG", (unsigned int)d->carbs_goal);
            break;
        case SET_FAT:
            sprintf(buf, "%uG", (unsigned int)d->fat_goal);
            break;
        case SET_FIBER:
            sprintf(buf, "%uG", (unsigned int)d->fiber_goal);
            break;
        default:
            buf[0] = '\0';
            break;
    }
}

/* Cycle an enumerated field by one step (going_right increments, else decrements). */
static void cycle_field(SettingsState *s, uint8_t going_right) {
    SaveData *d = s->data;

    switch (s->field) {
        case SET_UNITS:
            d->units = d->units == UNITS_METRIC ? UNITS_IMPERIAL : UNITS_METRIC;
            s->height_inches = cm_to_inches(d->height_cm);
            s->weight_lbs = kg_tenths_to_lbs(d->weight_kg_tenths);
            break;
        case SET_SEX:
            if (going_right) {
                d->gender = (uint8_t)((d->gender + 1u) % 3u);
            } else {
                d->gender = d->gender == GENDER_MALE ? GENDER_OTHER : (uint8_t)(d->gender - 1u);
            }
            break;
        case SET_ACTIVITY:
            if (going_right) {
                d->activity_level = d->activity_level >= 5u ? 1u : (uint8_t)(d->activity_level + 1u);
            } else {
                d->activity_level = d->activity_level <= 1u ? 5u : (uint8_t)(d->activity_level - 1u);
            }
            break;
        case SET_EXPERIENCE:
            if (going_right) {
                d->lifting_experience = (uint8_t)((d->lifting_experience + 1u) % 3u);
            } else {
                d->lifting_experience = d->lifting_experience == 0u ? 2u : (uint8_t)(d->lifting_experience - 1u);
            }
            break;
        case SET_FOCUS:
            if (going_right) {
                d->fitness_focus = (uint8_t)((d->fitness_focus + 1u) % 4u);
            } else {
                d->fitness_focus = d->fitness_focus == 0u ? 3u : (uint8_t)(d->fitness_focus - 1u);
            }
            break;
        case SET_GOAL:
            if (going_right) {
                d->weight_goal = (uint8_t)((d->weight_goal + 1u) % 3u);
            } else {
                d->weight_goal = d->weight_goal == 0u ? 2u : (uint8_t)(d->weight_goal - 1u);
            }
            break;
        default:
            break;
    }
}

/*
 * Apply the four-direction spinner to the focused numeric field.
 * In the list only LEFT/RIGHT reach this (UP/DOWN scroll), giving a coarse
 * step; the focused editor also passes UP/DOWN for a fine step.
 */
static void spin_field(SettingsState *s, const InputState *in) {
    SaveData *d = s->data;

    switch (s->field) {
        case SET_AGE:
            d->age = spinner_u8(in, d->age, 1u, 5u, AGE_MIN, AGE_MAX);
            break;
        case SET_HEIGHT:
            if (d->units == UNITS_IMPERIAL) {
                s->height_inches = spinner_u8(in, s->height_inches, 1u, 12u, HEIGHT_IN_MIN, HEIGHT_IN_MAX);
                d->height_cm = inches_to_cm(s->height_inches);
            } else {
                d->height_cm = spinner_u16(in, d->height_cm, 1u, 10u, DB_HEIGHT_CM_MIN, DB_HEIGHT_CM_MAX);
            }
            break;
        case SET_WEIGHT:
            if (d->units == UNITS_IMPERIAL) {
                s->weight_lbs = spinner_u16(in, s->weight_lbs, 1u, 10u, WEIGHT_LB_MIN, WEIGHT_LB_MAX);
                d->weight_kg_tenths = lbs_to_kg_tenths(s->weight_lbs);
            } else {
                d->weight_kg_tenths = spinner_u16(in, d->weight_kg_tenths, 5u, 50u,
                                                  DB_WEIGHT_KG_TENTHS_MIN, DB_WEIGHT_KG_TENTHS_MAX);
            }
            break;
        case SET_CALORIES:
            d->calorie_goal = spinner_u16(in, d->calorie_goal, 10u, 100u, CAL_MIN, CAL_MAX);
            break;
        case SET_PROTEIN:
            d->protein_goal = spinner_u16(in, d->protein_goal, 1u, 10u, 0u, MACRO_MAX);
            break;
        case SET_CARBS:
            d->carbs_goal = spinner_u16(in, d->carbs_goal, 1u, 10u, 0u, MACRO_MAX);
            break;
        case SET_FAT:
            d->fat_goal = spinner_u16(in, d->fat_goal, 1u, 10u, 0u, MACRO_MAX);
            break;
        case SET_FIBER:
            d->fiber_goal = spinner_u16(in, d->fiber_goal, 1u, 10u, 0u, FIBER_MAX);
            break;
        default:
            break;
    }
}

static void draw_field_row(uint8_t row, const char *label, const char *value, uint8_t focused) {
    uint8_t vlen = (uint8_t)strlen(value);
    uint8_t vx = vlen < 18u ? (uint8_t)(19u - vlen) : 1u;

    ui_fill_attr(0u, row, 20u, 1u, focused ? UI_PAL_SELECTED : UI_PAL_NORMAL);
    ui_print_at(1u, row, focused ? ">" : " ");
    ui_print_at(3u, row, label);
    ui_print_at(vx, row, value);
}

static void settings_draw(const SettingsState *s) {
    uint8_t i;
    char value[16];
    SettingsState row_state;

    /* format_value reads the focused field, so reuse the struct per row. */
    row_state = *s;

    ui_title(STR_SETTINGS);

    for (i = 0u; i != VIS_ROWS; ++i) {
        uint8_t field = (uint8_t)(s->top + i);
        if (field >= SET_FIELD_COUNT) break;

        row_state.field = field;
        format_value(&row_state, value);
        draw_field_row((uint8_t)(FIRST_ROW + i), field_label(field), value,
                       (uint8_t)(field == s->field));
    }

    ui_footer(STR_FOOTER_BACK, STR_HINT_LR_EDIT);
}

/* Keep the focused field inside the visible window. */
static void clamp_scroll(SettingsState *s) {
    if (s->field < s->top) {
        s->top = s->field;
    } else if (s->field >= (uint8_t)(s->top + VIS_ROWS)) {
        s->top = (uint8_t)(s->field - VIS_ROWS + 1u);
    }
}

/* Focused spinner for a single numeric field: fine UP/DOWN + fast LEFT/RIGHT. */
static void settings_edit_numeric(SettingsState *s) {
    InputState input;
    char value[16];

    format_value(s, value);
    ui_draw_value_screen(field_label(s->field), field_label(s->field), value, STR_HINT_CHANGE);

    input_init(&input);
    while (1) {
        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B | J_A | J_START)) {
            db_save(s->data);
            return;
        }

        if (input_pressed(&input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) {
            spin_field(s, &input);
            format_value(s, value);
            ui_clear_row(8u);
            ui_print_center(8u, value);
            ui_present();
        }
    }
}

void settings_show(SaveData *data) BANKED {
    SettingsState state;
    InputState input;

    state.data = data;
    state.field = 0u;
    state.top = 0u;
    state.height_inches = cm_to_inches(data->height_cm);
    state.weight_lbs = kg_tenths_to_lbs(data->weight_kg_tenths);
    state.dirty = 1u;

    input_init(&input);
    while (1) {
        if (state.dirty) {
            clamp_scroll(&state);
            settings_draw(&state);
            state.dirty = 0u;
        }

        wait_vbl_done();
        input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_UP)) {
            state.field = state.field == 0u
                ? (uint8_t)(SET_FIELD_COUNT - 1u) : (uint8_t)(state.field - 1u);
            state.dirty = 1u;
            continue;
        }

        if (input_pressed(&input, J_DOWN)) {
            state.field = (uint8_t)((state.field + 1u) % SET_FIELD_COUNT);
            state.dirty = 1u;
            continue;
        }

        if (is_numeric(state.field)) {
            if (input_pressed(&input, J_LEFT | J_RIGHT)) {
                spin_field(&state, &input);
                db_save(data);
                state.dirty = 1u;
            } else if (input_pressed(&input, J_A | J_START)) {
                settings_edit_numeric(&state);
                state.dirty = 1u;
            }
        } else {
            if (input_pressed(&input, J_RIGHT)) {
                cycle_field(&state, 1u);
                db_save(data);
                state.dirty = 1u;
            } else if (input_pressed(&input, J_LEFT)) {
                cycle_field(&state, 0u);
                db_save(data);
                state.dirty = 1u;
            }
        }
    }
}

/* Short "what is this" blurb + the link to the full app. Waits for B/A/Start. */
static void about_show(void) {
    InputState input;

    ui_title(STR_ABOUT);
    ui_print_center(5u, STR_ABOUT_L1);
    ui_print_center(6u, STR_ABOUT_L2);
    ui_print_center(7u, STR_ABOUT_L3);
    ui_print_center(9u, STR_ABOUT_L4);
    ui_print_center(10u, STR_ABOUT_L5);
    ui_print_center(12u, STR_ABOUT_URL);
    ui_footer(STR_FOOTER_BACK, "");

    input_init(&input);
    while (1) {
        wait_vbl_done();
        input_update(&input);
        if (input_pressed(&input, J_B | J_A | J_START)) return;
    }
}

uint8_t settings_menu(SaveData *data) BANKED {
    const char *options[3];
    uint8_t choice;

    options[0] = STR_SETTINGS;
    options[1] = STR_ABOUT;
    options[2] = STR_RESET_DATA;

    choice = ui_menu_select(STR_MENU, options, 3u);

    if (choice == 0u) {
        settings_show(data);
    } else if (choice == 1u) {
        about_show();
    } else if (choice == 2u) {
        if (ui_confirm(STR_RESET_DATA, STR_RESET_DATA_Q)) {
            db_erase();
            foodlog_erase();
            workoutlog_erase();
            metrics_erase();
            custom_foods_erase();
            /* SRAM was just erased, so there is no pre-seeded RTC date to honor. */
            onboarding_run(data, 0u);
            return 1u;
        }
    }

    return 0u;
}
