import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The dev seeder pulls in the whole database layer, so this reads its source rather than running
 * it. It pins that the water prompt is switched off only behind the screenshot-build flag.
 */
describe('dev seeder screenshot mode', () => {
  const source = readFileSync(join(__dirname, '..', 'seeders', 'dev.ts'), 'utf8');

  it('disables the daily water prompt only when EXPO_PUBLIC_SCREENSHOT_MODE is 1', () => {
    const guarded = source.match(
      /if \(process\.env\.EXPO_PUBLIC_SCREENSHOT_MODE === '1'\) \{\s*await SettingsService\.setShowDailyWaterPrompt\(false\);\s*\}/
    );

    expect(guarded).not.toBeNull();
    expect(source.match(/setShowDailyWaterPrompt\(/g)).toHaveLength(1);
  });
});
