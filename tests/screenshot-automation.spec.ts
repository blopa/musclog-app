import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import muscleLoadCopy from '../lang/locales/en-us/muscleLoad.json';
import settingsCopy from '../lang/locales/en-us/settings.json';
import strengthLevelsCopy from '../lang/locales/en-us/strengthLevels.json';
import workoutImportCopy from '../lang/locales/en-us/workoutImport.json';
import { MODAL_BUTTON_TEXTS } from './helpers/modalFixture';
import {
  APP_URL,
  appStoreScreenshotDir,
  BASE_URL,
  capture,
  navigateTo,
  resolveScreenshotTheme,
  seedDemoData,
  selectTheme,
} from './helpers/screenshotSession';

const SCREENSHOT_THEME = resolveScreenshotTheme();

const OFF_PRODUCT_FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'off-product-3017620425035.json'),
  'utf8'
);
// A Strong export (weights carry no unit) with one lift the catalogue cannot match, so the import
// walks through every step: file, kg or lb, exercise choice, saving and the summary.
const STRONG_EXPORT_FILE = path.join(__dirname, 'fixtures', 'strong-export.csv');
// CSS pixels of the card's top padding and border, kept in view above a card's heading.
const CARD_EDGE_OFFSET = 40;

test.describe('App Store Screenshots', () => {
  // Suppress celebration effects before the app mounts, including after page.goto().
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(1800000); // 30 minutes

  test('Capture key screens and all modals', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const screenshotDir = appStoreScreenshotDir(SCREENSHOT_THEME, projectName);

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
    await navigateTo(page, `${BASE_URL}/`);
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
    await navigateTo(page, APP_URL);
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('musclog_theme') ?? '{}').themeId)
      )
      .toBe(SCREENSHOT_THEME);

    // 2. Main Screens
    await takeScreenshot('01-home', 3000);
    await navigateTo(page, `${APP_URL}/nutrition/food`);
    await takeScreenshot('02-food', 3000);
    await navigateTo(page, `${APP_URL}/progress`);
    await takeScreenshot('03-progress', 3000);
    await navigateTo(page, `${APP_URL}/profile`);
    await takeScreenshot('04-profile', 3000);
    await navigateTo(page, `${APP_URL}/settings`);
    await takeScreenshot('05-settings', 3000);

    // 3. Modals Test Screen
    console.log(`[${projectName}] Navigating to modals test screen...`);
    await navigateTo(page, `${APP_URL}/test/modals`);

    const modalButtonTexts = MODAL_BUTTON_TEXTS;

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
        await navigateTo(page, `${APP_URL}/test/modals`);
      }
    }

    expect(failedModals, 'Every requested modal must produce a screenshot').toEqual([]);
    console.log(`[${projectName}] Completed.`);
  });

  // The screens the modals fixture cannot show: they read the seeded history (Progress) or walk a
  // flow that needs a real file (Import workouts). It runs in its own context, so importing the
  // sample export never leaks sessions into the captures of the test above.
  test('Capture strength levels and the workout import flow', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const screenshotDir = appStoreScreenshotDir(SCREENSHOT_THEME, projectName);
    const shot = (name: string, waitTime?: number) =>
      capture(page, path.join(screenshotDir, `${name}.png`), waitTime);
    const importCopy = workoutImportCopy.workoutImport;

    console.log(`[${projectName}] Seeding demo data and selecting theme: ${SCREENSHOT_THEME}`);
    await seedDemoData(page);
    await selectTheme(page, SCREENSHOT_THEME);

    // 1. Progress: the cards sit under the charts, so each is scrolled to the top of the list,
    // then back a little so the card's own edge and padding stay in the frame.
    await navigateTo(page, `${APP_URL}/progress`);
    const scrollToCard = async (title: string) => {
      const heading = page.getByText(title, { exact: true }).first();
      await heading.waitFor({ state: 'visible', timeout: 30000 });
      await heading.evaluate((element, cardEdgeOffset) => {
        element.scrollIntoView({ block: 'start' });
        let scroller = element.parentElement;
        while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
          scroller = scroller.parentElement;
        }

        scroller?.scrollBy(0, -cardEdgeOffset);
      }, CARD_EDGE_OFFSET);
    };

    await scrollToCard(muscleLoadCopy.muscleLoad.weekly.title);
    await shot('06-progress-weekly-sets');
    await scrollToCard(strengthLevelsCopy.strengthLevels.title);
    await shot('07-progress-strength-levels');

    // 2. Import workouts, from Settings → Backups and data.
    const openImport = async () => {
      await navigateTo(page, `${APP_URL}/settings`);
      await page.getByText(settingsCopy.settings.advancedSettings.title, { exact: true }).click();
      await page.getByText(importCopy.entry.title, { exact: true }).first().click();
      await page.getByText(importCopy.pick.title, { exact: true }).waitFor();
    };

    await openImport();
    await shot('08-import-pick', 1500);

    // The picker is a hidden <input type="file">; answering its chooser is what a person's tap does.
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByText(importCopy.pick.chooseFile, { exact: true }).click();
    await (await fileChooser).setFiles(STRONG_EXPORT_FILE);

    // The file states no unit, so the flow asks before it reads a single weight.
    await page.getByText(importCopy.unit.title, { exact: true }).waitFor();
    // The demo account is imperial and the sample's weights are kilograms, so pick the unit the
    // way a person with this file would.
    await page.getByText(importCopy.unit.kg, { exact: true }).click();
    await shot('09-import-unit', 1500);
    await page.getByText(importCopy.unit.continue, { exact: true }).click();

    // The text also labels the summary strip above the list; the heading is the section itself.
    await page.getByRole('heading', { name: importCopy.review.needsChoice }).waitFor();
    await shot('10-import-review', 1500);

    // Every name without a match needs a choice before Import turns on; creating it as a custom
    // exercise keeps the sample's sets. The button's visible label is just "Create", so it is found
    // by its accessible name ("Create as custom: <exercise>"). The sample holds a lift the
    // catalogue cannot match, so a missing button means the sample no longer exercises this step.
    const createCustom = page.getByRole('button', {
      name: new RegExp(`^${importCopy.review.createCustom}: `),
    });
    await expect(createCustom.first()).toBeVisible();
    for (let guard = 0; guard < 20 && (await createCustom.count()) > 0; guard++) {
      await createCustom.first().click();
      await page.waitForTimeout(300);
    }

    await expect(createCustom, 'Every unmatched name should have a choice').toHaveCount(0);
    await shot('11-import-review-resolved', 1500);

    await page.getByText(/^Import \d+ sessions?$/).click();
    await page.getByText(/^\d+ sessions? imported$/).waitFor({ timeout: 60000 });
    await shot('12-import-summary', 1500);

    // The imported batch is listed on the first step from now on, with its undo.
    await page.getByText(importCopy.summary.done, { exact: true }).click();
    // LokiJS autosaves every 500ms; reopening reloads the page and must find the batch saved.
    await page.waitForTimeout(1500);
    await openImport();
    await expect(page.getByText(importCopy.pick.past, { exact: true }).first()).toBeVisible();
    await shot('13-import-past', 1500);
    console.log(`[${projectName}] Completed.`);
  });
});
