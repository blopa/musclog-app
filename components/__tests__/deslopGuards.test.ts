import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Ratchets for the de-slop plan (`doc/redesign/DESLOP_PLAN.md`). Like `themeControls.test.ts`
 * these read source, because the rules are about what the components declare. A ceiling can only
 * go DOWN: lower it in the same change that removes the last offender, never raise it to make a
 * regression pass.
 */
const root = join(__dirname, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (
      rel === 'components/website' ||
      rel === 'app/(website)' ||
      rel === 'app/app/test' ||
      name === '__tests__' ||
      name === 'node_modules'
    ) {
      continue;
    }

    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }

  return out;
}

const appFiles = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'components'))];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every file in the app and components whose code matches `pattern`, with the match count. */
function occurrences(pattern: RegExp): { file: string; count: number }[] {
  const hits: { file: string; count: number }[] = [];
  for (const file of appFiles) {
    const count = stripComments(readFileSync(file, 'utf8')).match(pattern)?.length ?? 0;
    if (count > 0) {
      hits.push({ file: relative(root, file).replace(/\\/g, '/'), count });
    }
  }

  return hits;
}

/** Measured when Phase 1 shipped (was 79 before three Home prompts and one empty state were demoted). */
const GRADIENT_CTA_CEILING = 73;

const total = (hits: { count: number }[]) => hits.reduce((sum, hit) => sum + hit.count, 0);

