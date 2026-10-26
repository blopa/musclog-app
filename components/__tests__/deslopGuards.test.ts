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
    '%s fills every variant flat, from the shared size table',
    (path) => {
      const source = stripComments(readFileSync(join(root, path), 'utf8'));
      expect(source).not.toMatch(/gradients\.(accent|cta|button)\b|linear-gradient|LinearGradient/);
      expect(source).not.toMatch(/borderRadius\[['"]2xl['"]\]|borderRadius\.xl\b/);
      expect(source).toMatch(/getButtonMetrics\(theme\)/);
    }
  );

  it('keeps gradientCta, the one primary action per screen, from spreading', () => {
    expect(total(occurrences(/gradientCta/))).toBeLessThanOrEqual(GRADIENT_CTA_CEILING);
  });

  it('draws ActionButton on the control radius', () => {
    const source = stripComments(readFileSync(join(root, 'components/ActionButton.tsx'), 'utf8'));
    expect(source).toMatch(/\brounded-control\b/);
  });
});

/**
 * Phase 2: gradients only where they carry meaning. A file may draw a `LinearGradient` when it is a
 * photo or camera scrim, a fade to the surface behind it, the `hero` card, a slider track, or the
 * one `gradientCta` button. Adding a file here needs a reason.
 */
const LINEAR_GRADIENT_ALLOWLIST = [
  'components/BottomButtonWrapper.tsx',
  'components/ExerciseTransitionScreen.tsx',
  'components/FilterTabs.tsx',
  'components/SmartCameraFrame.tsx',
  'components/cards/ChatWorkoutCard.tsx',
  'components/cards/DetailedItemCard.tsx',
  'components/cards/FoodNutritionSectionCard.tsx',
  'components/cards/GenericCard.tsx',
  'components/modals/ExerciseGoalCreationModal.tsx',
  'components/modals/SmartCameraShell.tsx',
  'components/modals/ViewExerciseModal.tsx',
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

const localeDir = (locale: string) => join(root, 'lang/locales', locale);

/** Every string in a locale (website copy excluded), keyed `file:dotted.path`. */
function localeStrings(locale: string): [string, string][] {
  const out: [string, string][] = [];
  const walk = (node: unknown, key: string) => {
    if (typeof node === 'string') {
      out.push([key, node]);
    } else if (node && typeof node === 'object') {
      for (const [child, value] of Object.entries(node)) {
        walk(value, key.endsWith(':') ? `${key}${child}` : `${key}.${child}`);
      }
    }
  };
  for (const name of readdirSync(localeDir(locale))) {
    if (name.endsWith('.json') && name !== 'website.json') {
      walk(JSON.parse(readFileSync(join(localeDir(locale), name), 'utf8')), `${name}:`);
    }
  }

  return out;
}

const LOCALES = ['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'];

describe('Phase 5: Home and the hero surfaces', () => {
  it('draws the home action tile without a watermark or a tinted icon circle', () => {
    const source = stripComments(readFileSync(join(root, 'components/ActionButton.tsx'), 'utf8'));
    expect(source).not.toMatch(/\babsolute\b|position:\s*['"]absolute['"]/);
    expect(source).not.toMatch(/iconSize\.background|iconBgColor|rounded-full/);
  });

  it('opens Home on the date, not a greeting or the version string', () => {
    const home = stripComments(readFileSync(join(root, 'app/app/index.tsx'), 'utf8'));
    expect(home).not.toMatch(/home\.greeting|getTimeBasedGreeting|packageJson/);
    for (const locale of LOCALES) {
      const keys = localeStrings(locale).map(([key]) => key);
      expect(keys.filter((key) => key.startsWith('home.json:home.greeting'))).toEqual([]);
    }
  });

  it('shows the compact Weekly Review card on Home only while a review is waiting', () => {
    const home = stripComments(readFileSync(join(root, 'app/app/index.tsx'), 'utf8'));
    expect(home).toMatch(/<WeeklyReviewCard compact quietUntilReady \/>/);
  });

  it('shows the cycle day once, inside the wheel', () => {
    const cycle = stripComments(readFileSync(join(root, 'app/app/cycle.tsx'), 'utf8'));
    expect(cycle).not.toMatch(/dayCounter|focus\.currentPhase/);
  });
});

/**
 * Phase 6: motion and decoration have to carry information. The two loops left are progress
 * spinners (rotation, on the native driver); TextInput's border colour cannot use the native
 * driver, which is why it is the one JS-driven animation.
 */
const ANIMATED_LOOP_ALLOWLIST = [
  'app/app/workout/rest-timer.tsx',
  'components/CameraProcessingIndicator.tsx',
];

describe('Phase 6: empty states, illustrations and decorative motion', () => {
  it('runs no infinite animation outside the allowlisted spinners', () => {
    const offenders = occurrences(/Animated\.loop\(|withRepeat\(/g)
      .map((hit) => hit.file)
      .filter(
        (file) =>
          !ANIMATED_LOOP_ALLOWLIST.includes(file) &&
          file !== 'components/theme/SkeletonLoader.tsx' &&
          // The viewfinder's scan line is the camera's own feedback, out of the plan's scope.
          file !== 'components/SmartCameraFrame.tsx'
      );
    expect(offenders).toEqual([]);
  });

  it('drives animations on the native thread except for TextInput colour', () => {
    const offenders = occurrences(/useNativeDriver:\s*false/g)
      .map((hit) => hit.file)
      .filter((file) => file !== 'components/theme/TextInput.tsx');
    expect(offenders).toEqual([]);
  });

  it('draws no blurred glow blobs', () => {
    expect(occurrences(/\bblur-3xl\b|filter:\s*['"]blur\(/g)).toEqual([]);
  });

  it('keeps the onboarding landing free of background shapes', () => {
    const landing = stripComments(
      readFileSync(join(root, 'app/app/onboarding/landing.tsx'), 'utf8')
    );
    expect(landing).not.toMatch(/rounded-full opacity|SCREEN_WIDTH|SCREEN_HEIGHT|\bStar\b/);
  });

  it('draws the empty state icon plainly with a secondary button by default', () => {
    const source = stripComments(
      readFileSync(join(root, 'components/theme/EmptyStateCard.tsx'), 'utf8')
    );
    expect(source).not.toMatch(/\bh-40\b|\bw-40\b|accent\.primary10/);
    expect(source).toMatch(/buttonVariant = 'secondary'/);
  });
});

/** Placeholders that ARE a dash: an empty pace and the "not logged" mark in the cycle legends. */
const EM_DASH_ALLOWLIST = [
  'cardio.json:cardio.noPace',
  'cycle.json:cycle.comparison.flowLegend',
  'cycle.json:cycle.comparison.symptomLegend',
  'cycle.json:cycle.comparison.numberLegend',
];
/** The two goal-achieved celebrations; everything else reads flat. */
const EXCLAMATION_CEILING = 2;
/** Sparkles means AI. Every file here draws it on an AI affordance only. */
const SPARKLES_ALLOWLIST = [
  'app/app/nutrition/food.tsx',
  'app/app/onboarding/musclog-api.tsx',
  'components/SmartCameraModePicker.tsx',
  'components/modals/AINotConfiguredModal.tsx',
  'components/modals/AINutritionTrackingContextModal.tsx',
  'components/modals/AddFoodModal.tsx',
  'components/modals/AddMealModal.tsx',
  'components/modals/CreateWorkoutModal.tsx',
  'components/modals/CreateWorkoutOptionsModal.tsx',
  'components/modals/GenerateWorkoutWithAiModal.tsx',
  'components/modals/NotificationsModal.tsx',
  'components/modals/SmartCameraShell.tsx',
];
/** Proper nouns that keep their capitals inside a sentence-case label. */
const PROPER_NOUNS =
  /\b(Health Connect|Apple( Health| Intelligence)?|Open Food Facts|Foundation Foods|Weekly Review|Kinetic \w+|Game Boy|Gemini|Google|OpenAI|HealthKit|Musclog|Loggy|Monday|Smith|Discord|GitHub|NHS|Keiser|Tonal)\b/g;
const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'by',
  'with',
  'at',
  'from',
  'vs',
  'per',
  'your',
  'my',
]);

describe('Phase 7: copy', () => {
  it('writes no em dash in en-us copy outside the placeholders', () => {
    const dashes = localeStrings('en-us')
      .filter(([key, value]) => value.includes('—') && !EM_DASH_ALLOWLIST.includes(key))
      .map(([key]) => key);
    expect(dashes).toEqual([]);
  });

  it('keeps exclamation marks for real celebrations', () => {
    const shouting = localeStrings('en-us').filter(([, value]) => value.trimEnd().endsWith('!'));
    expect(shouting.length).toBeLessThanOrEqual(EXCLAMATION_CEILING);
  });

  it('sets short en-us labels in sentence case', () => {
    const titleCase = localeStrings('en-us')
      .filter(([, value]) => {
        if (/[.!?]\s/.test(value) || (value.includes('{{') && value.length > 60)) {
          return false;
        }
        const words = value.replace(PROPER_NOUNS, '').match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
        const all = value.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
        if (all.length < 2 || all.length > 7) {
          return false;
        }
        const rest = words.slice(value.startsWith(words[0] ?? '') ? 1 : 0);
        const capitalised = rest.filter(
          (word) =>
            /^[A-Z][a-z]/.test(word) &&
            !/[A-Z]/.test(word.slice(1)) &&
            !SMALL_WORDS.has(word.toLowerCase()) &&
            !/ - /.test(value)
        );
        const lower = rest.filter((word) => /^[a-z]/.test(word) && !SMALL_WORDS.has(word));
        return capitalised.length > 0 && lower.length === 0;
      })
      .map(([key, value]) => `${key} = ${value}`);
    expect(titleCase).toEqual([]);
  });

  it('uses Sparkles only on AI affordances', () => {
    const offenders = occurrences(/\bSparkles\b/g)
      .map((hit) => hit.file)
      .filter((file) => !SPARKLES_ALLOWLIST.includes(file));
    expect(offenders).toEqual([]);
  });
});

/**
 * Phase 8: one header component. Every screen says what it is and, when it was reached from
 * somewhere, how to get back, in the same place and style. A screen that shows the bottom bar
 * names its `destination`, so the header knows when the bar already answers "where am I".
 */
describe('Phase 8: screen headers and wayfinding', () => {
  const SCREENS: [string, string | null, string | null][] = [
    // [route file, destination it names (null: hides the bar), lockArea it passes (null: ungated)]
    ['app/app/settings.tsx', null, null],
    ['app/app/progress.tsx', null, '"progress"'],
    ['app/app/profile.tsx', 'profile', null],
    ['app/app/notes.tsx', 'notes', null],
    ['app/app/cycle.tsx', 'cycle', '"cycle"'],
    ['app/app/weekly-review.tsx', 'checkin', '{WEEKLY_REVIEW_LOCK_AREAS}'],
    ['app/app/workout/workouts.tsx', 'workouts', '"workout"'],
    ['app/app/nutrition/food.tsx', 'food', '"nutrition"'],
  ];

  it.each(SCREENS)('%s renders ScreenHeader', (file, destination, lockArea) => {
    const source = stripComments(readFileSync(join(root, file), 'utf8'));
    expect(source.match(/<ScreenHeader\b/g)).toHaveLength(1);
    if (destination) {
      expect(source).toContain(`destination="${destination}"`);
    } else {
      expect(source).not.toMatch(/\bdestination=/);
    }

    if (lockArea) {
      // Outside the gate, so the way back works behind the lock, and told which area it holds.
      expect(source).toContain(`lockArea=${lockArea}`);
      expect(source.indexOf('<ScreenHeader')).toBeLessThan(source.indexOf('<AreaLockGate'));
    }
  });

  it.each(SCREENS)('%s hand-rolls no screen title or back button', (file) => {
    const source = stripComments(readFileSync(join(root, file), 'utf8'));
    expect(source).not.toMatch(/\btext-4xl\b|fontSize\['4xl'\]|\bArrowLeft\b/);
  });

  it('no screen turns the native stack header back on', () => {
    expect(occurrences(/headerShown:\s*true/g)).toEqual([]);
  });
});

/**
 * Phase 9: lists whose length is not bounded are virtualized and page on scroll. These screens
 * once rendered `ScrollView` + `.map()` with a "Load more" button.
 */
describe('virtualized paginated lists', () => {
  const VIRTUALIZED: [string, string][] = [
    ['components/modals/PastWorkoutsHistoryModal.tsx', 'SectionList'],
    ['components/modals/BodyMetricsHistoryModal.tsx', 'FlatList'],
    ['components/modals/MyMealsModal.tsx', 'FlatList'],
    ['components/modals/FoodSearchModal.tsx', 'FlatList'],
  ];

  it.each(VIRTUALIZED)('%s renders a %s that loads the next page on scroll', (file, list) => {
    const source = readFileSync(join(root, file), 'utf8');
    expect(source).toContain(`<${list}`);
    expect(source).toContain('onEndReached=');
    // A horizontal ScrollView (a tab bar) holds a handful of items; a vertical one is the list.
    expect(source.match(/<ScrollView\b(?![^>]*\bhorizontal\b)/g)).toBeNull();
    expect(source).not.toMatch(/Button[^>]*onPress=\{loadMore\w*\}/);
  });

  it('pages the food search tail on scroll and offers "show more" only above it', () => {
    const rows = readFileSync(join(root, 'components/modals/foodSearchRows.ts'), 'utf8');
    expect(rows).not.toMatch(/from 'react-native'/);
    expect(rows).not.toMatch(/loadMoreFavorites|loadMoreMeals/);
  });
});

/**
 * Phase 10: geometry and type. Radii are named by role (`theme.shape.js`), the weight ladder stops
 * at bold, and no app text is squeezed with negative tracking. Each rule is held at zero.
 */
describe('Phase 10: geometry and type', () => {
  it('rounds only by role: tag, inner, control, card, sheet or full', () => {
    // Size-named radii are rem-based, so they rendered at one size on native and another on web.
    expect(
      occurrences(
        /(?<=["'`\s])-?rounded(?:-(?:t|b|l|r|tl|tr|bl|br))?(?:-(?:sm|md|lg|xl|2xl|3xl))?(?=["'`\s])/g
      )
    ).toEqual([]);
  });

  it('keeps the theme radius tokens on the shared scale', () => {
    const shape = readFileSync(join(root, 'theme.shape.js'), 'utf8');
    const tailwind = readFileSync(join(root, 'tailwind.config.js'), 'utf8');
    expect(shape).toMatch(/control:\s*8\b/);
    expect(shape).toMatch(/card:\s*12\b/);
    expect(tailwind).toMatch(/require\('\.\/theme\.shape'\)/);
  });

  it('never sets text heavier than bold', () => {
    expect(
      occurrences(
        /\bfont-(black|extrabold)\b|fontWeight\.(black|extrabold)\b|fontWeight:\s*['"](800|900)['"]/g
      )
    ).toEqual([]);
  });

  it('sets small text at most semibold', () => {
    const smallBold =
      /["'`][^"'`\n]*\btext-(xs|sm|base)\b[^"'`\n]*\bfont-bold\b|["'`][^"'`\n]*\bfont-bold\b[^"'`\n]*\btext-(xs|sm|base)\b/g;
    expect(occurrences(smallBold)).toEqual([]);
  });

  it('squeezes no text with negative letter-spacing', () => {
    expect(occurrences(/\btracking-tight(er)?\b|letterSpacing\.tight\b/g)).toEqual([]);
  });

  it('draws cards without a drop shadow', () => {
    const surface = stripComments(
      readFileSync(join(root, 'components/cards/cardSurface.ts'), 'utf8')
    );
    expect(surface).not.toMatch(/shadow/);
  });

  it('counts down with tabular figures, so a ticking clock does not shift sideways', () => {
    for (const file of [
      'components/workout/session/RestTimerBar.tsx',
      'components/workout/session/WorkTimerBar.tsx',
      'components/RestTimer.tsx',
    ]) {
      expect(readFileSync(join(root, file), 'utf8')).toMatch(/tabular-nums/);
    }
  });
});
