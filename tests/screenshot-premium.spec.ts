import { test } from '@playwright/test';
import path from 'path';

import {
  APP_URL,
  appStoreScreenshotDir,
  capture,
  navigateTo,
  resolveScreenshotTheme,
  seedDemoData,
  selectTheme,
} from './helpers/screenshotSession';

const SCREENSHOT_THEME = resolveScreenshotTheme();
// The Premium paywall, as the fixture renders it before anyone has subscribed.
const PAYWALL_BUTTON = 'Open Premium Modal (Not Subscribed)';
const SCROLL_STEP = 600;

/**
 * The Premium paywall and the onboarding "Add an AI coach?" step. Both are unreleased, so they have
 * their own command (`npm run screenshots:premium`) and are in no store capture: the paywall opens
 * from the `/app/test/modals` Premium fixture and the onboarding step from `/app/test/ai-choice`
 * (the real screens, fed a not-subscribed Premium state and the free tier offered). Captures go to
 * `screenshots/app-store/<theme>/<device>/premium/`.
 */
test.describe('Premium screenshots', () => {
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(600000);

  test('Capture the paywall and the onboarding AI choice', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const screenshotDir = appStoreScreenshotDir(SCREENSHOT_THEME, projectName, 'premium');
    const shot = (name: string, waitTime?: number) =>
      capture(page, path.join(screenshotDir, `${name}.png`), waitTime);

    await seedDemoData(page);
    await selectTheme(page, SCREENSHOT_THEME);

    // 1. The paywall: the top, then scrolled down to the comparison and the disclosures. The
    // pinned footer (price, Subscribe, Restore) stays on screen in every capture.
    await navigateTo(page, `${APP_URL}/test/modals`);
    const button = page.getByText(PAYWALL_BUTTON).first();
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page
      .getByText('Log faster with AI, nothing to set up')
      .first()
      .waitFor({ timeout: 30000 });
    await shot('01-paywall', 1500);

    await page.mouse.move(100, 300);
    await page.mouse.wheel(0, SCROLL_STEP);
    await shot('02-paywall-compare', 1000);
    await page.mouse.wheel(0, SCROLL_STEP * 2);
    await shot('03-paywall-terms', 1000);

    // 2. The onboarding step, one capture per card selected.
    await navigateTo(page, `${APP_URL}/test/ai-choice?quickStep=5&quickTotal=7`);
    await page.getByTestId('ai-choice-premium').waitFor({ timeout: 30000 });
    await shot('04-ai-choice-premium', 1500);

    await page.getByTestId('ai-choice-free').click();
    await shot('05-ai-choice-free', 1000);
    await page.mouse.move(100, 300);
    await page.mouse.wheel(0, SCROLL_STEP);
    await shot('06-ai-choice-free-consent', 1000);

    await page.getByTestId('ai-choice-none').click();
    await shot('07-ai-choice-none', 1000);

    // 3. A small phone: "No AI for now" can sit below the fold, so the "more below" cue shows.
    await page.setViewportSize({ width: 360, height: 640 });
    await navigateTo(page, `${APP_URL}/test/ai-choice?quickStep=5&quickTotal=7`);
    await page.getByTestId('ai-choice-premium').waitFor({ timeout: 30000 });
    await shot('08-ai-choice-small-screen', 1500);
    await page.getByTestId('ai-choice-none').scrollIntoViewIfNeeded();
    await shot('09-ai-choice-small-screen-none', 1000);
  });
});
