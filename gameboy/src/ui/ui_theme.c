#include "ui_theme.h"

#include "sram_layout.h"
#include "themes.h"

#include <gb/gb.h>

/* ── Persisted setting (cartridge SRAM bank 0, in the profile-reserved region
 *    next to the audio store; see profile.h's SRAM map). The magic byte tells a
 *    written store from blank SRAM so a fresh cartridge starts on the app's
 *    default dark theme. ────────────────────────────────────────────────────── */
#define THEME_SRAM_MAGIC_OFF SRAM_LAYOUT_THEME_MAGIC
#define THEME_SRAM_VALUE_OFF SRAM_LAYOUT_THEME_VALUE
#define THEME_SRAM_MAGIC 0x7Cu

static uint8_t s_theme = GB_THEME_DEFAULT;
static uint8_t s_loaded = 0u;

static void theme_save(void) {
    ENABLE_RAM;
    SWITCH_RAM(SRAM_LAYOUT_BANK0);
    _SRAM[THEME_SRAM_MAGIC_OFF] = THEME_SRAM_MAGIC;
    _SRAM[THEME_SRAM_VALUE_OFF] = s_theme;
    DISABLE_RAM;
}

/* A store written by a build with more themes than this one would index past the
 * palette table, so an out-of-range value falls back to the default. */
static void theme_load(void) {
    uint8_t magic;
    uint8_t value;

    s_loaded = 1u;

    ENABLE_RAM;
    SWITCH_RAM(SRAM_LAYOUT_BANK0);
    magic = _SRAM[THEME_SRAM_MAGIC_OFF];
    value = _SRAM[THEME_SRAM_VALUE_OFF];
    DISABLE_RAM;

    if (magic != THEME_SRAM_MAGIC || value >= GB_THEME_COUNT) {
        s_theme = GB_THEME_DEFAULT;
        theme_save();
    } else {
        s_theme = value;
    }
}

uint8_t ui_theme_count(void) {
    return GB_THEME_COUNT;
}

uint8_t ui_theme_get(void) {
    if (!s_loaded) theme_load();
    return s_theme;
}

const char *ui_theme_name(uint8_t theme) {
    if (theme >= GB_THEME_COUNT) theme = GB_THEME_DEFAULT;
    return gb_theme_names[theme];
}

void ui_theme_apply(void) {
    set_bkg_palette(0u, 4u, gb_theme_palettes[ui_theme_get()]);
}

void ui_theme_set(uint8_t theme) {
    if (theme >= GB_THEME_COUNT) return;

    s_theme = theme;
    s_loaded = 1u;
    theme_save();
    ui_theme_apply();
}
