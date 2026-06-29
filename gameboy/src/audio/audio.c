#pragma bank 9

#include "audio.h"
#include "audio_vbl.h"

#include <gb/gb.h>
#include <gb/hardware.h>

#include "music_data.h"
#include "sram_layout.h"

/*
 * audio.c lives in AUDIO_BANK (9) together with music_data.c, so the sequencer
 * reads the event/period tables directly while this BANKED code is mapped in.
 */

/* ── Persisted settings (cartridge SRAM bank 0, inside the profile-reserved
 *    region; see profile.h's SRAM map). A magic byte distinguishes a written
 *    store from blank SRAM so first boot defaults both toggles on. ──────────── */
#define AUDIO_SRAM_MAGIC_OFF SRAM_LAYOUT_AUDIO_MAGIC
#define AUDIO_SRAM_FLAGS_OFF SRAM_LAYOUT_AUDIO_FLAGS
#define AUDIO_SRAM_MAGIC 0xA7u
#define AUDIO_FLAG_SFX 0x01u
#define AUDIO_FLAG_MUSIC 0x02u

/* Game Boy wave-pattern RAM (32 4-bit samples packed into 16 bytes at 0xFF30). */
#define WAVE_RAM ((volatile uint8_t *)0xFF30u)

/* A triangle wave for the bass voice: a soft, rounded tone that sits under the
 * pulse lead without overpowering it. Ramps 0→F then F→0 across the 32 samples. */
static const uint8_t s_wave_triangle[16] = {
    0x01u, 0x23u, 0x45u, 0x67u, 0x89u, 0xABu, 0xCDu, 0xEFu,
    0xFEu, 0xDCu, 0xBAu, 0x98u, 0x76u, 0x54u, 0x32u, 0x10u,
};

static uint8_t s_sfx_enabled;
static uint8_t s_music_enabled;
static uint8_t s_music_running; /* 1 while the current soundtrack loop should run */
static uint16_t s_idx;          /* next soundtrack event to apply */
static uint8_t s_wait;          /* video frames to wait before applying events[s_idx] */

static void audio_save_settings(void) {
    uint8_t flags = (uint8_t)((s_sfx_enabled ? AUDIO_FLAG_SFX : 0u) |
                              (s_music_enabled ? AUDIO_FLAG_MUSIC : 0u));
    ENABLE_RAM;
    SWITCH_RAM(SRAM_LAYOUT_BANK0);
    _SRAM[AUDIO_SRAM_MAGIC_OFF] = AUDIO_SRAM_MAGIC;
    _SRAM[AUDIO_SRAM_FLAGS_OFF] = flags;
    DISABLE_RAM;
}

static void audio_load_settings(void) {
    uint8_t magic;
    uint8_t flags;

    ENABLE_RAM;
    SWITCH_RAM(SRAM_LAYOUT_BANK0);
    magic = _SRAM[AUDIO_SRAM_MAGIC_OFF];
    flags = _SRAM[AUDIO_SRAM_FLAGS_OFF];
    DISABLE_RAM;

    if (magic != AUDIO_SRAM_MAGIC) {
        s_sfx_enabled = 1u; /* fresh cartridge: both on by default */
        s_music_enabled = 1u;
        audio_save_settings();
    } else {
        s_sfx_enabled = (uint8_t)((flags & AUDIO_FLAG_SFX) != 0u);
        s_music_enabled = (uint8_t)((flags & AUDIO_FLAG_MUSIC) != 0u);
    }
}

/* Silence only the three soundtrack channels (the SFX channel is left alone). */
static void audio_silence_music_channels(void) {
    NR22_REG = 0x00u; /* channel 2 (lead): DAC off */
    NR30_REG = 0x00u; /* channel 3 (bass wave): DAC off */
    NR42_REG = 0x00u; /* channel 4 (drums noise): DAC off */
}

