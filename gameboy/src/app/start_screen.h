#ifndef START_SCREEN_H
#define START_SCREEN_H

#include <gbdk/platform.h>

#include "profile.h"

/*
 * Title screen shown after the splash: a full-screen background image with the
 * Musclog logo and the menu options floating over the lower (dark) band.
 *
 *   - CONTINUE is offered only when a completed save exists.
 *   - NEW GAME with no completed save returns START_SCREEN_NEW_GAME.
 *   - NEW GAME with a completed save asks for confirmation, then returns
 *     START_SCREEN_ERASE_AND_NEW_GAME.
 *
 * On return the text UI (used by onboarding and the home screen) has been
 * re-initialised, so the caller can proceed straight to the home loop.
 *
 * The caller owns all data lifecycle work (erase/onboarding/home), keeping this
 * module focused on title-screen rendering and input.
 */
typedef uint8_t StartScreenAction;

#define START_SCREEN_CONTINUE 0u
#define START_SCREEN_NEW_GAME 1u
#define START_SCREEN_ERASE_AND_NEW_GAME 2u

StartScreenAction start_screen_run(SaveData *save, uint8_t had_valid_save) BANKED;

#endif
