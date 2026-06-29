#pragma bank 1

#include "progress.h"

#include "copies.h"
#include "exercise_db.h"
#include "exercises.h"
#include "foodlog.h"
#include "input.h"
#include "metrics.h"
#include "rtc.h"
#include "ui_text.h"
#include "weight_units.h"
#include "workoutlog.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

/*
 * ── Layout (20x18 tiles) ─────────────────────────────────────────────────
 *  Row 0   MUSCLOG GB                 header bar
 *  Row 1   PROGRESS            7D     screen label + active window
 *  Row 2   --------------------
 *  Row 3   <page title>
 *  Row 4   <stat line>
 *  Row 5   <stat line>
 *  Row 6   --------------------       (charts only)
 *  Row 7..15  plot area (PLOT_ROWS tall)  OR more summary rows
 *  Row 16  --------------------       footer divider
 *  Row 17  B BACK     <>PAGE ^vRNG    footer
 */
#define PLOT_LEFT 1u
#define PLOT_W 18u
#define PLOT_TOP 7u
#define PLOT_BASE 15u /* bottom row of the plot */
#define PLOT_ROWS 9u  /* rows 7..15 */
#define MAX_BARS 18u

/* Rolling windows offered by Up/Down. */
#define RANGE_SHORT 7u
#define RANGE_LONG 30u
#define MAX_DAYS 30u

/* Pages cycled with Left/Right. */
#define PAGE_SUMMARY 0u
#define PAGE_CAL 1u
#define PAGE_PRO 2u
#define PAGE_CARB 3u
#define PAGE_FAT 4u
#define PAGE_WEIGHT 5u
#define PAGE_COUNT 6u

/* Up to this many sets per workout are scanned for distinct muscle groups. */
#define SET_SCAN_CAP 32u

/* ── Aggregates, recomputed when entering the screen or changing the range ── */
static uint16_t day_cal[MAX_DAYS];  /* per-day kcal, index 0 = oldest day      */
static uint16_t day_pro[MAX_DAYS];  /* per-day protein g                       */
static uint16_t day_carb[MAX_DAYS]; /* per-day digestible carbs g              */
static uint16_t day_fat[MAX_DAYS];  /* per-day fat g                           */
static uint8_t agg_range;           /* RANGE_SHORT or RANGE_LONG               */
static uint8_t logged_days;         /* days in window with any food logged     */
static uint8_t muscles_hit;         /* distinct muscle groups hit (0..9)       */
static uint8_t workout_total;       /* workouts in the window                  */

static uint16_t weight_vals[MAX_DAYS]; /* weigh-ins (kg tenths) inside the window */
static uint8_t weight_count;           /* number collected                       */

static WorkoutLogSet set_buf[SET_SCAN_CAP];

/* ── Aggregation ─────────────────────────────────────────────────────────── */

static uint8_t popcount9(uint16_t mask) {
    uint8_t n = 0u;
    uint8_t i;
    for (i = 0u; i != EXERCISE_MUSCLE_GROUP_COUNT; ++i) {
        if (mask & (uint16_t)(1u << i)) ++n;
    }
    return n;
}

/* Sum the macros of every workout-set's muscle group across the window. */
static void progress_scan_workouts(uint16_t start_day, uint16_t end_day) {
    uint16_t mask = 0u;
    uint8_t count = workoutlog_count();
    uint8_t w, s, got;
    WorkoutLogSummary summary;
    ExerciseCache exercise;

    workout_total = 0u;
    for (w = 0u; w != count; ++w) {
        if (!workoutlog_get_summary(w, &summary)) continue;
        if (summary.day_num < start_day || summary.day_num > end_day) continue;

        ++workout_total;
        got = workoutlog_get_sets(w, set_buf, SET_SCAN_CAP);
        for (s = 0u; s != got; ++s) {
            ex_load(set_buf[s].exercise_idx, &exercise);
            if (exercise.muscle_group < EXERCISE_MUSCLE_GROUP_COUNT) {
                mask |= (uint16_t)(1u << exercise.muscle_group);
            }
        }
    }
    muscles_hit = popcount9(mask);
}

