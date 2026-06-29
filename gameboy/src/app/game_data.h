#ifndef MUSCLOG_GAME_DATA_H
#define MUSCLOG_GAME_DATA_H

#include <gbdk/platform.h>

/* Clears every SRAM-backed gameplay store. Audio settings intentionally survive. */
void game_data_erase_all(void) BANKED;

#endif /* MUSCLOG_GAME_DATA_H */
