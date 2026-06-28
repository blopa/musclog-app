#ifndef START_SCREEN_H
#define START_SCREEN_H

#include <gbdk/platform.h>

#include "profile.h"

/*
 * Title screen shown after the splash: a full-screen background image with the
 * Musclog logo and the menu options floating over the lower (dark) band.
 *
 *   - CONTINUE is offered only when a completed save exists; choosing it returns
 *     so the caller can show the home screen with the loaded save.
 *   - NEW GAME with no completed save runs onboarding directly.
 *   - NEW GAME with a completed save asks for confirmation, then erases all data
 *     and runs onboarding.
 *
 * On return the text UI (used by onboarding and the home screen) has been
 * re-initialised, so the caller can proceed straight to the home loop.
 *
 * `had_valid_save` is the result of `db_load()` and is forwarded to onboarding so
 * a pre-seeded RTC date survives a fresh start.
 */
void start_screen_run(SaveData *save, uint8_t had_valid_save) BANKED;

#endif
