#ifndef MUSCLOG_SETTINGS_H
#define MUSCLOG_SETTINGS_H

#include "profile.h" /* SaveData */
#include <gb/gb.h>

/*
 * Scrollable settings screen: lets the user change every onboarding profile
 * field (units, gender, age, height, weight, activity level, lifting
 * experience, fitness focus, weight goal) and every macro target (calories,
 * protein, carbs, fat, fiber) from a single list.
 *
 * UP/DOWN move between fields (the list scrolls when there are more fields than
 * visible rows). LEFT/RIGHT change the focused value in place — enumerated
 * fields cycle, numeric fields step by a coarse amount. A/START on a numeric
 * field opens a focused spinner for fine (small + large) adjustment. Every
 * change is persisted with db_save immediately, so B simply returns home.
 *
 * Lives in a numbered ROM bank (bank 1, alongside the other home-reachable
 * screens) to keep the full _HOME bank from overflowing; main.c calls it as a
 * BANKED function.
 */
void settings_show(SaveData *data) BANKED;

/*
 * Home-screen SELECT menu: lets the user open the settings screen or erase all
 * data (after a confirmation) and re-run onboarding. Lives in the same banked
 * module so the menu/reset code stays out of the full _HOME bank. Returns 1 if
 * the save was erased (so the caller can reset its home selection), else 0.
 */
uint8_t settings_menu(SaveData *data) BANKED;

#endif /* MUSCLOG_SETTINGS_H */
