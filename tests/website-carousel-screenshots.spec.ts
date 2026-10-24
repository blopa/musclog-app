import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { DEFAULT_THEME_BY_MODE } from '../theme.registry';
import {
  APP_URL,
  capture,
  installFixtureRoutes,
  navigateTo,
  seedDemoData,
  selectTheme,
} from './helpers/screenshotSession';

// The routable screens in the website's phone carousel (public/images/phone is a symlink to
// screenshots/phone). The chat, rest timer, settings modal and meal-log slides need scripted
// interaction and remain hand-curated.
const OUTPUT_DIR = path.join('screenshots', 'phone');
const SCREENS = [
  { file: 'screenshot-1.png', route: '' },
  { file: 'screenshot-2.png', route: '/nutrition/food' },
  { file: 'screenshot-3.png', route: '/workout/workouts' },
];

test.describe('Website carousel screenshots', () => {
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(1800000);

  test('Capture the carousel screens', async ({ page }) => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await installFixtureRoutes(page);
    await seedDemoData(page);
    await selectTheme(page, DEFAULT_THEME_BY_MODE.dark);

    for (const screen of SCREENS) {
      await navigateTo(page, `${APP_URL}${screen.route}`);
      await capture(page, path.join(OUTPUT_DIR, screen.file));
    }
  });
});
