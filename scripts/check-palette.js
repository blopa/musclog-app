/**
 * Palette guard for the four Kinetic themes.
 *
 * The palette was consolidated from 57 primaries to 23 because the extra tokens
 * carried no visual information: some were byte-identical, most sat inside the
 * just-noticeable-difference threshold of a neighbour, and the surface "ladder"
 * had nine of twelve steps below 1.10x contrast — invisible on any display.
 *
 * This keeps that from growing back. It reads the live registry rather than a
 * copied list of hexes, so it cannot drift from what the app renders, and it
 * checks every named theme rather than the one someone happened to be looking at.
 *
 *   node scripts/check-palette.js          full report, exits non-zero on a failure
 *   node scripts/check-palette.js --quiet  failures only
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

const { THEME_DEFINITIONS, THEME_IDS } = require('../theme.registry');
const { themeColorsById } = require('../theme.tokens');

/** Under dE 5 a viewer will not name two colours as different. */
const MIN_DELTA_E = 5.0;
/** Below 1.05x a surface seam does not render on any display. */
const MIN_SEAM = 1.05;
const AA_NORMAL = 4.5;

/** Neutral ladder, base upward. The tinted branch separates on chroma, not lightness. */
const LADDER = ['surfaceBase', 'surfaceCard', 'surfaceRaised', 'borderHairline'];
/**
 * Surfaces that carry body copy. `surfaceAccent` is not one: it is the lightest,
 * most saturated dark step, used for borders and image wells, and takes primary or
 * secondary ink only (asserted in utils/__tests__/themeSelection.test.ts).
 */
const TEXT_GROUNDS = ['surfaceBase', 'surfaceCard', 'surfaceRaised', 'surfaceTint'];
const INKS = ['textPrimary', 'textSecondary', 'textTertiary'];

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

const quiet = process.argv.includes('--quiet');
const failures = [];

function at(tree, path) {
  return path.split('.').reduce((node, key) => node[key], tree);
}

function checkLadder(palette) {
  const found = [];
  for (let step = 1; step < LADDER.length; step += 1) {
    const ratio = chroma.contrast(palette[LADDER[step - 1]], palette[LADDER[step]]);
    if (ratio < MIN_SEAM) {
      found.push(`invisible seam  ${ratio.toFixed(2)}x  ${LADDER[step - 1]} -> ${LADDER[step]}`);
    }
  }
  return found;
}

function checkInk(palette) {
  const found = [];
  for (const ink of INKS) {
    for (const ground of TEXT_GROUNDS) {
      const ratio = chroma.contrast(palette[ink], palette[ground]);
      if (ratio < AA_NORMAL) {
        found.push(`below AA        ${ratio.toFixed(2)}:1  ${ink} on ${ground}`);
      }
    }
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

for (const themeId of THEME_IDS) {
  const { palette } = THEME_DEFINITIONS[themeId];
  const problems = [
    ...checkLadder(palette),
    ...checkInk(palette),
    ...checkLegends(themeColorsById[themeId]),
  ];

  if (!quiet || problems.length) {
    console.log(`\n${themeId}`);
  }
  for (const problem of problems) {
    console.log(`  ${problem}`);
    failures.push(`${themeId}: ${problem.replace(/\s{2,}/g, ' ')}`);
  }
  if (!problems.length && !quiet) {
    console.log('  ok  every seam visible, all ink at AA, no confusable pair in a shared legend');
  }
}

const hueNames = checkHueNames();
if (hueNames.length || !quiet) {
  console.log('\nnaming (compared across all themes)');
}
for (const problem of hueNames) {
  console.log(`  ${problem}`);
  failures.push(problem.replace(/\s{2,}/g, ' '));
}
if (!hueNames.length && !quiet) {
  console.log('  ok  every hue-named token keeps its hue in all four themes');
}

if (failures.length) {
  console.error(`\n${failures.length} palette problem(s) across ${THEME_IDS.length} themes.`);
  process.exit(1);
}

if (!quiet) {
  console.log(`\nAll ${THEME_IDS.length} themes pass.`);
}
