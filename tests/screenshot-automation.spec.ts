import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_BASE_DIR = 'screenshots/automated';

if (!fs.existsSync(SCREENSHOT_BASE_DIR)) {
  fs.mkdirSync(SCREENSHOT_BASE_DIR, { recursive: true });
}

test.describe('App Screenshot Automation', () => {
  // Ultra long timeout for the entire suite
  test.setTimeout(1200000);

  test('Capture all required screens and modals', async ({ page }) => {
    page.on('console', (msg) => {
      console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', (err) => {
      console.log(`BROWSER ERROR: ${err.message}`);
    });

    const APP_URL = 'http://localhost:8081/musclog-app/';

    console.log(`Starting capture...`);

    // Helper for taking screenshots
    const takeScreenshot = async (name: string) => {
      console.log(`Taking screenshot: ${name}`);
      // Wait for any potential layout shifts or animations
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(SCREENSHOT_BASE_DIR, `${name}.png`),
        fullPage: false,
      });
    };

    // 0. Landing Screen (Before Seeding)
    console.log(`Navigating to landing...`);
    await page.goto(APP_URL, { timeout: 600000 });
    await page.waitForSelector('text=Musclog', { timeout: 300000 });
    await takeScreenshot('00-landing');

    // 1. Initial Launch & Seeding
    console.log(`Triggering demoModeEnabled seeding...`);
    await page.goto(`${APP_URL}?demoModeEnabled=true`, { timeout: 600000 });

    // Wait for the seeding process to finish and redirect to home
    console.log(`Waiting for "Recent Workouts" (Home Screen)...`);
    await page.waitForSelector('text=Recent Workouts', { timeout: 480000 });

    // 2. Dashboard (Home)
    await takeScreenshot('01-dashboard');

    // 3. Workouts List
    console.log(`Navigating to Workouts...`);
    await page.click('text=Workouts');
    await page.waitForSelector('text=My Routines', { timeout: 30000 });
    await takeScreenshot('02-workouts-list');

    // 4. Active Workout Session
    console.log(`Starting a Workout Session...`);
    await page.click('text=Upper Body Power');
    await page.click('text=Start Workout');
    await page.waitForSelector('text=Finish', { timeout: 30000 });
    await takeScreenshot('03-active-session');

    // 5. Rest Timer
    console.log(`Triggering Rest Timer...`);
    // Click a checkbox to complete a set, which triggers the rest timer
    await page.click('role=checkbox >> nth=0');
    await page.waitForSelector('text=Resting', { timeout: 10000 });
    await takeScreenshot('04-rest-timer');
    // Skip rest
    await page.click('text=Skip');

    // 6. Workout Summary
    console.log(`Finishing Workout for Summary...`);
    await page.click('text=Finish');
    await page.click('text=Confirm Finish'); // Assuming confirmation modal
    await page.waitForSelector('text=Workout Complete', { timeout: 30000 });
    await takeScreenshot('05-workout-summary');
    await page.click('text=Close'); // Return to app

    // 7. Progress
    console.log(`Navigating to Progress...`);
    await page.click('text=Progress');
    await page.waitForSelector('text=Volume Evolution', { timeout: 30000 });
    await takeScreenshot('06-progress');

    // 8. User Metrics History (Modal)
    console.log(`Opening User Metrics History...`);
    await page.click('text=Weight');
    await page.waitForSelector('text=History', { timeout: 10000 });
    await takeScreenshot('07-user-metrics-history');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 9. Nutrition
    console.log(`Navigating to Nutrition...`);
    await page.click('text=Nutrition');
    await page.waitForSelector('text=Calories', { timeout: 30000 });
    await takeScreenshot('08-nutrition');

    // 10. Food Details Modal
    console.log(`Opening Food Details...`);
    await page.click('text=Banana');
    await page.waitForSelector('text=Serving Size', { timeout: 10000 });
    await takeScreenshot('09-food-details');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 11. Food Creation Modal
    console.log(`Opening Food Creation...`);
    await page.click('text=Add Food');
    await page.waitForSelector('text=Search', { timeout: 10000 });
    await page.click('text=Create Food');
    await page.waitForSelector('text=Food Name', { timeout: 10000 });
    await takeScreenshot('10-food-creation');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 12. Coach (Chat)
    console.log(`Navigating to Coach...`);
    await page.click('text=Coach');
    await page.waitForSelector('text=Loggy', { timeout: 30000 });
    await takeScreenshot('11-coach-chat');

    // 13. Menstrual Cycle
    console.log(`Navigating to Cycle...`);
    // It's often in a more menu or another tab if not on the main bar
    await page.click('text=Profile');
    await page.click('text=Menstrual Cycle');
    await page.waitForSelector('text=Cycle Day', { timeout: 30000 });
    await takeScreenshot('12-menstrual-cycle');
    await page.goBack();

    // 14. Profile
    console.log(`Capturing Profile...`);
    await page.waitForSelector('text=Total Workouts', { timeout: 30000 });
    await takeScreenshot('13-profile');

    // 15. Settings
    console.log(`Navigating to Settings...`);
    await page.click('text=Settings');
    await page.waitForSelector('text=Preferences', { timeout: 30000 });
    await takeScreenshot('14-settings');

    console.log('All screenshots captured.');
  });
});
