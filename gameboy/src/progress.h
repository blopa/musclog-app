#ifndef MUSCLOG_PROGRESS_H
#define MUSCLOG_PROGRESS_H

#include "profile.h" /* SaveData */
#include <gb/gb.h>

/*
 * Progress dashboard: a paged set of charts over a rolling 7- or 30-day window.
 *
 * Pages (cycled with Left/Right): a text SUMMARY (distinct muscle groups hit,
 * workout count, logged days, average daily macros) followed by per-day bar
 * charts for calories, protein, digestible carbs, fat, and a body-weight trend.
 * Up/Down toggles the 7D/30D window; B returns to the home screen.
 *
 * Lives in a numbered ROM bank (bank 1, alongside home_screen/body_weight) to
 * keep the full _HOME bank (bank 0) from overflowing; main.c calls it BANKED.
 */
void progress_show(SaveData *data) BANKED;

#endif /* MUSCLOG_PROGRESS_H */
