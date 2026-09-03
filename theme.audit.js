'use strict';

/**
 * The palette rules for every named theme, in one place.
 *
 * The palette was consolidated from 57 primaries to 23 because the extra tokens
 * carried no visual information: some were byte-identical, most sat inside the
 * just-noticeable-difference threshold of a neighbour, and the surface "ladder"
 * had nine of twelve steps below 1.10x contrast — invisible on any display.
 *
 * This module keeps that from growing back. It reads the live registry rather
 * than a copied list of hexes, so it cannot drift from what the app renders, and
 * it is the single definition of the rules: `scripts/check-palette.js` prints
 * them and `utils/__tests__/themeSelection.test.ts` asserts them in CI. Adding a
 * rule in one place covers both.
 *
 * Each family is judged on the axis that actually governs it:
 *
 *   surfaces  contrast between adjacent rungs. Neighbouring surfaces are *meant*
 *             to be close in dE; what matters is whether the seam renders.
 *   ink       contrast against the surfaces that carry body copy.
 *   accents   dE2000 within a set that shares a legend. Two near-identical
 *             accents are harmless until a chart or an avatar ring shows both.
 */
const chroma = require('chroma-js');

const { THEME_DEFINITIONS, THEME_IDS } = require('./theme.registry');
const { themeColorsById } = require('./theme.tokens');

/** Under dE 5 a viewer will not name two colours as different. */
const MIN_DELTA_E = 5.0;
/** Below 1.05x a surface seam does not render on any display. */
const MIN_SEAM = 1.05;
const AA_NORMAL = 4.5;
/**
 * Floor for the summary card's ink against its gradient. See `checkColorfulCard`
 * for why this is not AA; the tightest shipped pair sits at 2.54:1.
 */
const MIN_CARD_INK_SEPARATION = 2.0;

/** Neutral ladder, base upward. The tinted branch separates on chroma, not lightness. */
const LADDER = ['surfaceBase', 'surfaceCard', 'surfaceRaised', 'borderHairline'];
/**
 * Surfaces that carry body copy. `surfaceAccent` is not one: it is the lightest,
 * most saturated dark step, used for borders and image wells, so it gets the
 * narrower `ACCENT_GROUND_INKS` rule below instead.
 */
const TEXT_GROUNDS = ['surfaceBase', 'surfaceCard', 'surfaceRaised', 'surfaceTint'];
const INKS = ['textPrimary', 'textSecondary', 'textTertiary'];
/**
 * On Kinetic Depth, `textTertiary` lands at 3.82:1 on `surfaceAccent`. Neither
 * value can move — lifting the ink to clear it pushes tertiary to 6.17:1 on the
 * card and collapses it into `textSecondary`, and darkening the surface drops its
 * seam against `surfaceRaised` to 1.03x, which is invisible. So it is a
 * border-and-well surface that takes primary or secondary ink only.
 */
const ACCENT_GROUND_INKS = ['textPrimary', 'textSecondary'];

/** Token groups whose members are shown side by side and must stay tellable apart. */
const LEGENDS = {
  'macros.*': ['macros.protein.text', 'macros.carbs.text', 'macros.fat.text', 'macros.fiber.text'],
  'avatar.*': [
    'avatar.emerald',
    'avatar.blue',
    'avatar.purple',
    'avatar.pink',
    'avatar.orange',
    'avatar.teal',
    'avatar.yellow',
    'avatar.indigo',
  ],
  'status.*': [
    'status.success',
    'status.warning',
    'status.error',
    'status.info',
    'status.purple',
    'status.amber',
    'status.indigo',
    'status.pink',
    'status.rose',
  ],
};

/**
 * Hue words a semantic key may carry. A hue-named key has to keep that hue in every
 * theme: `status.emerald` was emerald on Kinetic Depth and pink on Kinetic Shock, and
 * that divergence — not the absolute angle — is what makes the name a lie. So the rule
 * is comparative, and needs no hand-tuned colour ranges.
 */
