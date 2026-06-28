#ifndef MUSCLOG_AUDIO_VBL_H
#define MUSCLOG_AUDIO_VBL_H

#include <stdint.h>

/*
 * Shared state between audio_vbl.c (HOME bank) and audio.c (bank 9).
 * The VBL ISR writes g_audio_vbl_stall / reads g_audio_vbl_active;
 * audio.c updates both from its BANKED functions.
 */
extern volatile uint8_t g_audio_vbl_stall;
extern volatile uint8_t g_audio_vbl_active;

/* Register the VBL interrupt handler. Call once at boot from main(),
 * before audio_init(). No BANKED attribute — must stay in HOME bank. */
void audio_install_vbl(void);

#endif /* MUSCLOG_AUDIO_VBL_H */
