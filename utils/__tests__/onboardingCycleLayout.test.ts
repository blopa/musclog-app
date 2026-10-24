import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('cycle setup onboarding spacing', () => {
  it('separates the unknown-length option from the numeric inputs', () => {
    const source = readFileSync(join(__dirname, '../../components/EditCycleSetupData.tsx'), 'utf8');

    expect(source).toMatch(
      /<Chip\s+label=\{t\('cycle\.complete\.unknownLength'\)\}[\s\S]*?\/>\s*<View className="mt-3 flex-row gap-4">\s*<NumericInput/
    );
  });

  it('pads the entire form inside the keyboard-aware scroll view', () => {
    const source = readFileSync(
      join(__dirname, '../../app/app/onboarding/cycle-setup.tsx'),
      'utf8'
    );
    const scrollContent = source.match(
      /<KeyboardAwareScrollView\b[^>]*>([\s\S]*?)<\/KeyboardAwareScrollView>/
    )?.[1];

    // KeyboardAwareScrollView does not apply NativeWind padding reliably.
    // Keep every section, including the footer spacer, inside a padded RN View.
    expect(scrollContent).toMatch(/^\s*<View className="px-6 pt-8">/);
    expect(scrollContent).toContain("t('onboarding.cycleSetup.title')");
    expect(scrollContent).toContain('<EditCycleSetupData');
    expect(scrollContent).toContain("t('onboarding.cycleSetup.pastPeriods.title')");
    expect(scrollContent).toMatch(/<View pointerEvents="none"[^>]*\/>\s*<\/View>\s*$/);
  });
});