const HUE_WORDS = [
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'emerald',
  'mint',
  'teal',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
];
/** Keyed by the persisted AvatarColor enum rather than by palette role. */
const ENUM_KEYED = new Set(['avatar', 'avatarBg']);
/** Hue is meaningless below this chroma, so those tokens are compared on chroma instead. */
const MIN_NAMEABLE_CHROMA = 8;
/** Two hues this far apart are different colours by any name. */
const MAX_HUE_DRIFT = 40;

function at(tree, path) {
  return path.split('.').reduce((node, key) => node[key], tree);
}

/** WCAG contrast ratio. One implementation, so no caller hand-rolls sRGB luminance. */
function contrast(first, second) {
  return chroma.contrast(first, second);
}

function checkLadder(palette) {
  const found = [];
  for (let step = 1; step < LADDER.length; step += 1) {
    const ratio = contrast(palette[LADDER[step - 1]], palette[LADDER[step]]);
    if (ratio < MIN_SEAM) {
      found.push(`invisible seam  ${ratio.toFixed(2)}x  ${LADDER[step - 1]} -> ${LADDER[step]}`);
    }
  }
  return found;
}

function checkInk(palette) {
  const found = [];
  const below = (ink, ground) => {
    const ratio = contrast(palette[ink], palette[ground]);
    if (ratio < AA_NORMAL) {
      found.push(`below AA        ${ratio.toFixed(2)}:1  ${ink} on ${ground}`);
    }
  };

  for (const ink of INKS) {
    for (const ground of TEXT_GROUNDS) {
      below(ink, ground);
    }
  }
  for (const ink of ACCENT_GROUND_INKS) {
    below(ink, 'surfaceAccent');
  }
  below('inkOnAccent', 'brandPrimary');

  return found;
}

/**
 * The Daily Summary card's ink against the gradient it is actually printed on.
 *
 * A theme chooses that card's presentation entirely through its gradient stops —
 * Kinetic Light collapses them to a flat card surface, the dark palettes keep a
 * saturated sweep — so this is what makes the choice safe without a
 * component-level flag.
 *
 * This is deliberately NOT an AA rule. The card is display type over a decorative
 * sweep, and white on the emerald end of Kinetic Depth has always been 2.54:1.
 * What matters is that the ink stays on ONE side of the whole gradient: a theme
 * whose stops brighten while its ink stays white is unreadable at one end, which
 * is exactly the defect Kinetic Volt had to hand-patch with `colorfulCardInk`.
 */
function checkColorfulCard(themeColors) {
  const found = [];
  const stops = themeColors.gradients.colorfulCard;

  for (const [name, ink] of [
    ['ink', themeColors.colorfulCard.ink],
    ['ink70', themeColors.colorfulCard.ink70],
  ]) {
    const inkLuminance = chroma(ink).luminance();
    const luminances = stops.map((stop) => chroma(stop).luminance());
    if (
      !luminances.every((stop) => stop < inkLuminance) &&
      !luminances.every((stop) => stop > inkLuminance)
    ) {
      found.push(
        `ink inside sweep  colorfulCard.${name} (${ink}) is lighter than some gradient stops and darker than others`
      );
      continue;
    }

    stops.forEach((stop, index) => {
      const ratio = contrast(ink, stop);
      if (ratio < MIN_CARD_INK_SEPARATION) {
        found.push(
          `card ink too close  ${ratio.toFixed(2)}:1  colorfulCard.${name} on gradient stop ${index} (${stop})`
        );
      }
    });
  }

  return found;
}

function checkLegends(themeColors) {
  const found = [];
  for (const [set, paths] of Object.entries(LEGENDS)) {
    for (let i = 0; i < paths.length; i += 1) {
      for (let j = i + 1; j < paths.length; j += 1) {
        const first = at(themeColors, paths[i]);
        const second = at(themeColors, paths[j]);
        const delta = chroma.deltaE(first, second);
        if (delta < MIN_DELTA_E) {
          const label = delta < 1 ? 'same colour   ' : 'confusable    ';
          const name = (path) => path.split('.').slice(1).join('.');
          found.push(
            `${label}  dE ${delta.toFixed(2).padStart(5)}  ${set}  ${name(paths[i])} ${first} / ${name(paths[j])} ${second}`
          );
        }
      }
    }
  }
  return found;
}