static void progress_collect_weight(uint16_t start_day, uint16_t end_day) {
    uint16_t total = metrics_count();
    uint16_t i, day_num, w;

    weight_count = 0u;
    for (i = 0u; i != total && weight_count != MAX_DAYS; ++i) {
        if (!metrics_get(i, &day_num, &w)) continue;
        if (day_num < start_day || day_num > end_day) continue;
        weight_vals[weight_count++] = w;
    }
}

static void progress_compute(const SaveData *data, uint8_t range) {
    CalDate today = cal_current_date(data);
    uint16_t end_day = cal_day_number(today);
    uint16_t start_day =
        (end_day >= (uint16_t)(range - 1u)) ? (uint16_t)(end_day - (range - 1u)) : 0u;
    uint16_t cal, pro, carb, fat, fib;
    uint8_t i;

    agg_range = range;
    logged_days = 0u;

    for (i = 0u; i != range; ++i) {
        foodlog_sum_day((uint16_t)(start_day + i), &cal, &pro, &carb, &fat, &fib);
        day_cal[i] = cal;
        day_pro[i] = pro;
        day_carb[i] = foodlog_digestible_carbs(carb, fib);
        day_fat[i] = fat;
        if (cal != 0u || pro != 0u || carb != 0u || fat != 0u) ++logged_days;
    }

    progress_scan_workouts(start_day, end_day);
    progress_collect_weight(start_day, end_day);
}

/* ── Small math helpers ──────────────────────────────────────────────────── */

/* Average of `vals[0..len)`, rounded; 0 when len is 0. */
static uint16_t avg_u16(const uint16_t *vals, uint8_t len) {
    uint32_t sum = 0u;
    uint8_t i;
    if (len == 0u) return 0u;
    for (i = 0u; i != len; ++i)
        sum += vals[i];
    return (uint16_t)((sum + (len >> 1u)) / len);
}

static uint16_t max_u16(const uint16_t *vals, uint8_t len) {
    uint16_t mx = 0u;
    uint8_t i;
    for (i = 0u; i != len; ++i) {
        if (vals[i] > mx) mx = vals[i];
    }
    return mx;
}

static uint16_t min_u16(const uint16_t *vals, uint8_t len) {
    uint16_t mn = 0xFFFFu;
    uint8_t i;

    if (len == 0u) return 0u;
    for (i = 0u; i != len; ++i) {
        if (vals[i] < mn) mn = vals[i];
    }
    return mn;
}

/* Round a raw step to a compact 1/2/5 * 10^n interval. */
static uint16_t nice_step_u16(uint16_t raw) {
    uint16_t pow10 = 1u;
    uint16_t scaled;

    if (raw <= 1u) return 1u;

    while (raw >= 10u) {
        raw /= 10u;
        if (pow10 <= (uint16_t)(65535u / 10u)) pow10 *= 10u;
    }

    scaled = raw * pow10;
    if (scaled == 0u) scaled = pow10;

    if (scaled <= pow10) return pow10;
    if (scaled <= (uint16_t)(2u * pow10)) return (uint16_t)(2u * pow10);
    if (scaled <= (uint16_t)(5u * pow10)) return (uint16_t)(5u * pow10);
    if (pow10 > (uint16_t)(65535u / 10u)) return 65535u;
    return (uint16_t)(10u * pow10);
}

