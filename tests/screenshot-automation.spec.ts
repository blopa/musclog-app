import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const APP_URL = 'http://localhost:8081/musclog-app';
const SCREENSHOT_BASE_DIR = 'screenshots/app-store';

test.describe('App Store Screenshots', () => {
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
      await page.screenshot({
        path: path.join(screenshotDir, `${name}.png`),
        fullPage: false,
      });
    };

    const navigateTo = async (url: string) => {
      await page.goto(url, { timeout: 60000 });
      await page.waitForTimeout(3000);
    };

    // 1. Initial Seeding
    console.log(`[${projectName}] Loading app with demo data...`);
    await page.goto(`${APP_URL}/onboarding/landing?demoModeEnabled=true`, { timeout: 60000 });
    await page.waitForURL(`${APP_URL}/`, { timeout: 120000 });

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
      'Open Advanced Settings Modal',
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
    ];

    console.log(`[${projectName}] Capturing ${modalButtonTexts.length} modals.`);

    for (let i = 0; i < modalButtonTexts.length; i++) {
      const text = modalButtonTexts[i];
      const safeLabel = text.toLowerCase().replace(/[^a-z0-9]/g, '-');

      console.log(`[${projectName}] Modal ${i + 1}/${modalButtonTexts.length}: ${text}`);

      try {
        const button = page.getByText(text, { exact: true }).first();
        await button.scrollIntoViewIfNeeded();
        await button.click();

        await takeScreenshot(`modal-${(i + 1).toString().padStart(2, '0')}-${safeLabel}`, 1500);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (err) {
        console.log(`[${projectName}] Error on "${text}": ${(err as any)?.message}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    console.log(`[${projectName}] Completed.`);
  });
});
