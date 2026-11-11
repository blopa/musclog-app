import { expect, type Page, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { DEFAULT_THEME_BY_MODE } from '@/theme.registry';

import {
  APP_URL,
  capture,
  installFixtureRoutes,
  navigateTo,
  seedDemoData,
  selectTheme,
} from './helpers/screenshotSession';
import { clickTopmost, localeCopy } from './layoutAudit/flowKit';
import { selectAppLanguage } from './layoutAudit/language';
import { bundledLocales } from './layoutAudit/locales';

// Raw phone captures (`<locale>/<name>.png`) for the composer that frames them.
const OUTPUT_ROOT = path.join('screenshots', 'google-play', 'phone');
// The workout the demo data holds that reads as a real session (seeded names are not localized).
const WORKOUT_NAME = 'Leg Day / Squats';
// The workout view captured: Guided (photo hero and steppers) or Inline (the set list).
const SESSION_VIEW: 'guided' | 'inline' = 'inline';
// The first breakfast entry of the seeded diary (seeded names are not localized).
const DIARY_FOOD_NAME = 'Greek Yogurt';
const FOOD_DETAILS_SCROLL_PX = 420;
const DIARY_SCROLL_PX = 430;
const PROGRESS_SCROLL_PX = 650;
const PAST_WORKOUT_SCROLL_PX = 600;
const SETTINGS_MIRROR_KEY = 'musclog_settings_mirror';

const OFF_PRODUCT_FIXTURE = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'off-product-3017620425035.json'),
  'utf8'
);

/** Switches the seeded (imperial) app to metric through Settings → Profile and units, in English. */
async function selectMetricUnits(page: Page) {
  await page.goto(`${APP_URL}/settings`, { timeout: 60000 });
  await page
    .getByText(localeCopy('en-US', 'settings', ['settings', 'basicSettings', 'title'], ''), {
      exact: true,
    })
    .first()
    .click();
  await clickTopmost(
    page.getByText(
      localeCopy('en-US', 'editFitnessDetails', ['editFitnessDetails', 'metric'], ''),
      {
        exact: true,
      }
    )
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? '{}').units as string | undefined,
          SETTINGS_MIRROR_KEY
        ),
      { timeout: 15000 }
    )
    .toBe('metric');
  // LokiJS autosaves every 500ms; leaving earlier discards the choice on the next load.
  await page.waitForTimeout(2000);
}

for (const locale of bundledLocales()) {
  test.describe(`Google Play phone screenshots (${locale})`, () => {
    // The browser stays en-US: demo seeding resolves exercises by their English names, and a browser
    // locale of ru-RU seeds the catalogue in Russian, leaving the demo workouts without sets. The
    // app switches language through Settings below, as the layout audit does.
    test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
    test.setTimeout(1800000);

    test(`Capture the phone listing screens in ${locale}`, async ({ page }) => {
      const outputDir = path.join(OUTPUT_ROOT, locale);
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.mkdirSync(outputDir, { recursive: true });
      const shot = (name: string, waitTime?: number) =>
        capture(page, path.join(outputDir, `${name}.png`), waitTime);
      const copy = (file: string, keyPath: string[]) => localeCopy(locale, file, keyPath, '');

      await installFixtureRoutes(page);
      await page.route('https://world.openfoodfacts.org/api/v3/product/3017620425035*', (route) =>
        route.fulfill({ contentType: 'application/json', body: OFF_PRODUCT_FIXTURE })
      );
      await seedDemoData(page);
      await selectTheme(page, DEFAULT_THEME_BY_MODE.dark);
      if (locale !== 'en-US') {
        await selectMetricUnits(page);
        await selectAppLanguage(page, locale);
      }

      // Scrolls the page's own scroller (the tallest scrollable element) by `px` CSS pixels.
      const scrollMain = async (px: number) => {
        await page.evaluate((delta) => {
          const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter(
            (node) => node.scrollHeight > node.clientHeight + 50 && node.clientHeight > 300
          );
          scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight);
          scrollers[0]?.scrollBy(0, delta);
        }, px);
      };

      // Scrolls the scroller under the screen's centre: an open modal's, not the page behind it.
      const scrollTopmost = async (px: number) => {
        await page.evaluate((delta) => {
          let node = document.elementFromPoint(
            window.innerWidth / 2,
            window.innerHeight / 2
          ) as HTMLElement | null;
          while (node && node.scrollHeight <= node.clientHeight + 20) {
            node = node.parentElement;
          }

          node?.scrollBy(0, delta);
        }, px);
      };

      await navigateTo(page, APP_URL);
      await shot('01-home');

      // Food Details, where a food is logged from (amount, meal, date): the seeded diary's first
      // food opened the way a person opens it, by tapping it in the diary.
      await navigateTo(page, `${APP_URL}/nutrition/food`);
      await page.getByText(DIARY_FOOD_NAME, { exact: true }).first().waitFor({ timeout: 30000 });
      // The first diary card is the seeded breakfast's first food.
      await clickTopmost(page.getByTestId('food-item-menu'));
      await clickTopmost(
        page.getByText(copy('food', ['food', 'actions', 'duplicate']), { exact: true })
      );
      await page
        .getByText(copy('food', ['food', 'foodDetails', 'showMoreNutrition']), { exact: true })
        .first()
        .waitFor();
      await page.waitForTimeout(1500);
      await scrollTopmost(FOOD_DETAILS_SCROLL_PX);
      await shot('03-food-details', 1500);

      // The diary itself, scrolled past the summary so several meals are in view.
      await navigateTo(page, `${APP_URL}/nutrition/food`);
      await scrollMain(DIARY_SCROLL_PX);
      await shot('04-food', 1500);

      // Progress scrolled down to the charts.
      await navigateTo(page, `${APP_URL}/progress`);
      await scrollMain(PROGRESS_SCROLL_PX);
      await shot('05-progress', 2000);

      // Past workouts: Workouts → menu → Workout history → one session.
      await navigateTo(page, `${APP_URL}/workout/workouts`);
      await clickTopmost(
        page.getByRole('button', { name: copy('workouts', ['workouts', 'title']) })
      );
      await clickTopmost(
        page.getByText(copy('workouts', ['workouts', 'history', 'title']), { exact: true })
      );
      await page
        .getByText(copy('pastWorkoutHistory', ['pastWorkoutHistory', 'title']), { exact: true })
        .first()
        .waitFor();
      await page.waitForTimeout(1500);
      await clickTopmost(page.getByText(WORKOUT_NAME, { exact: true }));
      await page.waitForTimeout(2500);
      await scrollMain(PAST_WORKOUT_SCROLL_PX);
      await shot('06-past-workout', 1500);

      // The one-time welcome sheet is closed through its own button.
      await navigateTo(page, `${APP_URL}/weekly-review`);
      const welcome = page.locator('[data-testid="weekly-review-welcome"]');
      if ((await welcome.count()) > 0) {
        await page
          .getByRole('button', {
            name: copy('workoutSession', ['weeklyReview', 'welcome', 'cta']),
            exact: true,
          })
          .last()
          .click();
        await welcome.waitFor({ state: 'detached', timeout: 10000 });
      }

      await shot('07-weekly-review', 2000);

      // Goals management opens from the day summary's menu.
      await navigateTo(page, `${APP_URL}/nutrition/food`);
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
      await shot('08-goals', 2000);

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
      await clickTopmost(
        page.getByText(copy('workoutSession', ['trainingFlow', SESSION_VIEW]), { exact: true })
      );
      await shot('02-workout', 1500);
    });
  });
}
