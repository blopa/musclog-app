#ifndef MUSCLOG_OPTICAL_SHARE_H
#define MUSCLOG_OPTICAL_SHARE_H

#include <gb/gb.h>

#include "profile.h"

/* Sender only: a Game Boy has no camera, so reception remains an app/web job. */

/* Everything on the cartridge, as a database the receiver restores over its own data. */
void optical_share_show(const SaveData *data) BANKED;

/*
 * One day of the food log, as a share the receiver MERGES into its diary — it dedupes the foods
 * against its own catalogue and files the entries on the same calendar day. Non-destructive, so
 * unlike SHARE DATA it is safe to send to a phone that is already in use.
 */
void optical_share_show_day(const SaveData *data, uint16_t day_num) BANKED;

#endif /* MUSCLOG_OPTICAL_SHARE_H */
