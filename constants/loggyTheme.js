'use strict';

/**
 * Loggy's colours for every theme.
 *
 * Loggy is drawn in three greens: the log's `body`, the `deep` green of the sweatband and shoe
 * stripes and of most props, and the `shade` between the two. Everything else in the artwork (the
 * ink outline, cream, tan, coral, sky, gold) is the same in every theme, so a pose still reads as
 * Loggy and only his green follows the app. Which classes of `assets/avatars/loggy-parts/palette.css`
 * are these greens (`s1`, `s3`, `s4`, `s7`) is `THEMED_LOGGY_CLASSES` there; the generators write a
 * role instead of the hex, and this file says what each role is in each theme.
 *
 * Plain CommonJS for the same reason as `theme.registry.js`: the website sync script
 * (`scripts/sync-website-loggy.js`) and the Loggy generators run in Node and must produce exactly
 * the colours the app draws.
 *
 * The values are listed, not computed, so one theme's Loggy can be tuned alone. They were found by
 * moving the default greens to the theme's `brandPrimary` hue (each darker green leans a little
 * towards blue, as the original does) and keeping Loggy's own lightness, then checking each on its
 * theme's background. Two themes need no change of hue: `kinetic-light` shares the default's
 * emerald, and the default dark theme is the artwork Loggy was drawn in, `LOGGY_CLASSIC`. Light
 * brands (Volt's yellow, Scope's lime) lift all three greens a little, or a mustard Loggy dulls the
 * vivid theme he sits in. A light theme does not darken Loggy the way it darkens its brand: its
 * brand is dark for text contrast, and an illustration has no text to keep readable.
 *
 * A new theme needs an entry here: `constants/__tests__/loggyTheme.test.ts` fails without one, and
 * checks every entry keeps Loggy's body readable against the theme's surfaces and his ink outline.
 */

/** The greens Loggy was drawn with, and what a surface that must not follow the theme gets. */
const LOGGY_CLASSIC = Object.freeze({
  body: '#47ad92',
  deep: '#2f7e78',
  shade: '#3d9183',
});

/** The three roles, in the order the artwork darkens. */
const LOGGY_COLOR_ROLES = Object.freeze(['body', 'shade', 'deep']);

const LOGGY_COLORS_BY_THEME = Object.freeze({
  'kinetic-depth': LOGGY_CLASSIC,
  'kinetic-light': LOGGY_CLASSIC,
  // Hot pink: the brand's hue, so the log reads as part of the theme rather than beside it.
  'kinetic-shock': Object.freeze({ body: '#dd6d9e', deep: '#995485', shade: '#b36090' }),
  // Golden, lifted from the brand's mustard so it keeps the yellow's glow.
  'kinetic-volt': Object.freeze({ body: '#cfac49', deep: '#8a853e', shade: '#a69648' }),
  // The deeper raspberry of the light pink theme.
  'kinetic-blush': Object.freeze({ body: '#e86789', deep: '#a34e79', shade: '#be5b81' }),
  'kinetic-varia': Object.freeze({ body: '#e2773b', deep: '#a75443', shade: '#bd6445' }),
  // Lime, lifted so it is not the olive a darker lime turns into.
  'kinetic-scope': Object.freeze({ body: '#a8cd3f', deep: '#629c4d', shade: '#81b150' }),
});

/** The classes of `palette.css` that are Loggy's greens, and the role each one plays. */
const THEMED_LOGGY_CLASSES = Object.freeze({
  s1: 'body',
  s3: 'deep',
  s4: 'body',
  s7: 'shade',
});

/**
 * How a themed colour is written in the artwork: `var(--loggy-body, #47ad92)`. A browser or a
 * react-native-svg component that knows nothing about themes draws the fallback, which is the
 * classic green, so the SVGs are still valid, correct pictures; the generators and the website
 * sync replace the whole expression with the theme's colour.
 */
function themedColor(role) {
  return `var(--loggy-${role}, ${LOGGY_CLASSIC[role]})`;
}

/**
 * Matches `themedColor`'s output, capturing the role. It is global, so use it with `replace` or
 * `matchAll`, or build a fresh `RegExp` from its `source` to test one value.
 */
const THEMED_COLOR_PATTERN = /var\(--loggy-(body|shade|deep),\s*#[0-9a-f]{6}\)/gi;

/** The Loggy greens for a theme id; a theme this file does not know gets the classic ones. */
function loggyColorsForTheme(themeId) {
  return LOGGY_COLORS_BY_THEME[themeId] ?? LOGGY_CLASSIC;
}

/**
 * The theme a theme's Loggy files are filed under: the first theme, in registry order, that is
 * drawn in the same greens. The website serves one set of files per distinct palette, so the two
 * emerald themes share one directory instead of duplicating it.
 */
function loggyPaletteId(themeId) {
  const colors = loggyColorsForTheme(themeId);

  return (
    Object.keys(LOGGY_COLORS_BY_THEME).find((candidate) =>
      LOGGY_COLOR_ROLES.every((role) => LOGGY_COLORS_BY_THEME[candidate][role] === colors[role])
    ) ?? themeId
  );
}

/** An SVG's text with each `var(--loggy-<role>, …)` replaced by the colour `colors` gives that role. */
function applyLoggyColors(svg, colors) {
  return svg.replace(THEMED_COLOR_PATTERN, (_match, role) => colors[role]);
}

module.exports = {
  LOGGY_CLASSIC,
  LOGGY_COLORS_BY_THEME,
  LOGGY_COLOR_ROLES,
  THEMED_COLOR_PATTERN,
  THEMED_LOGGY_CLASSES,
  applyLoggyColors,
  loggyColorsForTheme,
  loggyPaletteId,
  themedColor,
};
