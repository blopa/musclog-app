#ifndef MUSCLOG_HOME_SCREEN_H
#define MUSCLOG_HOME_SCREEN_H

#include "profile.h"  /* SaveData */
#include <gb/gb.h>

/* Home-screen action buttons. */
#define HOME_BTN_FOOD     0u
#define HOME_BTN_WORKOUT  1u
#define HOME_BTN_WEIGHT   2u
#define HOME_BTN_PROGRESS 3u
#define HOME_BTN_COUNT    4u

typedef struct HomeState {
    SaveData *data;
    uint8_t selected;
    uint8_t dirty;
} HomeState;

/*
 * Render the home screen (daily macro summary + the three action buttons).
 * Lives in a numbered ROM bank to keep the full _HOME bank (bank 0) from
 * overflowing; the main loop in main.c calls it as a BANKED function.
 */
void home_draw(const HomeState *state) BANKED;

#endif /* MUSCLOG_HOME_SCREEN_H */