/** Every hue-named leaf of the semantic tree, as `path -> hue word`. */
function hueNamedTokens(themeColors) {
  const found = new Map();

  const walk = (node, path) => {
    for (const [key, value] of Object.entries(node)) {
      const here = path ? `${path}.${key}` : key;
      if (ENUM_KEYED.has(here)) {
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value, here);
      } else if (typeof value === 'string' && chroma.valid(value)) {
        const word = HUE_WORDS.find((hue) => key.toLowerCase().includes(hue));
        if (word) {
          found.set(here, word);
        }
      }
    }
  };

  walk(themeColors, '');
  return found;
}

/**
 * A hue word followed by a Tailwind scale step — `teal400`, `indigo600`. Semantic
 * keys name the role they resolve to, so a key carrying someone else's scale is
 * stale by construction. Two-digit suffixes are opacity percentages (`amber10`).
 */
const STALE_HUE_KEY = new RegExp(`^(gray|zinc|slate|${HUE_WORDS.join('|')})\\d{3}`);

/** Semantic keys still named after a Tailwind hue-and-step. */
function checkStaleHueKeys() {
  const found = [];
  const [referenceId] = THEME_IDS;

  for (const [group, tokens] of Object.entries(themeColorsById[referenceId])) {
    if (ENUM_KEYED.has(group) || typeof tokens !== 'object' || Array.isArray(tokens)) {
      continue;
    }
    for (const key of Object.keys(tokens)) {
      if (STALE_HUE_KEY.test(key)) {
        found.push(`stale hue name    ${group}.${key} is named after a Tailwind hue and step`);
      }
    }
  }

  return found;
}

/** Circular distance between two LCh hue angles, in degrees. */
function hueDistance(first, second) {
  const raw = Math.abs(first - second) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function checkHueNames() {
  const found = [];
  const [referenceId, ...otherIds] = THEME_IDS;
  const reference = themeColorsById[referenceId];

  for (const [path, word] of hueNamedTokens(reference)) {
    const read = (themeId) => chroma(at(themeColorsById[themeId], path)).lch();
    const [, referenceChroma, referenceHue] = read(referenceId);

    for (const themeId of otherIds) {
      const [, themeChroma, themeHue] = read(themeId);
      // A token that goes grey in one theme cannot carry a hue word either.
      if (referenceChroma < MIN_NAMEABLE_CHROMA || themeChroma < MIN_NAMEABLE_CHROMA) {
        found.push(`stale hue name    ${path} is named "${word}" but has no hue on ${themeId}`);
        break;
      }
      const drift = hueDistance(referenceHue, themeHue);
      if (drift > MAX_HUE_DRIFT) {
        found.push(
          `stale hue name    ${path} is named "${word}" but swings ${Math.round(drift)} degrees between ${referenceId} and ${themeId}`
        );
        break;
      }
    }
  }

  return found;
}

/** Every problem for one theme. */
function auditTheme(themeId) {
  const { palette } = THEME_DEFINITIONS[themeId];
  const themeColors = themeColorsById[themeId];

  return [
    ...checkLadder(palette),
    ...checkInk(palette),
    ...checkColorfulCard(themeColors),
    ...checkLegends(themeColors),
  ];
}

/**
 * Every problem across every theme, as flat `themeId: problem` lines. An empty
 * array means the palettes are sound — this is what CI asserts.
 */
function auditThemes() {
  const collapse = (line) => line.replace(/\s{2,}/g, ' ');

  return [
    ...THEME_IDS.flatMap((themeId) =>
      auditTheme(themeId).map((problem) => `${themeId}: ${collapse(problem)}`)
    ),
    ...checkHueNames().map(collapse),
    ...checkStaleHueKeys().map(collapse),
  ];
}

module.exports = {
  AA_NORMAL,
  MIN_CARD_INK_SEPARATION,
  auditTheme,
  auditThemes,
  checkHueNames,
  checkStaleHueKeys,
  contrast,
  MIN_DELTA_E,
  MIN_SEAM,
};
