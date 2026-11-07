import { expect, test } from '@playwright/test';
import path from 'path';

import yearInReviewCopy from '../lang/locales/en-us/yearInReview.json';
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
const COPY = yearInReviewCopy.yearInReview;
// Safety stop for the story loop; a real story has about a dozen cards.
const MAX_STORY_CARDS = 30;

// The demo data lives in the year the suite runs in, so that is the year the story tells.
const REVIEW_YEAR = new Date().getFullYear();
// A year with no records at all, for the empty state.
const EMPTY_YEAR = 2019;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * "Your year in Musclog" (the Wrapped story): every poster, the share sheet, the empty state and
 * the Home offer. It has its own command (`npm run screenshots:wrapped`) so the story can be
 * recaptured, say for a new theme, without the half-hour modal sweep; `screenshots:all` runs it
 * too. Captures go to `screenshots/app-store/<theme>/<device>/wrapped/`.
 */
test.describe('Musclog Wrapped screenshots', () => {
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(600000);

  test('Capture the year story, share sheet and Home offer', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    const screenshotDir = appStoreScreenshotDir(SCREENSHOT_THEME, projectName, 'wrapped');
    const shot = (name: string, waitTime?: number) =>
      capture(page, path.join(screenshotDir, `${name}.png`), waitTime);

    console.log(`[${projectName}] Seeding demo data and selecting theme: ${SCREENSHOT_THEME}`);
    await seedDemoData(page);
    await selectTheme(page, SCREENSHOT_THEME);

    // 1. The story, one capture per poster. The "x of y" progress label is on screen once the
    // review has loaded and the poster has been measured.
    await navigateTo(page, `${APP_URL}/year-in-review?year=${REVIEW_YEAR}`);
    const progress = page.getByLabel(/^\d+ of \d+$/);
    await progress.waitFor({ timeout: 60000 });
    const total = Number((await progress.getAttribute('aria-label'))?.split(' of ')[1]);
    expect(total, 'The demo year should have a story to tell').toBeGreaterThan(1);

    const next = page.getByText(COPY.next, { exact: true });
    for (let card = 1; card <= MAX_STORY_CARDS; card++) {
      console.log(`[${projectName}] Story card ${card}/${total}`);
      await shot(`${pad(card)}-story`, 1500);
      if (card >= total) {
        break;
      }

      await next.click();
    }

    // The last poster swaps Next for Done and Share.
    await expect(next).toHaveCount(0);

    // 2. The share sheet. Both extras are off on open, which is how the image is first shared.
    await page.getByText(COPY.shareButton, { exact: true }).click();
    await page.getByText(COPY.shareSheetTitle, { exact: true }).waitFor();
    await shot(`${pad(total + 1)}-share`, 1500);

    // The same card with the optional figures switched on.
    await page.getByText(COPY.includeWeight, { exact: true }).click();
    await page.getByText(COPY.includeNutrition, { exact: true }).click();
    await shot(`${pad(total + 2)}-share-with-extras`, 1500);

    // 3. A year without records.
    await navigateTo(page, `${APP_URL}/year-in-review?year=${EMPTY_YEAR}`);
    await page.getByText(COPY.empty, { exact: true }).waitFor({ timeout: 60000 });
    await shot(`${pad(total + 3)}-empty`, 1500);

    // 4. Home's offer is shown from 1 December to 31 January, so pin the clock inside the season.
    // Last, because the fixed time cannot be undone for the rest of this browser context. Only the
    // card is captured: the rest of Home would read "today" as a month past the seeded data.
    await page.clock.setFixedTime(new Date(REVIEW_YEAR, 11, 5, 10, 0, 0));
    await navigateTo(page, APP_URL);
    const offer = page.getByTestId('year-in-review-card');
    await offer.waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    await offer.screenshot({ path: path.join(screenshotDir, '00-home-offer.png') });
    console.log(`[${projectName}] Completed.`);
  });
});