static void chart_domain_for_values(const uint16_t *vals, uint8_t len, uint16_t *out_min,
                                    uint16_t *out_max) {
    uint16_t mn = min_u16(vals, len);
    uint16_t mx = max_u16(vals, len);
    uint16_t span, step, padded_max, floor_min, ceil_max;

    if (len == 0u || mx == 0u) {
        *out_min = 0u;
        *out_max = 0u;
        return;
    }

    if (mn == mx) {
        step = nice_step_u16((uint16_t)(mx / 4u));
        if (step == 0u) step = 1u;
        *out_min = (mn > step) ? (uint16_t)(mn - step) : 0u;
        *out_max = (mx > (uint16_t)(65535u - step)) ? 65535u : (uint16_t)(mx + step);
        return;
    }

    span = (uint16_t)(mx - mn);
    step = nice_step_u16((uint16_t)((span + 5u) / 6u));
    padded_max = (mx > (uint16_t)(65535u - step)) ? 65535u : (uint16_t)(mx + step);

    floor_min = (uint16_t)((mn / step) * step);
    ceil_max = (uint16_t)((padded_max + step - 1u) / step);
    if (ceil_max > (uint16_t)(65535u / step)) {
        ceil_max = 65535u;
    } else {
        ceil_max = (uint16_t)(ceil_max * step);
    }

    if (floor_min == mn && floor_min >= step) floor_min = (uint16_t)(floor_min - step);
    if (ceil_max <= mx) {
        ceil_max = (mx > (uint16_t)(65535u - step)) ? 65535u : (uint16_t)(mx + step);
    }

    *out_min = floor_min;
    *out_max = ceil_max;
}

/* Average value of bucket `b` of `n_bars` evenly splitting `vals[0..len)`. */
static uint16_t bucket_avg(const uint16_t *vals, uint8_t len, uint8_t b, uint8_t n_bars) {
    uint16_t lo = (uint16_t)((uint16_t)b * len / n_bars);
    uint16_t hi = (uint16_t)((uint16_t)(b + 1u) * len / n_bars);
    uint32_t sum = 0u;
    uint16_t i;
    if (hi <= lo) hi = (uint16_t)(lo + 1u);
    for (i = lo; i != hi && i < len; ++i)
        sum += vals[i];
    return (uint16_t)(sum / (hi - lo));
}

/* ── Bar chart drawing ───────────────────────────────────────────────────── */

/*
 * Render `vals[0..len)` as a column chart over the caller-provided domain.
 * Wide window data is bucketed down to at most MAX_BARS columns; the active
 * data range is padded so the chart doesn't hug the top or waste space below.
 */
static void draw_bar_chart(const uint16_t *vals, uint8_t len, uint16_t chart_min,
                           uint16_t chart_max) {
    uint8_t bar_w = (len <= 9u) ? 2u : 1u;
    uint8_t n_bars = len;
    uint8_t span_w, x0, b;
    uint16_t v, span;
    uint8_t h, x, top;

    if (n_bars > (uint8_t)(PLOT_W / bar_w)) n_bars = (uint8_t)(PLOT_W / bar_w);
    span_w = (uint8_t)(n_bars * bar_w);
    x0 = (uint8_t)(PLOT_LEFT + (PLOT_W - span_w) / 2u); /* centre the bars */

    ui_fill_attr(PLOT_LEFT, PLOT_TOP, PLOT_W, PLOT_ROWS, UI_PAL_PANEL);
    if (chart_max <= chart_min) return;

    span = (uint16_t)(chart_max - chart_min);

    for (b = 0u; b != n_bars; ++b) {
        v = bucket_avg(vals, len, b, n_bars);
        if (v <= chart_min) continue;
        h = (uint8_t)(((uint32_t)(v - chart_min) * PLOT_ROWS + (span >> 1u)) / span);
        if (h == 0u) h = 1u;
        if (h > PLOT_ROWS) h = PLOT_ROWS;
        x = (uint8_t)(x0 + b * bar_w);
        top = (uint8_t)(PLOT_BASE + 1u - h);
        ui_fill_attr(x, top, bar_w, h, UI_PAL_SELECTED);
    }
}

/*
 * Weight trend: like draw_bar_chart but normalised over min..max so small
 * day-to-day variation is visible (the lightest weigh-in keeps a 1-tile base).
 */
