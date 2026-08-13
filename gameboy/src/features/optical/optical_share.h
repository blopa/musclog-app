#ifndef MUSCLOG_OPTICAL_SHARE_H
#define MUSCLOG_OPTICAL_SHARE_H

#include <gb/gb.h>

#include "profile.h"

/* Sender only: a Game Boy has no camera, so reception remains an app/web job. */
void optical_share_show(const SaveData *data) BANKED;

#endif /* MUSCLOG_OPTICAL_SHARE_H */
