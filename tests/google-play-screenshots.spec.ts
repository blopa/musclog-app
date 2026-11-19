import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { DEFAULT_THEME_BY_MODE } from '../theme.registry';
import { clickTopmost, localeCopy } from './layoutAudit/flowKit';
import { selectAppLanguage } from './layoutAudit/language';
import { bundledLocales } from './layoutAudit/locales';
import {
  APP_URL,
  capture,
  installFixtureRoutes,
  navigateTo,
  seedDemoData,
  selectMetricUnits,
  selectTheme,
} from './helpers/screenshotSession';

// A project that sets `perLocale` captures every bundled locale into `<outputRoot>/<locale>` (the
// App Store's iPad set); the others capture English into `outputRoot` itself.
// The captured screens (`<project>/<name>.png`). The App Store's iPad config
// (`playwright.app-store-ipad.config.ts`) runs this same spec: its project names its own folder
// through the `outputRoot` metadata and `numbered`, which prefixes each file with its position in
// IPAD_ORDER (`01-home.png`), the form `scripts/appstore.sh screenshots from-captures` copies.
const GOOGLE_PLAY_OUTPUT_DIR = path.join('screenshots', 'google-play');
const IPAD_ORDER = ['home', 'workout', 'food', 'goals'];
// The workout the demo data holds that reads as a real session; the session's first exercise is
// the barbell squat.
const WORKOUT_NAME = 'Leg Day / Squats';

for (const locale of bundledLocales()) {
  test.describe(`Google Play screenshots (${locale})`, () => {
    // The browser stays en-US (demo seeding resolves exercises by their English names); the app
    // switches language through Settings, as the phone spec does.
    test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
    test.setTimeout(1800000);

    test(`Capture the tablet listing screens in ${locale}`, async ({ page }, testInfo) => {
      const { outputRoot, numbered, perLocale } = testInfo.project.metadata as {
        outputRoot?: string;
        numbered?: boolean;
        perLocale?: boolean;
      };
      test.skip(!perLocale && locale !== 'en-US', 'English only outside the per-locale projects');
      const copy = (file: string, keyPath: string[]) => localeCopy(locale, file, keyPath, '');
      const root = outputRoot ?? path.join(GOOGLE_PLAY_OUTPUT_DIR, testInfo.project.name);
      const outputDir = perLocale ? path.join(root, locale) : root;
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.mkdirSync(outputDir, { recursive: true });
      const fileName = (name: string) =>
        numbered ? `${String(IPAD_ORDER.indexOf(name) + 1).padStart(2, '0')}-${name}` : name;
      const shot = (name: string, waitTime?: number) =>
        capture(page, path.join(outputDir, `${fileName(name)}.png`), waitTime);

      await installFixtureRoutes(page);
      await seedDemoData(page);
      await selectTheme(page, DEFAULT_THEME_BY_MODE.dark);
      if (locale !== 'en-US') {
        await selectMetricUnits(page);
        await selectAppLanguage(page, locale);
      }

      // Home and the food diary first: starting a workout leaves a session for Home to offer back.
      await navigateTo(page, APP_URL);
      await shot('home');

      await navigateTo(page, `${APP_URL}/nutrition/food`);
      await shot('food');

      // Goals management opens from the day summary's menu.
      await clickTopmost(page.getByTestId('daily-summary-menu'));
      await clickTopmost(
        page.getByText(copy('settings', ['settings', 'advancedSettings', 'manageGoalsData']), {
          exact: true,
        })
      );
      await page
        .getByText(copy('goalsManagement', ['goalsManagement', 'title']), { exact: true })
        .first()
        .waitFor();
      await shot('goals', 2000);

      // A live session, started from the library the way a person starts it.
      await navigateTo(page, `${APP_URL}/workout/workouts`);
      const card = page
        .getByTestId('workout-card-preview')
        .filter({ hasText: WORKOUT_NAME })
        .locator('xpath=..');
      await clickTopmost(
        card.getByRole('button', { name: copy('startWorkout', ['startWorkout', 'start']) })
      );
      await page.waitForURL(/workout-session/, { timeout: 30000 });
      // The inline view lists the sets; the guided one's stepper is cut off at a 10-inch height.
      await clickTopmost(
        page.getByText(copy('workoutSession', ['trainingFlow', 'inline']), { exact: true })
      );
      await shot('workout', 1500);
    });
  });
}
