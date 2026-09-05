#ifndef MUSCLOG_UI_THEME_H
#define MUSCLOG_UI_THEME_H

#include <stdint.h>

/*
 * Colour theme for the text UI, mirroring the phone app's theme picker.
 *
 * The palettes themselves are generated from the app's theme registry into
 * src/generated/themes.{c,h} (see gameboy/tools/gen-themes.mjs), so a theme the
 * app gains or recolours reaches the cartridge by re-running that generator.
 *
 * The chosen theme is a display preference, not profile data: like the audio
 * toggles it lives in its own small SRAM store outside the checksummed save
 * block, so it survives a NEW GAME erase and is available before onboarding has
 * produced a save at all.
 */

/* How many themes this build carries (the app registry's theme count). */
uint8_t ui_theme_count(void);

/* Current theme index (0 .. ui_theme_count() - 1), loading it from SRAM on first use. */
uint8_t ui_theme_get(void);

/* Short uppercase label for the settings row, e.g. "DEPTH". */
const char *ui_theme_name(uint8_t theme);

/* Persist `theme` and upload its palettes immediately, so the screen the caller
 * is already showing recolours in place. Out-of-range values are ignored. */
void ui_theme_set(uint8_t theme);

/* Upload the current theme's four background palettes. Called by ui_init_text
 * whenever the text UI takes the screen back from the splash or title art. */
void ui_theme_apply(void);

#endif /* MUSCLOG_UI_THEME_H */
