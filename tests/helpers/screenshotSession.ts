import { expect, type Page } from '@playwright/test';

import settingsCopy from '@/lang/locales/en-us/settings.json';

export const BASE_URL =
  process.env.MUSCLOG_TEST_BASE_URL ?? `http://localhost:${process.env.MUSCLOG_TEST_PORT ?? 8081}`;
export const APP_URL = `${BASE_URL}/app`;

// The website's Preferences control needs a desktop-width layout to be reachable reliably.
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

export async function navigateTo(page: Page, url: string) {
  await page.goto(url, { timeout: 60000 });
  await page.waitForTimeout(3000);
}

export async function seedDemoData(page: Page) {
  await page.goto(`${APP_URL}/onboarding/landing?demoModeEnabled=true`, { timeout: 60000 });
  await page.waitForURL(/\/app\/?$/, { timeout: 120000 });
  // LokiJS autosaves every 500ms; leaving earlier discards the demo data.
  await page.waitForTimeout(2000);
}

/** Persists a theme through the website picker, then returns to the viewport the caller had. */
export async function selectTheme(page: Page, themeId: string) {
  const phoneViewport = page.viewportSize();
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await navigateTo(page, `${BASE_URL}/`);
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByRole('tab', { name: 'Theme', exact: true }).click();
  const themeLabel =
    settingsCopy.settings.theme.options[themeId as keyof typeof settingsCopy.settings.theme.options]
      .label;
  await page.getByRole('radiogroup').getByText(themeLabel, { exact: true }).click();
  await expect(page.getByRole('radio', { name: themeLabel, exact: true })).toBeChecked();
  // The radio reflects the synchronous mirror; wait out LokiJS's 500ms autosave.
  await page.waitForTimeout(1500);
  if (phoneViewport) {
    await page.setViewportSize(phoneViewport);
  }

  await navigateTo(page, APP_URL);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('musclog_theme') ?? '{}').themeId)
    )
    .toBe(themeId);
}

export async function installFixtureRoutes(page: Page) {
  await page.route(/^https:\/\/(api\.musclog\.app\/barcodes|api\.nal\.usda\.gov\/fdc)\//, (route) =>
    route.fulfill({ status: 404, body: '' })
  );
}

export async function capture(page: Page, filePath: string, waitTime = 3000) {
  await page.waitForTimeout(waitTime);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: filePath, fullPage: false });
}