static void draw_weight_chart(void) {
    uint8_t bar_w = (weight_count <= 9u) ? 2u : 1u;
    uint8_t n_bars = weight_count;
    uint8_t span_w, x0, b;
    uint16_t chart_min, chart_max, span, v;
    uint8_t h, x, top;

    if (n_bars > (uint8_t)(PLOT_W / bar_w)) n_bars = (uint8_t)(PLOT_W / bar_w);
    span_w = (uint8_t)(n_bars * bar_w);
    x0 = (uint8_t)(PLOT_LEFT + (PLOT_W - span_w) / 2u);

    ui_fill_attr(PLOT_LEFT, PLOT_TOP, PLOT_W, PLOT_ROWS, UI_PAL_PANEL);
    chart_domain_for_values(weight_vals, weight_count, &chart_min, &chart_max);
    if (chart_max <= chart_min) return;
    span = (uint16_t)(chart_max - chart_min);

    for (b = 0u; b != n_bars; ++b) {
        v = bucket_avg(weight_vals, weight_count, b, n_bars);
        if (v <= chart_min) continue;
        h = (uint8_t)(((uint32_t)(v - chart_min) * PLOT_ROWS + (span >> 1u)) / span);
        if (h == 0u) h = 1u;
        if (h > PLOT_ROWS) h = PLOT_ROWS;
        x = (uint8_t)(x0 + b * bar_w);
        top = (uint8_t)(PLOT_BASE + 1u - h);
        ui_fill_attr(x, top, bar_w, h, UI_PAL_SELECTED);
    }
}

/* ── Per-page bodies ─────────────────────────────────────────────────────── */

static void draw_summary(void) {
    char buf[22];

    ui_print_at(1u, 3u, STR_SUMMARY);

    ui_print_at(1u, 5u, STR_MUSCLES);
    sprintf(buf, "%u/%u", (unsigned int)muscles_hit, (unsigned int)EXERCISE_MUSCLE_GROUP_COUNT);
    ui_print_at(13u, 5u, buf);

    ui_print_at(1u, 6u, STR_WORKOUTS);
    sprintf(buf, "%u", (unsigned int)workout_total);
    ui_print_at(13u, 6u, buf);

    ui_print_at(1u, 7u, STR_LOGGED);
    sprintf(buf, "%u/%u", (unsigned int)logged_days, (unsigned int)agg_range);
    ui_print_at(13u, 7u, buf);

    ui_print_at(0u, 8u, STR_DIVIDER);
    ui_print_at(1u, 9u, STR_AVG_PER_DAY);

    ui_print_at(1u, 11u, STR_LBL_CAL);
    sprintf(buf, "%u", (unsigned int)avg_u16(day_cal, agg_range));
    ui_print_at(6u, 11u, buf);
    ui_print_at(11u, 11u, STR_LBL_PRO);
    sprintf(buf, "%uG", (unsigned int)avg_u16(day_pro, agg_range));
    ui_print_at(16u, 11u, buf);

    ui_print_at(1u, 12u, STR_LBL_CARB);
    sprintf(buf, "%uG", (unsigned int)avg_u16(day_carb, agg_range));
    ui_print_at(6u, 12u, buf);
    ui_print_at(11u, 12u, STR_LBL_FAT);
    sprintf(buf, "%uG", (unsigned int)avg_u16(day_fat, agg_range));
    ui_print_at(16u, 12u, buf);
}

/* Shared layout for the four macro charts. */
static void draw_macro_page(const char *title, const char *unit, const uint16_t *vals) {
    char buf[22];
    uint16_t mx = max_u16(vals, agg_range);
    uint16_t chart_min, chart_max;

    ui_print_at(1u, 3u, title);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(STR_PER_DAY)), 3u, STR_PER_DAY);

    ui_print_at(1u, 4u, STR_AVG);
    sprintf(buf, "%u%s", (unsigned int)avg_u16(vals, agg_range), unit);
    ui_print_at(5u, 4u, buf);
    ui_print_at(11u, 4u, STR_MAX);
    sprintf(buf, "%u%s", (unsigned int)mx, unit);
    ui_print_at(15u, 4u, buf);

    ui_print_at(0u, 6u, STR_DIVIDER);
    chart_domain_for_values(vals, agg_range, &chart_min, &chart_max);
    draw_bar_chart(vals, agg_range, chart_min, chart_max);
}

