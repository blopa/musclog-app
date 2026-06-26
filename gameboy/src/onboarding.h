#ifndef MUSCLOG_ONBOARDING_H
#define MUSCLOG_ONBOARDING_H

#include "profile.h"
#include <gb/gb.h>

/*
 * Run first-run onboarding into *data.
 *
 * had_valid_save tells onboarding whether *data was loaded from a valid save
 * (db_load returned 1). When it did and the save already carries a calibrated
 * RTC base date (rtc_is_set), that date is preserved across the internal
 * db_init_defaults() reset and pre-fills the date/time picker — this is how a
 * date pre-seeded into SRAM by the web emulator reaches the player.
 */
void onboarding_run(SaveData *data, uint8_t had_valid_save) BANKED;

#endif
