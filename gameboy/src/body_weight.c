#pragma bank 1

#include "body_weight.h"

#include "copies.h"
#include "input.h"
#include "metrics.h"
#include "nutrition_date.h"
#include "rtc.h"
#include "spinner.h"
#include "ui_text.h"
#include "utils.h"
#include "weight_units.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

/*
 * Trend plot: a left-to-right vertical column chart filling rows 10-15.
 * Time runs along the x-axis (oldest weigh-in on the left, newest on the
 * right); each weigh-in is a column whose height encodes its weight, min/max
 * normalised over the visible window. Drawn with whole-tile palette fills (the
 * same mechanism as ui_draw_bar) so it stays inside the console shadow buffer.
 *
 *   plot area : columns 1..18 (TREND_PLOT_W wide), rows 10..15 (TREND_ROWS tall)
 *   bars      : TREND_BARS columns of TREND_BAR_W tiles, separated by a 1-tile gap
 *               ((TREND_BAR_W + TREND_BAR_GAP) * TREND_BARS == TREND_PLOT_W)
 */
#define TREND_TOP     10u
#define TREND_ROWS     6u
#define TREND_BASE    15u  /* bottom row of the plot */
#define TREND_LEFT     1u
#define TREND_PLOT_W  18u
#define TREND_BAR_W    2u
#define TREND_BAR_GAP  1u
#define TREND_BARS     6u

/* Format a metric weight (kg tenths) into the user's unit system. */
static void bw_format_weight(uint8_t units, uint16_t kg_tenths, char *buf) {
    if (units == UNITS_IMPERIAL) {
        sprintf(buf, "%u LB", (unsigned int)kg_tenths_to_lbs(kg_tenths));
    } else {
        sprintf(buf, "%u.%u KG", (unsigned int)(kg_tenths / 10u), (unsigned int)(kg_tenths % 10u));
    }
}

/*
 * Column height in whole tiles (1..TREND_ROWS) for weight `w`. The bottom tile
 * is reserved as a baseline so the lightest weigh-in stays visible; the rest of
 * the range spreads the variation over the remaining rows. A flat window (all
 * weigh-ins equal) renders at mid height.
 */
static uint8_t bw_bar_height(uint16_t w, uint16_t mn, uint16_t span) {
    if (span == 0u) return (uint8_t)((TREND_ROWS + 1u) / 2u);
    return (uint8_t)(1u + ((uint32_t)(w - mn) * (TREND_ROWS - 1u) + (span >> 1u)) / span);
}

static void bw_draw_trend(uint16_t count, uint16_t mn, uint16_t mx) {
    uint16_t shown = count < TREND_BARS ? count : TREND_BARS;
    uint16_t start = (uint16_t)(count - shown);  /* oldest record in the window */
    uint16_t span  = (uint16_t)(mx - mn);
    uint16_t i;
    uint16_t day_num, w;
    uint8_t  h, x, top;

    /* Pale card backdrop behind the whole plot (also covers unused bar slots). */
    ui_fill_attr(TREND_LEFT, TREND_TOP, TREND_PLOT_W, TREND_ROWS, UI_PAL_PANEL);

    for (i = 0u; i != shown; ++i) {
        if (!metrics_get((uint16_t)(start + i), &day_num, &w)) continue;
        h   = bw_bar_height(w, mn, span);
        x   = (uint8_t)(TREND_LEFT + i * (TREND_BAR_W + TREND_BAR_GAP));
        top = (uint8_t)(TREND_BASE + 1u - h);  /* topmost filled row of the column */
        ui_fill_attr(x, top, TREND_BAR_W, h, UI_PAL_SELECTED);
    }
}

static void bw_draw(const SaveData *data, const CalDate *today) {
    uint16_t count = metrics_count();
    uint16_t day_num, latest, mn, mx;
    char buf[22];
    char date_buf[9];

    cal_format(today, date_buf);

    ui_clear();
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);
    ui_print_at(0u, 1u, STR_BODY_WEIGHT);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(date_buf)), 1u, date_buf);
    ui_print_at(0u, 2u, STR_DIVIDER);

    if (count == 0u) {
        ui_print_center(9u, STR_NO_DATA);
        ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_MENU);
        return;
    }

    metrics_latest(&day_num, &latest);
    metrics_min_max(&mn, &mx);

    ui_print_at(1u, 3u, STR_CURRENT);
    bw_format_weight(data->units, latest, buf);
    ui_print_at(1u, 4u, buf);
    ui_print_at(0u, 5u, STR_DIVIDER);

    ui_print_at(1u, 6u, STR_MIN);
    ui_print_at(11u, 6u, STR_MAX);
    bw_format_weight(data->units, mn, buf);
    ui_print_at(1u, 7u, buf);
    bw_format_weight(data->units, mx, buf);
    ui_print_at(11u, 7u, buf);
    ui_print_at(0u, 8u, STR_DIVIDER);

    ui_print_at(1u, 9u, STR_TREND);
    bw_draw_trend(count, mn, mx);

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_SEL_MENU);
}

