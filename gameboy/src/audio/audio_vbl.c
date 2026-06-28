/*
 * HOME-bank VBL interrupt handler for audio stall detection.
 *
 * The Game Boy APU channels keep playing once triggered; they have no
 * concept of "the CPU stopped updating me." When the main loop is busy
 * loading screen tiles or doing SRAM I/O it stops calling
 * audio_music_update() for several frames, and the last triggered note
 * drones on as a continuous beep.
 *
 * This ISR fires every VBL (≈60 Hz) regardless of what the main loop is
 * doing. It counts consecutive frames since the last sequencer tick; once
 * that count exceeds STALL_FRAMES it kills channels 2/3/4 so the drone
 * stops. When the main loop resumes calling audio_music_update() it resets
 * the counter and the sequencer re-triggers notes normally.
 *
 * This file must stay in the HOME bank (no #pragma bank) because:
 *   - VBL ISRs run without any ROM bank switch; the GBC only has the fixed
 *     lower bank mapped when the interrupt fires.
 *   - The ISR only touches I/O registers (always accessible) and RAM
 *     globals — no ROM bank switching is needed or attempted.
 */

#include "audio_vbl.h"

#include <gb/gb.h>
#include <gb/hardware.h>
#include <stdint.h>

#define STALL_FRAMES 2u

volatile uint8_t g_audio_vbl_stall;  /* reset to 0 by audio_music_update() each call */
volatile uint8_t g_audio_vbl_active; /* 1 while music is running and enabled */

static void audio_vbl_isr(void) {
    if (!g_audio_vbl_active) return;

    if (g_audio_vbl_stall < 255u) g_audio_vbl_stall++;

    if (g_audio_vbl_stall > STALL_FRAMES) {
        NR22_REG = 0x00u; /* ch2 pulse lead: DAC off */
        NR30_REG = 0x00u; /* ch3 wave bass:  DAC off */
        NR42_REG = 0x00u; /* ch4 noise drums: DAC off */
    }
}

void audio_install_vbl(void) {
    g_audio_vbl_stall = 0u;
    g_audio_vbl_active = 0u;
    add_VBL(audio_vbl_isr);
}
