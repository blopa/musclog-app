import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const APP_URL = 'http://localhost:8081';
const SCREENSHOT_BASE_DIR = 'screenshots/app-store';

test.describe('App Store Screenshots', () => {
  test.setTimeout(600000);

  test('Capture key screens for App Store submission', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const screenshotDir = path.join(SCREENSHOT_BASE_DIR, projectName);

    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => console.log(`BROWSER PAGE ERROR: ${err.message}`));

    const takeScreenshot = async (name: string) => {
      console.log(`[${projectName}] Capturing: ${name}`);
      // Allow animations and data rendering to settle
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(screenshotDir, `${name}.png`),
        fullPage: false,
      });
    };

    const navigateTo = async (url: string) => {
      await page.goto(url, { timeout: 60000 });
      // Wait for the React app to mount and render with seeded data
      await page.waitForTimeout(5000);
    };

    // Seed demo data — navigate to root with ?demoModeEnabled=true so the
    // onboarding landing screen triggers seedDevData() and redirects to home.
    console.log(`[${projectName}] Seeding demo data...`);
    await page.goto(`${APP_URL}?demoModeEnabled=true`, { timeout: 600000 });
    await page.waitForSelector('text=Recent Workouts', { timeout: 480000 });

    // 01 — Home (index)
    await takeScreenshot('01-home');

    // 02 — Food / Nutrition
    await navigateTo(`${APP_URL}/nutrition/food`);
    await takeScreenshot('02-food');

    // 03 — Progress
    await navigateTo(`${APP_URL}/progress`);
    await takeScreenshot('03-progress');

    // 04 — Profile
    await navigateTo(`${APP_URL}/profile`);
    await takeScreenshot('04-profile');

    // 05 — Settings
    await navigateTo(`${APP_URL}/settings`);
    await takeScreenshot('05-settings');

    console.log(`[${projectName}] Done. Screenshots saved to: ${screenshotDir}`);
  });
});
