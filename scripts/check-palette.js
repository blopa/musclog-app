/**
 * Prints the palette audit for the named themes.
 *
 * The rules themselves live in `theme.audit.js`, which is also what CI asserts
 * through `utils/__tests__/themeSelection.test.ts` — this file is only the
 * human-readable report.
 *
 *   node scripts/check-palette.js          full report, exits non-zero on a failure
 *   node scripts/check-palette.js --quiet  failures only
 */
const { auditTheme, checkHueNames, checkStaleHueKeys } = require('../theme.audit');
const { THEME_IDS } = require('../theme.registry');

const quiet = process.argv.includes('--quiet');
let failures = 0;

for (const themeId of THEME_IDS) {
  const problems = auditTheme(themeId);

  if (!quiet || problems.length) {
    console.log(`\n${themeId}`);
  }
  for (const problem of problems) {
    console.log(`  ${problem}`);
  }
  if (!problems.length && !quiet) {
    console.log('  ok  every seam visible, all ink at AA, no confusable pair in a shared legend');
  }
  failures += problems.length;
}

const hueNames = [...checkHueNames(), ...checkStaleHueKeys()];
if (hueNames.length || !quiet) {
  console.log('\nnaming (compared across all themes)');
}
for (const problem of hueNames) {
  console.log(`  ${problem}`);
}
if (!hueNames.length && !quiet) {
  console.log(`  ok  every hue-named token keeps its hue in all ${THEME_IDS.length} themes`);
}
failures += hueNames.length;

if (failures) {
  console.error(`\n${failures} palette problem(s) across ${THEME_IDS.length} themes.`);
  process.exit(1);
}

if (!quiet) {
  console.log(`\nAll ${THEME_IDS.length} themes pass.`);
}
