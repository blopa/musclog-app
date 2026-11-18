import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import settingsCopy from '../lang/locales/en-us/settings.json';
import workoutSessionCopy from '../lang/locales/en-us/workoutSession.json';
import startWorkoutCopy from '../lang/locales/en-us/startWorkout.json';
import goalsManagementCopy from '../lang/locales/en-us/goalsManagement.json';
import { DEFAULT_THEME_BY_MODE } from '../theme.registry';
import { clickTopmost } from './layoutAudit/flowKit';
import {
  APP_URL,
  capture,
  installFixtureRoutes,
  navigateTo,
  seedDemoData,
  selectTheme,
} from './helpers/screenshotSession';

// The captured screens (`<project>/<name>.png`). The App Store's iPad config
// (`playwright.app-store-ipad.config.ts`) runs this same spec: its project names its own folder
// through the `outputRoot` metadata and `numbered`, which prefixes each file with its position in
// IPAD_ORDER (`01-home.png`), the form `scripts/appstore.sh screenshots from-captures` copies.
const GOOGLE_PLAY_OUTPUT_DIR = path.join('screenshots', 'google-play');
const IPAD_ORDER = ['home', 'workout', 'food', 'goals'];
// The workout the demo data holds that reads as a real session; the session's first exercise is
// the barbell squat.
const WORKOUT_NAME = 'Leg Day / Squats';

test.describe('Google Play screenshots', () => {
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(1800000);

  test('Capture the tablet listing screens', async ({ page }, testInfo) => {
    const { outputRoot, numbered } = testInfo.project.metadata as {
      outputRoot?: string;
      numbered?: boolean;
    };
    const outputDir = outputRoot ?? path.join(GOOGLE_PLAY_OUTPUT_DIR, testInfo.project.name);
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });
    const fileName = (name: string) =>
      numbered ? `${String(IPAD_ORDER.indexOf(name) + 1).padStart(2, '0')}-${name}` : name;
    const shot = (name: string, waitTime?: number) =>
      capture(page, path.join(outputDir, `${fileName(name)}.png`), waitTime);

    await installFixtureRoutes(page);
    await seedDemoData(page);
    await selectTheme(page, DEFAULT_THEME_BY_MODE.dark);

    // Home and the food diary first: starting a workout leaves a session for Home to offer back.
    await navigateTo(page, APP_URL);
    await shot('home');

    await navigateTo(page, `${APP_URL}/nutrition/food`);
    await shot('food');

    // Goals management opens from the day summary's menu.
    await clickTopmost(page.getByTestId('daily-summary-menu'));
    await clickTopmost(
      page.getByText(settingsCopy.settings.advancedSettings.manageGoalsData, { exact: true })
    );
    await page
      .getByText(goalsManagementCopy.goalsManagement.title, { exact: true })
      .first()
      .waitFor();
    await shot('goals', 2000);

    // A live session, started from the library the way a person starts it.
    await navigateTo(page, `${APP_URL}/workout/workouts`);
    const card = page
      .getByTestId('workout-card-preview')
      .filter({ hasText: WORKOUT_NAME })
      .locator('xpath=..');
    await clickTopmost(card.getByRole('button', { name: startWorkoutCopy.startWorkout.start }));
    await page.waitForURL(/workout-session/, { timeout: 30000 });
    // The inline view lists the sets; the guided one's stepper is cut off at a 10-inch height.
    await clickTopmost(page.getByText(workoutSessionCopy.trainingFlow.inline, { exact: true }));
    await shot('workout', 1500);
  });
});
