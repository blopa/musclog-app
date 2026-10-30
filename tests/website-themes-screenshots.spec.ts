import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { THEME_IDS } from '../theme.registry';
import {
  APP_URL,
  capture,
  installFixtureRoutes,
  seedDemoData,
  selectTheme,
} from './helpers/screenshotSession';

// Home screen per theme for the website's theme showcase and the themes blog post.
// scripts/sync-website-screenshots.js turns these into public/images WebP files.
const OUTPUT_DIR = path.join('screenshots', 'themes');

test.describe('Website theme screenshots', () => {
  test.use({ reducedMotion: 'reduce', locale: 'en-US', actionTimeout: 15000 });
  test.setTimeout(1800000);

  test('Capture the home screen in every theme', async ({ page }) => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    await installFixtureRoutes(page);
    await seedDemoData(page);

    for (const themeId of THEME_IDS) {
      console.log(`Capturing theme: ${themeId}`);
      await selectTheme(page, themeId);
      await capture(page, path.join(OUTPUT_DIR, `musclog-theme-${themeId}.png`));
    }
  });
});
