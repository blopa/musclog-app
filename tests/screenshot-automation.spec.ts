import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import settingsCopy from '../lang/locales/en-us/settings.json';
import { DEFAULT_THEME_BY_MODE, THEME_IDS } from '../theme.registry';

// App screens live under /app; the site root is the marketing website.
const BASE_URL =
  process.env.MUSCLOG_TEST_BASE_URL ?? `http://localhost:${process.env.MUSCLOG_TEST_PORT ?? 8081}`;
const APP_URL = `${BASE_URL}/app`;
const SCREENSHOT_THEME = process.env.MUSCLOG_SCREENSHOT_THEME ?? DEFAULT_THEME_BY_MODE.dark;
if (!THEME_IDS.includes(SCREENSHOT_THEME)) {
  throw new Error(
    `Unknown MUSCLOG_SCREENSHOT_THEME "${SCREENSHOT_THEME}". Choose one of: ${THEME_IDS.join(', ')}`
  );
}

const OFF_PRODUCT_FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'off-product-3017620425035.json'),
  'utf8'
);
const SCREENSHOT_BASE_DIR = path.join('screenshots/app-store', SCREENSHOT_THEME);

test.describe('App Store Screenshots', () => {
  // Suppress celebration effects before the app mounts, including after page.goto().
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(1800000); // 30 minutes

  test('Capture key screens and all modals', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const screenshotDir = path.join(SCREENSHOT_BASE_DIR, projectName);

    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const takeScreenshot = async (name: string, waitTime = 2000) => {
      console.log(`[${projectName}] Capturing: ${name}`);
      await page.waitForTimeout(waitTime);
      // Exercise photos load from musclog.app; wait for them instead of guessing a delay. A page
      // that never goes idle (polling, animations) just falls through after the cap.
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(screenshotDir, `${name}.png`),
        fullPage: false,
      });
    };

    const navigateTo = async (url: string) => {
      await page.goto(url, { timeout: 60000 });
      await page.waitForTimeout(3000);
    };

    // The food fixtures look up barcode 3017620425035. Serve a recorded Open Food Facts response and
    // refuse the other barcode sources so captures never depend on the network or its rate limits.
    await page.route('https://world.openfoodfacts.org/api/v3/product/3017620425035*', (route) =>
      route.fulfill({ contentType: 'application/json', body: OFF_PRODUCT_FIXTURE })
    );
    await page.route(
      /^https:\/\/(api\.musclog\.app\/barcodes|api\.nal\.usda\.gov\/fdc)\//,
      (route) => route.fulfill({ status: 404, body: '' })
    );

    // 1. Initial Seeding
    console.log(`[${projectName}] Loading app with demo data...`);
    await page.goto(`${APP_URL}/onboarding/landing?demoModeEnabled=true`, { timeout: 60000 });
    await page.waitForURL(/\/app\/?$/, { timeout: 120000 });
    // The URL changes as soon as seedDevData() resolves, but LokiJS autosaves every 500ms. Leaving
    // now discards the demo data and every screenshot becomes an empty state.
    await page.waitForTimeout(2000);

    // Apply the real persisted preference after seeding so full-page navigation keeps it.
    console.log(`[${projectName}] Selecting theme: ${SCREENSHOT_THEME}`);
    await navigateTo(`${BASE_URL}/`);
    await page.getByRole('button', { name: 'Preferences', exact: true }).click();
    await page.getByRole('tab', { name: 'Theme', exact: true }).click();
    const themeLabel =
      settingsCopy.settings.theme.options[
        SCREENSHOT_THEME as keyof typeof settingsCopy.settings.theme.options
      ].label;
    await page.getByRole('radiogroup').getByText(themeLabel, { exact: true }).click();
    await expect(page.getByRole('radio', { name: themeLabel, exact: true })).toBeChecked();
    // The website radio reflects the synchronous theme mirror, not a durable DB save.
    // LokiJS autosaves every 500ms; unloading immediately discards the pending write.
    await page.waitForTimeout(1500);
    await navigateTo(APP_URL);
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('musclog_theme') ?? '{}').themeId)
      )
      .toBe(SCREENSHOT_THEME);

    // 2. Main Screens
    await takeScreenshot('01-home', 3000);
    await navigateTo(`${APP_URL}/nutrition/food`);
    await takeScreenshot('02-food', 3000);
    await navigateTo(`${APP_URL}/progress`);
    await takeScreenshot('03-progress', 3000);
    await navigateTo(`${APP_URL}/profile`);
    await takeScreenshot('04-profile', 3000);
    await navigateTo(`${APP_URL}/settings`);
    await takeScreenshot('05-settings', 3000);

    // 3. Modals Test Screen
    console.log(`[${projectName}] Navigating to modals test screen...`);
    await navigateTo(`${APP_URL}/test/modals`);

    // TODO: cant we somehow load the copies by loading the en-us json file? Then if we update the copies, this script will still work
    const modalButtonTexts = [
      'Open Select Modal (list rows)',
      'Open Add Exercise Modal',
      'Open Nutrition Goals Modal',
      'Open Basic Settings Modal',
      'Open Data Settings Modal',
      'Open App Preferences Modal',
      'Open AI Settings Modal',
      'Open AI Not Configured Modal',
      'Open Edit Personal Info Modal',
      'Open Edit Fitness Details Modal',
      'Default Variant',
      'Destructive',
      'Primary',
      'Open End Workout Modal',
      'Open User Menu Modal',
      'Open Session Feedback Modal',
      'Open Edit Set Details Modal',
      'Open Log Set Performance Modal',
      'Open Food Details Modal',
      'Open Nutrition Log Data Modal',
      'Open Food Data Modal',
      'Open Add Food Modal',
      'Open Add Meal Modal',
      'Open Create Meal Modal',
      'Open My Meals Modal',
      'Open Food Search Modal',
      'Open Food Not Found Modal',
      'Open Barcode Camera Modal',
      'Open Notifications Modal',
      'Open Workout Options Modal',
      'Open Create Workout Options',
      'Open Session Overview',
      'Open Replace Exercise Modal',
      'Open Workout History Modal',
      'Open Filter Workouts Modal',
      'Open Add Food Item to Meal Modal',
      'Open Centered Modal',
      'Open Coach Modal',
      'Open Full Screen Modal',
      'Open New Custom Food Modal',
      'Open Exercises Modal',
      'Open View Exercise Modal',
      'Open Create Exercise Modal',
      'Open Goals Management Modal',
      'Open Past Workouts History Modal',
      'Open Body Metrics History Modal',
      'Open Add User Metric Entry Modal',
      'Open Edit Past Workout Data Modal',
      'Open Past Workout Detail Modal',
      'Open Edit Workout Metadata Modal',
      'Open Create Workout Modal',
      'Open Portion Sizes Picker Modal',
      'Open Create Food Portion Modal',
      'Open Browse Templates Modal',
      'Open Log Meal Modal',
      'Open Meal Data Modal',
      'Open Exercise Data Modal',
      'Open Workout Log Data Modal',
      'Open Workout Template Data Modal',
      'Open User Metric Data Modal',
      'Open Food Portion Data Modal',
      'Open Meal Estimation Modal',
      'Open Time Picker Modal',
      'Open Free Session Exercise Complete Modal',
      'Open Nutrition Goal Data Modal',
      'Open Import Nutrition Modal',
      'Open Import Workouts Modal',
      'Open Nutrition Confirmation Modal',
      'Open Retrospective Nutrition Modal',
      'Open AI Nutrition Context Modal',
      'Open AI Custom Prompts Modal',
      'Open AI Custom Prompt Edit Modal',
      'Open Cycle Log Modal',
      'Open Generic Edit Modal',
      'Move Mode',
      'Copy Mode',
      'Split Mode',
      'Open Notifications Settings Modal',
      'Open Past Workout Bottom Menu',
      'Open Past Workouts Filter Menu',
      'Open Recent Nutrition History Modal',
      'Open Scanned Food Details Modal',
      'Open Smart Camera Modal',
      'Open Visual Settings Modal',
      'Open Add Exercise To Session Modal',
      'Open Saved For Later Modal',
    ];

    console.log(`[${projectName}] Capturing ${modalButtonTexts.length} modals.`);

    const failedModals: string[] = [];
    for (let i = 0; i < modalButtonTexts.length; i++) {
      const text = modalButtonTexts[i];
      const safeLabel = text.toLowerCase().replace(/[^a-z0-9]/g, '-');

      console.log(`[${projectName}] Modal ${i + 1}/${modalButtonTexts.length}: ${text}`);

      try {
        const button = page.getByText(text, { exact: true }).first();
        await button.scrollIntoViewIfNeeded();
        await button.click();

        await takeScreenshot(`modal-${(i + 1).toString().padStart(2, '0')}-${safeLabel}`, 1500);

        // Some fixture modals deliberately cannot dismiss via Escape. Reloading
        // unmounts every overlay so the next capture always starts independently.
        await page.reload({ timeout: 60000 });
        await page.waitForTimeout(500);
      } catch (err) {
        failedModals.push(text);
        console.log(`[${projectName}] Error on "${text}": ${(err as any)?.message}`);
        await page.keyboard.press('Escape');
        await navigateTo(`${APP_URL}/test/modals`);
      }
    }

    expect(failedModals, 'Every requested modal must produce a screenshot').toEqual([]);
    console.log(`[${projectName}] Completed.`);
  });
});