static void apply_event(uint8_t target, uint8_t value) {
    uint16_t period;

    if (target == MUSIC_TARGET_LEAD) {
        if (value == 0u) {
            NR22_REG = 0x00u; /* note off: silence channel 2 */
        } else {
            period = music_pulse_periods[value - 1u];
            NR21_REG = 0x80u; /* 50% duty */
            NR22_REG = 0xA0u; /* volume 10, sustained */
            NR23_REG = (uint8_t)(period & 0xFFu);
            NR24_REG = (uint8_t)(0x80u | ((period >> 8) & 0x07u)); /* trigger */
        }
    } else if (target == MUSIC_TARGET_BASS) {
        if (value == 0u) {
            NR30_REG = 0x00u; /* note off: DAC off on the wave channel */
        } else {
            period = music_wave_periods[value - 1u];
            NR30_REG = 0x80u; /* DAC on */
            NR32_REG = 0x20u; /* output level 100% */
            NR33_REG = (uint8_t)(period & 0xFFu);
            NR34_REG = (uint8_t)(0x80u | ((period >> 8) & 0x07u)); /* trigger */
        }
    } else if (target == MUSIC_TARGET_DRUM) {
        if (value == MUSIC_DRUM_KICK) {
            NR41_REG = 0x20u; /* length */
            NR42_REG = 0xF2u; /* full volume, fast decay */
            NR43_REG = 0x55u; /* low, punchy noise */
            NR44_REG = 0xC0u; /* trigger + length enable */
        } else if (value == MUSIC_DRUM_SNARE) {
            NR41_REG = 0x28u;
            NR42_REG = 0xF1u;
            NR43_REG = 0x22u; /* brighter noise */
            NR44_REG = 0xC0u;
        }
    }
    /* MUSIC_TARGET_NOP: nothing — it only carries a gap in delta_frames. */
}

void audio_init(void) BANKED {
    uint8_t i;

    NR52_REG = 0x80u; /* APU master power on */
    NR50_REG = 0x77u; /* full master volume, both sides, no VIN */
    NR51_REG = 0xFFu; /* every channel routed to both speakers */

    NR30_REG = 0x00u; /* wave RAM may only be written with the DAC off */
    for (i = 0u; i != 16u; ++i) {
        WAVE_RAM[i] = s_wave_triangle[i];
    }

    s_music_running = 0u;
    s_idx = 0u;
    s_wait = 0u;

    audio_load_settings();
}

void audio_play_sfx(void) BANKED {
    if (!s_sfx_enabled) return;

    /* A short decaying blip on channel 1; the length counter cuts it cleanly. */
    NR10_REG = 0x00u; /* no frequency sweep */
    NR11_REG = 0xA6u; /* 50% duty, length so it auto-stops (~100 ms) */
    NR12_REG = 0xF3u; /* full volume, fast decay */
    NR13_REG = (uint8_t)(MUSIC_SFX_PERIOD & 0xFFu);
    NR14_REG = (uint8_t)(0xC0u | ((MUSIC_SFX_PERIOD >> 8) & 0x07u)); /* trigger + length enable */
}

void audio_music_start(void) BANKED {
    s_music_running = 1u;
    s_idx = 0u;
    s_wait = 0u;
    g_audio_vbl_stall = 0u;
    g_audio_vbl_active = s_music_enabled ? 1u : 0u;
    if (!s_music_enabled) {
        audio_silence_music_channels();
    }
}

void audio_music_stop(void) BANKED {
    s_music_running = 0u;
    g_audio_vbl_active = 0u;
    audio_silence_music_channels();
}

void audio_music_update(void) BANKED {
    uint8_t guard;

    g_audio_vbl_stall = 0u; /* tell the VBL ISR the sequencer is alive */
    if (!s_music_enabled || !s_music_running) return;

    if (s_wait != 0u) {
        s_wait--;
        return;
    }

    /* Apply every event scheduled for this frame (chained 0-frame deltas), then
     * latch the wait until the next one. The guard stops a degenerate all-zero
     * cycle from hanging the frame. */
    guard = 0u;
    do {
        apply_event(music_events[s_idx].target, music_events[s_idx].value);
        s_wait = music_events[s_idx].delta_frames;
        s_idx++;
        if (s_idx >= MUSIC_EVENT_COUNT) {
            s_idx = MUSIC_LOOP_INDEX; /* wrap to the looped body */
        }
    } while (s_wait == 0u && ++guard < 64u);

    if (s_wait != 0u) {
        s_wait--; /* consume the current frame */
    }
}

uint8_t audio_sfx_enabled(void) BANKED {
    return s_sfx_enabled;
}

uint8_t audio_music_enabled(void) BANKED {
    return s_music_enabled;
}

void audio_set_sfx(uint8_t on) BANKED {
    s_sfx_enabled = on ? 1u : 0u;
    audio_save_settings();
}

void audio_set_music(uint8_t on) BANKED {
    s_music_enabled = on ? 1u : 0u;
    audio_save_settings();

    if (!s_music_enabled) {
        g_audio_vbl_active = 0u;
        audio_silence_music_channels();
    } else if (s_music_running) {
        s_idx = 0u; /* re-enabled while the soundtrack loop is active: restart from the top */
        s_wait = 0u;
        g_audio_vbl_stall = 0u;
        g_audio_vbl_active = 1u;
    }
}
