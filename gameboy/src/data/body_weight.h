#ifndef MUSCLOG_BODY_WEIGHT_H
#define MUSCLOG_BODY_WEIGHT_H

#include "profile.h"  /* SaveData */
#include <gb/gb.h>

/*
 * Body-weight screen (ROM bank 1). Shows the latest weight, min/max, and a
 * simple trend bar chart from the metrics log, and lets the user log today's
 * weight with a digit spinner. Logging upserts today's record (metrics.c),
 * updates the profile's current weight, and re-saves the profile.
 */
void body_weight_show(SaveData *data) BANKED;

#endif /* MUSCLOG_BODY_WEIGHT_H */
