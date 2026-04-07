import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_BASE_DIR = 'screenshots/automated';

if (!fs.existsSync(SCREENSHOT_BASE_DIR)) {
  fs.mkdirSync(SCREENSHOT_BASE_DIR, { recursive: true });
}

test.describe('App Screenshot Automation', () => {
  // Ultra long timeout for the entire suite
  test.setTimeout(900000);

  test('Capture all required screens and modals', async ({ page }) => {
    page.on('console', msg => {
      console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.log(`BROWSER ERROR: ${err.message}`);
    });

    const APP_URL = 'http://localhost:8081/musclog-app/';

    console.log(`Starting capture...`);

    // Helper for taking screenshots
    const takeScreenshot = async (name: string) => {
      console.log(`Taking screenshot: ${name}`);
      // Wait for any potential layout shifts or animations
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_BASE_DIR, `${name}.png`), fullPage: false });
    };

    // 1. Initial Launch & Seeding
    console.log(`Navigating to landing with demoModeEnabled...`);
    await page.goto(`${APP_URL}?demoModeEnabled=true`, { timeout: 600000 });

    // Wait for the seeding process to finish and redirect to home
    console.log(`Waiting for "Recent Workouts" (Home Screen)...`);
    await page.waitForSelector('text=Recent Workouts', { timeout: 480000 });

    // 2. Dashboard (Home)
    await takeScreenshot('01-dashboard');

    // 3. Workouts
    console.log(`Navigating to Workouts...`);
    await page.click('text=Workouts');
    await page.waitForSelector('text=My Routines', { timeout: 30000 });
    await takeScreenshot('02-workouts');

    // 4. Progress
    console.log(`Navigating to Progress...`);
    await page.click('text=Progress');
    await page.waitForSelector('text=Volume Evolution', { timeout: 30000 });
    await takeScreenshot('03-progress');

    // 5. User Metrics History (Modal)
    console.log(`Opening User Metrics History...`);
    // Clicking "Weight" card on Progress screen usually opens history
    await page.click('text=Weight');
    await page.waitForSelector('text=History', { timeout: 10000 });
    await takeScreenshot('04-user-metrics-history');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 6. Nutrition
    console.log(`Navigating to Nutrition...`);
    await page.click('text=Nutrition');
    await page.waitForSelector('text=Calories', { timeout: 30000 });
    await takeScreenshot('05-nutrition');

    // 7. Food Details Modal
    console.log(`Opening Food Details...`);
    // Click on a food item in the logs
    await page.click('text=Banana');
    await page.waitForSelector('text=Serving Size', { timeout: 10000 });
    await takeScreenshot('06-food-details');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 8. Food Creation Modal
    console.log(`Opening Food Creation...`);
    // In Nutrition screen, there's an 'Add Food' button
    await page.click('text=Add Food');
    await page.waitForSelector('text=Search', { timeout: 10000 });
    await page.click('text=Create Food');
    await page.waitForSelector('text=Food Name', { timeout: 10000 });
    await takeScreenshot('07-food-creation');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 9. Profile
    console.log(`Navigating to Profile...`);
    await page.click('text=Profile');
    await page.waitForSelector('text=Total Workouts', { timeout: 30000 });
    await takeScreenshot('08-profile');

    // 10. Settings
    console.log(`Navigating to Settings...`);
    await page.click('text=Settings');
    await page.waitForSelector('text=Preferences', { timeout: 30000 });
    await takeScreenshot('09-settings');

    console.log('All screenshots captured.');
  });
});
