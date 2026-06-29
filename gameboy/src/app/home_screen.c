#pragma bank 1

#include "home_screen.h"

#include "copies.h"
#include "foodlog.h"
#include "rtc.h"
#include "ui_text.h"

#include <gb/gb.h>
#include <stdio.h>
#include <string.h>

/* Draw a full-width action button with a cursor indicator. */
static void draw_button(uint8_t y, const char *label, uint8_t focused) {
    uint8_t pal = focused ? UI_PAL_SELECTED : UI_PAL_PANEL;
    ui_fill_attr(0u, y, 20u, 1u, pal);
    ui_print_at(1u, y, focused ? ">" : " ");
    ui_print_at(3u, y, label);
}

/*
 * Home screen layout (20x18 tiles):
 *
 *  Row 0   MUSCLOG GB           ← header bar (PAL_HEADER)
 *  Row 1   HOME      MM-DD-YY   ← screen label + today's date
 *  Row 2   --------------------
 *  Row 3   CALORIES
 *  Row 4    0 / 2510 KCAL
 *  Row 5   [==================] ← 18-wide calorie bar (cols 1-18)
 *  Row 6   PROTEIN      CARBS
 *  Row 7   0/188G       0/281G
 *  Row 8   [#######]  [#######] ← two 9-wide bars (cols 0-8, 11-19)
 *  Row 9   FAT          FIBER
 *  Row 10  0/69G        0/35G
 *  Row 11  [#######]  [#######]
 *  Row 12  [> NUTRITION       ] ← button (PAL_SELECTED when focused, PAL_PANEL otherwise)
 *  Row 13  [> WORKOUTS        ] ← button
 *  Row 14  [> BODY WEIGHT     ] ← button
 *  Row 15  [> PROGRESS        ] ← button
 *  Row 16  --------------------  ← via ui_footer
 *  Row 17  SEL MENU              ← via ui_footer (opens settings / reset menu)
 */
void home_draw(const HomeState *state) BANKED {
    const SaveData *d = state->data;
    char buf[22];
    char date_buf[9]; /* "MM-DD-YY\0" */
    CalDate today;
    uint16_t cal, pro, carb, fat, fib;
    uint16_t digestible_carb;

    today = cal_current_date(d);
    cal_format(&today, date_buf);

    /* Today's totals from the persisted food log. */
    foodlog_sum_day(cal_day_number(today), &cal, &pro, &carb, &fat, &fib);
    digestible_carb = foodlog_digestible_carbs(carb, fib);

    ui_clear();

    /* ── Header ── */
    ui_fill_attr(0u, 0u, 20u, 1u, UI_PAL_HEADER);
    ui_print_center(0u, STR_APP_TITLE);

    ui_print_at(1u, 1u, STR_HOME);
    ui_print_at((uint8_t)(19u - (uint8_t)strlen(date_buf)), 1u, date_buf);

    ui_print_at(0u, 2u, STR_DIVIDER);

    /* ── Calories ── */
    ui_print_at(1u, 3u, STR_CALORIES);
    sprintf(buf, "%u / %u KCAL", (unsigned int)cal, (unsigned int)d->calorie_goal);
    ui_print_at(1u, 4u, buf);
    ui_draw_bar(1u, 5u, 18u, ui_bar_fill(cal, d->calorie_goal, 18u));

    /* ── Protein + Carbs ── */
    ui_print_at(0u, 6u, STR_PROTEIN);
    ui_print_at(11u, 6u, STR_CARBS);
    sprintf(buf, "%u/%uG", (unsigned int)pro, (unsigned int)d->protein_goal);
    ui_print_at(0u, 7u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)digestible_carb, (unsigned int)d->carbs_goal);
    ui_print_at(11u, 7u, buf);
    ui_draw_bar(0u, 8u, 9u, ui_bar_fill(pro, d->protein_goal, 9u));
    ui_draw_bar(11u, 8u, 9u, ui_bar_fill(digestible_carb, d->carbs_goal, 9u));

    /* ── Fat + Fiber ── */
    ui_print_at(0u, 9u, STR_FAT);
    ui_print_at(11u, 9u, STR_FIBER);
    sprintf(buf, "%u/%uG", (unsigned int)fat, (unsigned int)d->fat_goal);
    ui_print_at(0u, 10u, buf);
    sprintf(buf, "%u/%uG", (unsigned int)fib, (unsigned int)d->fiber_goal);
    ui_print_at(11u, 10u, buf);
    ui_draw_bar(0u, 11u, 9u, ui_bar_fill(fat, d->fat_goal, 9u));
    ui_draw_bar(11u, 11u, 9u, ui_bar_fill(fib, d->fiber_goal, 9u));

    /* ── Action buttons ── */
    draw_button(12u, STR_NUTRITION, state->selected == HOME_BTN_FOOD);
    draw_button(13u, STR_WORKOUTS, state->selected == HOME_BTN_WORKOUT);
    draw_button(14u, STR_BODY_WEIGHT, state->selected == HOME_BTN_WEIGHT);
    draw_button(15u, STR_PROGRESS, state->selected == HOME_BTN_PROGRESS);

    ui_footer(STR_FOOTER_SEL_MENU, "");
}
