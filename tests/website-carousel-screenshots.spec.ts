import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { DEFAULT_THEME_BY_MODE } from '../theme.registry';
import { MODAL_BUTTON_TEXTS } from './helpers/modalFixture';
import {
  APP_URL,
  capture,
  installFixtureRoutes,
  navigateTo,
  seedDemoData,
  selectTheme,
} from './helpers/screenshotSession';
import { clickTopmost, localeCopy } from './layoutAudit/flowKit';

// The slides of the website's phone carousel (public/images/phone is a symlink to
// screenshots/phone). The first three are plain routes; the rest need a tap or two (a modal, a
// live session), so they run in a second test, in their own seeded context.
//
// `MUSCLOG_CAROUSEL_ONLY` (comma-separated file names, e.g. `screenshot-5.png,screenshot-10.png`)
// recaptures just those slides.
const OUTPUT_DIR = path.join('screenshots', 'phone');
const ROUTE_SCREENS = [
  { file: 'screenshot-1.png', route: '' },
  { file: 'screenshot-2.png', route: '/nutrition/food' },
  { file: 'screenshot-3.png', route: '/workout/workouts' },
];
// The workout the demo data holds that reads as a real session (seeded names are not localized).
const WORKOUT_NAME = 'Leg Day / Squats';

const only = (process.env.MUSCLOG_CAROUSEL_ONLY ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const wanted = (file: string) => only.length === 0 || only.includes(file);

const copy = (file: string, keyPath: string[]) => localeCopy('en-US', file, keyPath, '');

test.describe('Website carousel screenshots', () => {
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(1800000);

  test('Capture the carousel screens', async ({ page }) => {
    const screens = ROUTE_SCREENS.filter((screen) => wanted(screen.file));
    test.skip(screens.length === 0, 'No route slide requested');
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await installFixtureRoutes(page);
    await seedDemoData(page);
    await selectTheme(page, DEFAULT_THEME_BY_MODE.dark);

    for (const screen of screens) {
      await navigateTo(page, `${APP_URL}${screen.route}`);
      await capture(page, path.join(OUTPUT_DIR, screen.file));
    }
  });

  test('Capture the carousel slides that need interaction', async ({ page }) => {
    const slides = [
      'screenshot-4.png',
      'screenshot-5.png',
      'screenshot-6.png',
      'screenshot-7.png',
      'screenshot-8.png',
      'screenshot-9.png',
      'screenshot-10.png',
      'screenshot-11.png',
      'screenshot-12.png',
      'screenshot-13.png',
      'screenshot-14.png',
    ];
    test.skip(!slides.some(wanted), 'No interactive slide requested');
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const shot = (file: string, waitTime?: number) =>
      capture(page, path.join(OUTPUT_DIR, file), waitTime);
    // Opens a fixture modal the way the app-store capture does.
    const openFixtureModal = async (label: string) => {
      if (!MODAL_BUTTON_TEXTS.includes(label)) {
        throw new Error(`"${label}" is not a button of the modals fixture`);
      }

      await navigateTo(page, `${APP_URL}/test/modals`);
      await clickTopmost(page.getByRole('button', { name: label, exact: true }));
    };

    await installFixtureRoutes(page);
    await seedDemoData(page);
    await selectTheme(page, DEFAULT_THEME_BY_MODE.dark);

    // "How do you want to build your routine?", the Create workout options.
    if (wanted('screenshot-4.png')) {
      await openFixtureModal('Open Create Workout Options');
      await page
        .getByText(copy('workouts', ['workouts', 'createWorkoutOptionsModal', 'title']), {
          exact: true,
        })
        .first()
        .waitFor();
      await shot('screenshot-4.png', 2000);
    }

    // Body metrics: Profile → Current stats → History (the weight trend and its entries).
    if (wanted('screenshot-5.png')) {
      await navigateTo(page, `${APP_URL}/profile`);
      await clickTopmost(page.getByText(copy('profile', ['profile', 'history']), { exact: true }));
      await page
        .getByText(copy('bodyMetrics', ['bodyMetrics', 'metrics', 'ffmi']), { exact: true })
        .first()
        .waitFor();
      await shot('screenshot-5.png', 2500);
    }

    // Goals management, opened from the day summary's menu on the food diary.
    if (wanted('screenshot-6.png')) {
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
      await shot('screenshot-6.png', 2000);
    }

    // Backups and data: Settings → Backups and data.
    if (wanted('screenshot-8.png')) {
      await navigateTo(page, `${APP_URL}/settings`);
      await clickTopmost(
        page.getByText(copy('settings', ['settings', 'advancedSettings', 'title']), { exact: true })
      );
      await page
        .getByText(copy('settings', ['settings', 'advancedSettings', 'exportFitnessData']), {
          exact: true,
        })
        .first()
        .waitFor();
      await shot('screenshot-8.png', 1500);
    }

    // The coach's three chats, which the demo data seeds with conversations: General (opens
    // there), Nutrition and Fitness (workout advice). The fixture mounts the real CoachModal (the
    // nav's Chat button opens a "set up AI" sheet until a provider exists), so no reply is awaited.
    if (wanted('screenshot-7.png') || wanted('screenshot-9.png') || wanted('screenshot-13.png')) {
      await openFixtureModal('Open Coach Modal');
      await page
        .getByText(copy('coach', ['coach', 'context', 'general']), { exact: true })
        .first()
        .waitFor();
      if (wanted('screenshot-7.png')) {
        await shot('screenshot-7.png', 2500);
      }

      if (wanted('screenshot-9.png')) {
        await clickTopmost(
          page.getByText(copy('coach', ['coach', 'context', 'nutrition']), { exact: true })
        );
        await shot('screenshot-9.png', 2500);
      }

      if (wanted('screenshot-13.png')) {
        await clickTopmost(
          page.getByText(copy('coach', ['coach', 'context', 'exercise']), { exact: true })
        );
        await shot('screenshot-13.png', 2500);
      }
    }

    // Logging a meal: the Log Meal sheet (serving size, date, meal type). The real one opens only
    // after an AI meal estimate, so it is shown through the modals fixture.
    if (wanted('screenshot-14.png')) {
      await openFixtureModal('Open Log Meal Modal');
      await shot('screenshot-14.png', 2500);
    }

    // A live session: the Guided view, then Inline with its first set done and the rest panel
    // expanded. Last, because it changes the seeded data.
    if (wanted('screenshot-10.png') || wanted('screenshot-11.png') || wanted('screenshot-12.png')) {
      await navigateTo(page, `${APP_URL}/workout/workouts`);
      const card = page
        .getByTestId('workout-card-preview')
        .filter({ hasText: WORKOUT_NAME })
        .locator('xpath=..');
      await clickTopmost(
        card.getByRole('button', { name: copy('startWorkout', ['startWorkout', 'start']) })
      );
      await page.waitForURL(/workout-session/, { timeout: 30000 });
      if (wanted('screenshot-11.png') || wanted('screenshot-12.png')) {
        await clickTopmost(
          page.getByText(copy('workoutSession', ['trainingFlow', 'guided']), { exact: true })
        );
        const complete = page.getByRole('button', {
          name: copy('workoutSession', ['trainingFlow', 'complete']),
          exact: true,
        });
        await complete.first().waitFor();
        // The pinned Complete button and rest bar cover the lower body on a phone this short:
        // scroll the figures (weight, reps) clear of them.
        await page.evaluate(() => {
          const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter(
            (node) => node.scrollHeight > node.clientHeight + 50 && node.clientHeight > 300
          );
          scrollers.sort((x, y) => y.scrollHeight - x.scrollHeight);
          scrollers[0]?.scrollBy(0, 230);
        });
        await page.waitForTimeout(600);

        if (wanted('screenshot-12.png')) {
          await shot('screenshot-12.png', 2000);
        }

        // The effort sheet (RIR, RPE, partial reps), which replaced the old Log set modal.
        if (wanted('screenshot-11.png')) {
          await clickTopmost(
            page.getByText(copy('workoutSession', ['trainingFlow', 'details']), { exact: true })
          );
          await page.waitForTimeout(1200);
          await shot('screenshot-11.png', 1500);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(800);
        }
      }

      if (wanted('screenshot-10.png')) {
        await clickTopmost(
          page.getByText(copy('workoutSession', ['trainingFlow', 'inline']), { exact: true })
        );
        await page.waitForTimeout(1000);
        await clickTopmost(page.locator('[data-testid^="set-"][data-testid$="-complete"]'));
        const bar = page.getByTestId('session-rest-timer');
        await bar.waitFor({ timeout: 15000 });
        // The bar opens collapsed; its first button expands the countdown panel.
        await clickTopmost(bar.getByRole('button').first());
        await shot('screenshot-10.png', 1000);
      }
    }
  });
});