describe('Phase 1: buttons and shape', () => {
  it('has no colored glow shadows', () => {
    expect(occurrences(/shadows\.(accentGlow|accentGlowLarge|roseGlow)\b/)).toEqual([]);
  });

  it('does not define the glow shadows in the theme either', () => {
    const theme = readFileSync(join(root, 'theme.ts'), 'utf8');
    expect(theme).not.toMatch(/\b(accentGlow|accentGlowLarge|roseGlow)\b/);
  });

  it.each(['components/theme/Button.tsx', 'components/theme/Button.web.tsx'])(
    '%s sets no letter-spacing on its label',
    (path) => {
      const source = stripComments(readFileSync(join(root, path), 'utf8'));
      expect(source).not.toMatch(/\btracking-/);
      expect(source).not.toMatch(/letterSpacing\s*:\s*['"]/);
    }
  );

  it.each(['components/theme/Button.tsx', 'components/theme/Button.web.tsx'])(
    '%s fills `accent` solid and keeps the gradient for gradientCta',
    (path) => {
      const source = stripComments(readFileSync(join(root, path), 'utf8'));
      expect(source).not.toMatch(/gradients\.accent\b/);
      expect(source).not.toMatch(/borderRadius\[['"]2xl['"]\]|borderRadius\.xl\b/);
    }
  );

  it('keeps rounded-3xl from spreading (target 0)', () => {
    expect(total(occurrences(/\brounded-3xl\b/))).toBeLessThanOrEqual(6);
  });

  it('keeps gradientCta, the one primary action per screen, from spreading', () => {
    expect(total(occurrences(/gradientCta/))).toBeLessThanOrEqual(GRADIENT_CTA_CEILING);
  });

  it('draws ActionButton on the 16px card radius', () => {
    const source = stripComments(readFileSync(join(root, 'components/ActionButton.tsx'), 'utf8'));
    expect(source).not.toMatch(/\brounded-3xl\b/);
  });
});

/**
 * Phase 2: gradients only where they carry meaning. A file may draw a `LinearGradient` when it is a
 * photo or camera scrim, a fade to the surface behind it, the `hero` card, a slider track, or the
 * one `gradientCta` button. Adding a file here needs a reason, and the two illustrations are
 * scheduled for removal in Phase 6.
 */
const LINEAR_GRADIENT_ALLOWLIST = [
  'components/BottomButtonWrapper.tsx',
  'components/ExerciseTransitionScreen.tsx',
  'components/FilterTabs.tsx',
  'components/GoogleGeminiIllustration.tsx',
  'components/SmartCameraFrame.tsx',
  'components/cards/ChatWorkoutCard.tsx',
  'components/cards/DetailedItemCard.tsx',
  'components/cards/FoodNutritionSectionCard.tsx',
  'components/cards/GenericCard.tsx',
  'components/modals/ExerciseGoalCreationModal.tsx',
  'components/modals/SmartCameraShell.tsx',
  'components/modals/ViewExerciseModal.tsx',
  'components/theme/Button.tsx',
  'components/theme/Slider.tsx',
  'components/workout/session/ExerciseHeader.tsx',
  'components/workout/session/GuidedExerciseView.tsx',
];

describe('Phase 2: gradients and the indigo leak', () => {
  it('only allowlisted files draw a LinearGradient', () => {
    const offenders = occurrences(/from ['"]expo-linear-gradient['"]/)
      .map((hit) => hit.file)
      .filter((file) => !LINEAR_GRADIENT_ALLOWLIST.includes(file));
    expect(offenders).toEqual([]);
  });

  it('keeps gradients.cta inside components/theme/', () => {
    const offenders = occurrences(/gradients\.cta\b/).filter(
      (hit) => !hit.file.startsWith('components/theme/')
    );
    expect(offenders).toEqual([]);
  });

  it('builds the hero card ramp from the brand hue, never statusIndigo', () => {
    const tokens = readFileSync(join(root, 'theme.tokens.js'), 'utf8');
    const ramp = tokens.match(/colorfulCardStart:[\s\S]*?colorfulCardEnd:[^\n]*/)?.[0] ?? '';
    expect(ramp).not.toBe('');
    expect(ramp).not.toMatch(/statusIndigo/);
  });
});

/** A fixed 40-48px square or circle with a fill: the tinted icon chip. */
const ICON_CHIP = /\bh-1[0-2] w-1[0-2]\b[^"'`\n]*\brounded-[\w/]+[^"'`\n]*\bbg-/g;
/** Measured when Phase 3 shipped (was 43 by this pattern); what is left are close buttons, thumbnails and one-off badges. */
const ICON_CHIP_CEILING = 19;
/** What is left are `OptionsSelector`, `ToggleInput` and summary-stat chips, outside Phase 3's scope. */
const ICON_BG_COLOR_CEILING = 87;

describe('Phase 3: rows, menus and settings', () => {
  it('types iconBgColor on a menu item as never, so a leftover fails the build', () => {
    const menu = stripComments(readFileSync(join(root, 'components/BottomPopUpMenu.tsx'), 'utf8'));
    expect(menu.match(/iconBgColor/g)).toEqual(['iconBgColor']);
    expect(menu).toMatch(/iconBgColor\?: never;/);
  });

  it('keeps tinted icon backgrounds from spreading', () => {
    // Some theme colors are typed `any`, which `never` accepts, so the type alone is not enough.
    expect(total(occurrences(/\biconBgColor\b/g))).toBeLessThanOrEqual(ICON_BG_COLOR_CEILING);
  });

  it('does not wrap the menu list in a second padding (BottomPopUp already pads its content)', () => {
    const menu = stripComments(readFileSync(join(root, 'components/BottomPopUpMenu.tsx'), 'utf8'));
    expect(menu).not.toMatch(/className="p-6"/);
    // A menu list is the sheet: flush, full-bleed rows, never a rounded group inset in the sheet.
    expect(menu).toMatch(/<ListGroup flush>/);
  });

  it.each([
    'components/cards/SettingsCard.tsx',
    'components/ManagementItem.tsx',
    'components/TrackingMethodButton.tsx',
    'components/BottomPopUpMenu.tsx',
    'components/MealTypeButton.tsx',
  ])('%s draws no tinted icon container', (path) => {
    const source = stripComments(readFileSync(join(root, path), 'utf8'));
    expect(source).not.toMatch(/iconDarker|iconDark\b|secondaryDark|LinearGradient/);
    expect(source).not.toMatch(ICON_CHIP);
  });

  it('keeps the tinted icon chip from spreading', () => {
    expect(total(occurrences(ICON_CHIP))).toBeLessThanOrEqual(ICON_CHIP_CEILING);
  });
});

/**
 * Phase 4: tracked all-caps is reserved for unit and weekday abbreviations. A section label is
 * `SectionLabel` (sentence case, no tracking); a new `uppercase` or wide tracking class fails here.
 */
const UPPERCASE_CEILING = 0;
const WIDE_TRACKING_CEILING = 0;
/** All-caps en-us strings of four letters or more that are not acronyms (TDEE, USDA, ...). */
const ALL_CAPS_COPY_CEILING = 0;
const ACRONYMS = new Set([
  'FFMI',
  'TDEE',
  'USDA',
  'HIIT',
  'MUSCLOG',
  'AM',
  'PM',
  'YYYY',
  'MM',
  'DD',
]);

describe('Phase 4: labels and microtext', () => {
  it('keeps uppercase text from coming back', () => {
    expect(
      total(occurrences(/\buppercase\b|textTransform:\s*['"]uppercase['"]/g))
    ).toBeLessThanOrEqual(UPPERCASE_CEILING);
  });

  it('keeps wide letter-spacing from coming back', () => {
    expect(
      total(occurrences(/\btracking-(wide|wider|widest|\[[^\]]*\])(?=[\s"'`])/g))
    ).toBeLessThanOrEqual(WIDE_TRACKING_CEILING);
  });

  it.each(['components/theme/SectionLabel.tsx', 'components/StatStrip.tsx'])(
    '%s sets its label in sentence case without tracking',
    (path) => {
      const source = stripComments(readFileSync(join(root, path), 'utf8'));
      expect(source).not.toMatch(/\buppercase\b|\btracking-|letterSpacing/);
    }
  );

  it('does not write en-us copy in capitals', () => {
    const dir = join(root, 'lang/locales/en-us');
    const caps: string[] = [];
    const walk = (node: unknown, key: string) => {
      if (typeof node === 'string') {
        const letters = node.replace(/[^A-Za-z]/g, '');
        const words = node.match(/[A-Za-z]+/g) ?? [];
        const shouting = words.some((word) => !ACRONYMS.has(word));
        if (letters.length >= 4 && letters === letters.toUpperCase() && shouting) {
          caps.push(`${key} = ${node}`);
        }
      } else if (node && typeof node === 'object') {
        for (const [child, value] of Object.entries(node)) {
          walk(value, key ? `${key}.${child}` : child);
        }
      }
    };
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.json') && name !== 'website.json') {
        walk(JSON.parse(readFileSync(join(dir, name), 'utf8')), '');
      }
    }
    expect(caps.length).toBeLessThanOrEqual(ALL_CAPS_COPY_CEILING);
  });
});