/*
 * Digit-spinner entry for a weight on `day_num`. Returns 1 if a value was saved.
 * When `is_today` is set the saved value also becomes the profile's current
 * weight; logging a past date never overwrites it.
 */
static uint8_t bw_log_entry(SaveData *data, uint16_t day_num, uint8_t is_today) {
    InputState input;
    uint16_t kg_tenths;
    uint16_t lbs;
    uint8_t  imperial = (uint8_t)(data->units == UNITS_IMPERIAL);
    uint16_t prev_day;
    char value[16];

    /* Seed from the most recent weigh-in, falling back to the profile weight. */
    if (metrics_latest(&prev_day, &kg_tenths) == 0u) {
        kg_tenths = data->weight_kg_tenths;
    }
    lbs = kg_tenths_to_lbs(kg_tenths);

    bw_format_weight(data->units, kg_tenths, value);
    ui_draw_value_screen(STR_LOG_WEIGHT, STR_YOUR_WEIGHT, value, STR_HINT_CHANGE);

    input_init(&input);
    while (1) {
        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return 0u;

        if (input_pressed(&input, J_A | J_START)) {
            metrics_set_for_day(day_num, kg_tenths);
            if (is_today) {
                data->weight_kg_tenths = kg_tenths;
                db_save(data);
            }
            return 1u;
        }

        if (input_pressed(&input, J_UP | J_DOWN | J_LEFT | J_RIGHT)) {
            if (imperial) {
                lbs = spinner_u16(&input, lbs, 1u, 10u, WEIGHT_LB_MIN, WEIGHT_LB_MAX);
                kg_tenths = lbs_to_kg_tenths(lbs);
            } else {
                kg_tenths = spinner_u16(&input, kg_tenths, 5u, 50u,
                                        DB_WEIGHT_KG_TENTHS_MIN, DB_WEIGHT_KG_TENTHS_MAX);
            }

            bw_format_weight(data->units, kg_tenths, value);
            ui_clear_row(8u);
            ui_print_center(8u, value);
            ui_present();
        }
    }
}

typedef enum {
    BW_ACTION_NONE = 0u,
    BW_ACTION_NEW_ENTRY = 1u,
    BW_ACTION_HOME = 2u,
} BodyWeightAction;

/* SELECT menu: add an entry for any date, or go back to the home screen. */
static BodyWeightAction bw_action_menu(void) {
    const char *options[2];
    uint8_t selected;

    options[0] = STR_NEW_ENTRY;
    options[1] = STR_HOME;

    selected = ui_menu_select(STR_BODY_WEIGHT, options, 2u);
    if (selected == UI_MENU_CANCEL) return BW_ACTION_NONE;
    if (selected == 0u) return BW_ACTION_NEW_ENTRY;
    return BW_ACTION_HOME;
}

/* Pick a date (defaulting to today, capped at today), then log a weight for it. */
static void bw_new_entry(SaveData *data, CalDate today) {
    CalDate  pick = today;
    uint16_t today_day = cal_day_number(today);
    uint16_t pick_day;

    nutrition_date_picker(today, &pick);
    pick_day = cal_day_number(pick);
    bw_log_entry(data, pick_day, (uint8_t)(pick_day == today_day));
}

void body_weight_show(SaveData *data) BANKED {
    InputState input;
    CalDate today = cal_current_date(data);
    uint16_t day_num = cal_day_number(today);
    uint8_t  dirty = 1u;

    input_init(&input);
    while (1) {
        if (dirty) {
            bw_draw(data, &today);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_SELECT)) {
            BodyWeightAction action = bw_action_menu();
            if (action == BW_ACTION_HOME) return;
            if (action == BW_ACTION_NEW_ENTRY) bw_new_entry(data, today);
            dirty = 1u;
            continue;
        }

        /* A/Start stays a quick shortcut to log today's weight. */
        if (input_pressed(&input, J_A | J_START)) {
            bw_log_entry(data, day_num, 1u);
            dirty = 1u;
        }
    }
}
