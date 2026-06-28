#ifndef MUSCLOG_AUDIO_H
#define MUSCLOG_AUDIO_H

#include <stdint.h>
#include <gbdk/platform.h>

/*
 * Game Boy APU sound for Musclog GB. The Game Boy cannot play MIDI, so the two
 * bundled .mid files are reduced at build time (gameboy/tools/gen-music.mjs ->
 * music_data.c) and played back here on the four hardware channels:
 *
 *   - SFX   : a UI confirm/select blip on pulse channel 1.
 *   - Music : the in-game soundtrack — lead on pulse channel 2, bass on the
 *             wave channel 3, drums on the noise channel 4. SFX (channel 1) is
 *             kept separate so a blip never interrupts the soundtrack.
 *
 * The code and its data tables share ROM bank AUDIO_BANK; every entry point is
 * BANKED so it can be called from any other bank. Enable flags for SFX and music
 * are persisted in cartridge SRAM (see profile.h's SRAM map) and survive resets.
 */

/* Power on the APU and load the persisted SFX/music enable flags. Call once at
 * boot, before any other audio function. */
void audio_init(void) BANKED;

/* Play the UI confirm/select blip on channel 1 (no-op if SFX is disabled). The
 * channel's length counter silences it on its own, so this is fire-and-forget. */
void audio_play_sfx(void) BANKED;

/* Soundtrack control. start() rewinds and begins; update() advances one step and
 * must be called once per video frame on every gameplay/menu screen where music
 * should keep running; stop() silences the music channels. start/update are
 * no-ops while music is disabled. */
void audio_music_start(void) BANKED;
void audio_music_update(void) BANKED;
void audio_music_stop(void) BANKED;

/* Options toggles. The getters report the current setting; the setters persist the
 * new value and apply it immediately (disabling music silences it at once;
 * re-enabling it while the title screen is up restarts the song). */
uint8_t audio_sfx_enabled(void) BANKED;
uint8_t audio_music_enabled(void) BANKED;
void audio_set_sfx(uint8_t on) BANKED;
void audio_set_music(uint8_t on) BANKED;

#endif /* MUSCLOG_AUDIO_H */