static void bw_format(uint8_t units, uint16_t kg_tenths, char *buf) {
    if (units == UNITS_IMPERIAL) {
        sprintf(buf, "%u LB", (unsigned int)kg_tenths_to_lbs(kg_tenths));
    } else {
        sprintf(buf, "%u.%u KG", (unsigned int)(kg_tenths / 10u), (unsigned int)(kg_tenths % 10u));
    }
}

static void draw_weight_page(const SaveData *data) {
    char buf[22];

    ui_print_at(1u, 3u, STR_WEIGHT);

    if (weight_count == 0u) {
        ui_print_center(9u, STR_NO_DATA);
        return;
    }

    ui_print_at(1u, 4u, STR_CURRENT);
    bw_format(data->units, weight_vals[weight_count - 1u], buf);
    ui_print_at(11u, 4u, buf);

    ui_print_at(0u, 6u, STR_DIVIDER);
    draw_weight_chart();
}

/* ── Frame + loop ────────────────────────────────────────────────────────── */

static void progress_draw_loading(uint8_t range) {
    const char *range_label = (range == RANGE_SHORT) ? STR_RANGE_7 : STR_RANGE_30;

    ui_clear();
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);

    ui_print_at(1u, 1u, STR_PROGRESS);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(range_label)), 1u, range_label);
    ui_print_at(0u, 2u, STR_DIVIDER);

    ui_print_center(7u, "LOADING DATA");
    ui_print_center(9u, "[===     ]");
    ui_print_center(11u, "PLEASE WAIT");
    ui_footer("", "");
}

static void progress_compute_with_loading(const SaveData *data, uint8_t range) {
    progress_draw_loading(range);
    wait_vbl_done();
    progress_compute(data, range);
}

static void progress_draw(const SaveData *data, uint8_t page) {
    const char *range_label = (agg_range == RANGE_SHORT) ? STR_RANGE_7 : STR_RANGE_30;

    ui_clear();
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);

    ui_print_at(1u, 1u, STR_PROGRESS);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(range_label)), 1u, range_label);
    ui_print_at(0u, 2u, STR_DIVIDER);

    switch (page) {
    case PAGE_SUMMARY:
        draw_summary();
        break;
    case PAGE_CAL:
        draw_macro_page(STR_CALORIES, "", day_cal);
        break;
    case PAGE_PRO:
        draw_macro_page(STR_PROTEIN, "G", day_pro);
        break;
    case PAGE_CARB:
        draw_macro_page(STR_CARBS, "G", day_carb);
        break;
    case PAGE_FAT:
        draw_macro_page(STR_FAT, "G", day_fat);
        break;
    default:
        draw_weight_page(data);
        break;
    }

    ui_footer(STR_FOOTER_BACK, STR_FOOTER_PROG);
}

void progress_show(SaveData *data) BANKED {
    InputState input;
    uint8_t page = PAGE_SUMMARY;
    uint8_t range = RANGE_SHORT;
    uint8_t dirty = 1u;

    progress_compute_with_loading(data, range);

    input_init(&input);
    while (1) {
        if (dirty) {
            progress_draw(data, page);
            dirty = 0u;
        }

        wait_vbl_done();
        ui_input_update(&input);

        if (input_pressed(&input, J_B)) return;

        if (input_pressed(&input, J_LEFT)) {
            page = (page == 0u) ? (uint8_t)(PAGE_COUNT - 1u) : (uint8_t)(page - 1u);
            dirty = 1u;
        }
        if (input_pressed(&input, J_RIGHT)) {
            page = (uint8_t)((page + 1u) % PAGE_COUNT);
            dirty = 1u;
        }

        if (input_pressed(&input, J_UP | J_DOWN)) {
            range = (range == RANGE_SHORT) ? RANGE_LONG : RANGE_SHORT;
            progress_compute_with_loading(data, range);
            dirty = 1u;
        }
    }
}
