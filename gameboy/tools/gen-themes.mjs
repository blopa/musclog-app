// Ports the app's theme catalogue into the ROM's four CGB background palettes.
//
// Source:
//   - theme.registry.js -> src/generated/themes.{c,h}
//
// The phone app paints from a ~30-colour palette per theme; the Game Boy Color
// draws its whole text UI from four 4-colour background palettes, and the IBM
// font only ever uses colour index 0 (cell background) and index 3 (glyph ink).
// So each theme is reduced to four background/ink pairs — one per UI_PAL_* slot:
//
//   NORMAL   surfaceBase    the screen itself
//   HEADER   brandSurface   the title strip
//   SELECTED brandBright    the focused row
//   PANEL    surfaceAccent  cards, bars and value chips
//
// The ink is not a fixed token: `textPrimary` sits on the light surfaces of a
// light theme and `inkOnAccent` on its brand fills, and the two swap roles in a
// dark theme. Picking whichever of the pair contrasts more with the chosen
// background gets both right without a per-theme table. Indices 1 and 2 are
// filled with two steps between background and ink so the ramp stays monotonic
// for anything that samples them.
//
// The generated files are committed so the ROM build does not depend on the
// registry at build time. Re-run with `npm run gb:gen-themes` after adding or
// recolouring a theme.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const outDir = join(repoRoot, 'gameboy', 'src', 'generated');
const require = createRequire(import.meta.url);
const clangFormat = require('clang-format');
const { DEFAULT_THEME_BY_MODE, THEME_DEFINITIONS } = require(join(repoRoot, 'theme.registry.js'));

/* The four UI_PAL_* slots, in the order ui_theme.c uploads them. */
const SLOTS = [
  { name: 'NORMAL', background: 'surfaceBase', comment: 'screen background' },
  { name: 'HEADER', background: 'brandSurface', comment: 'title strip' },
  { name: 'SELECTED', background: 'brandBright', comment: 'focused row' },
  { name: 'PANEL', background: 'surfaceAccent', comment: 'cards, bars, value chips' },
];

/* Value column on the settings row: 20 tiles wide minus the label. */
const MAX_NAME_LENGTH = 8;

function parseHex(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance, used only to rank two candidate inks. */
function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function mix(from, to, ratio) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio));
}

/** `kinetic-depth` -> `DEPTH`: the family prefix is the same for every theme. */
function themeName(id) {
  const name = id
    .replace(/^kinetic-/, '')
    .replace(/-/g, ' ')
    .toUpperCase();
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(
      `Theme name "${name}" (from ${id}) is ${name.length} chars; the settings row fits ${MAX_NAME_LENGTH}.`
    );
  }
  return name;
}

function slotColors(palette, slot) {
  const background = parseHex(palette[slot.background]);
  const inks = [parseHex(palette.textPrimary), parseHex(palette.inkOnAccent)];
  const ink =
    contrastRatio(background, inks[0]) >= contrastRatio(background, inks[1]) ? inks[0] : inks[1];

  return [background, mix(background, ink, 1 / 3), mix(background, ink, 2 / 3), ink];
}

function rgb8(color) {
  const hex = (channel) => `0x${channel.toString(16).padStart(2, '0')}`;
  return `RGB8(${hex(color[0])}, ${hex(color[1])}, ${hex(color[2])})`;
}

const themes = Object.entries(THEME_DEFINITIONS).map(([id, theme]) => ({
  id,
  name: themeName(id),
  mode: theme.mode,
  palette: theme.palette,
}));

const defaultIndex = themes.findIndex((theme) => theme.id === DEFAULT_THEME_BY_MODE.dark);
if (defaultIndex === -1) {
  throw new Error(`DEFAULT_THEME_BY_MODE.dark (${DEFAULT_THEME_BY_MODE.dark}) is not a theme id.`);
}

const paletteLiterals = themes
  .map((theme) => {
    const slots = SLOTS.map((slot) => {
      const colors = slotColors(theme.palette, slot);
      return (
        `        /* ${slot.name}: ${theme.palette[slot.background]} ${slot.comment}. */\n` +
        colors.map((color) => `        ${rgb8(color)},`).join('\n')
      );
    }).join('\n');

    return `    {\n        /* ${theme.id} (${theme.mode}) */\n${slots}\n    },`;
  })
  .join('\n');

const nameLiterals = themes.map((theme) => `    "${theme.name}",`).join('\n');

const header = `/* Auto-generated by gameboy/tools/gen-themes.mjs — do not edit by hand. */
/* Source: theme.registry.js. */
#ifndef MUSCLOG_THEMES_H
#define MUSCLOG_THEMES_H

#include <gbdk/platform.h>
#include <stdint.h>

/* One entry per theme in the phone app's registry, in registry order — the index
 * is what ui_theme.c persists in SRAM, so appending is safe and reordering is not. */
#define GB_THEME_COUNT ${themes.length}u

/* The theme a fresh cartridge boots with (the app's default dark theme). */
#define GB_THEME_DEFAULT ${defaultIndex}u

/* Four CGB background palettes per theme, laid out as UI_PAL_NORMAL, UI_PAL_HEADER,
 * UI_PAL_SELECTED, UI_PAL_PANEL — a single set_bkg_palette(0, 4, ...) upload. */
#define GB_THEME_COLORS 16u

extern const palette_color_t gb_theme_palettes[GB_THEME_COUNT][GB_THEME_COLORS];

/* Short uppercase labels for the settings row (at most ${MAX_NAME_LENGTH} characters). */
extern const char *const gb_theme_names[GB_THEME_COUNT];

#endif /* MUSCLOG_THEMES_H */
`;

const body = `/* Auto-generated by gameboy/tools/gen-themes.mjs — do not edit by hand. */
/* Source: theme.registry.js. */
#include "themes.h"

const palette_color_t gb_theme_palettes[GB_THEME_COUNT][GB_THEME_COLORS] = {
${paletteLiterals}
};

const char *const gb_theme_names[GB_THEME_COUNT] = {
${nameLiterals}
};
`;

const generatedFiles = [join(outDir, 'themes.h'), join(outDir, 'themes.c')];
writeFileSync(generatedFiles[0], header);
writeFileSync(generatedFiles[1], body);
execFileSync(
  process.execPath,
  [
    clangFormat.location,
    '-i',
    `--style=file:${join(repoRoot, 'gameboy', '.clang-format')}`,
    ...generatedFiles,
  ],
  { cwd: repoRoot, stdio: 'inherit' }
);

console.log(
  `Wrote themes.{c,h} (${themes.length} themes: ${themes.map((theme) => theme.name).join(', ')}; ` +
    `default ${themes[defaultIndex].name}).`
);
