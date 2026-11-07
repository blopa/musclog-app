import { expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import settingsCopy from '@/lang/locales/en-us/settings.json';
import { DEFAULT_THEME_BY_MODE, THEME_IDS } from '@/theme.registry';

export const BASE_URL =
  process.env.MUSCLOG_TEST_BASE_URL ?? `http://localhost:${process.env.MUSCLOG_TEST_PORT ?? 8081}`;
export const APP_URL = `${BASE_URL}/app`;

/**
 * The palette an app-store capture run uses: `MUSCLOG_SCREENSHOT_THEME`, any ID from
 * `theme.registry.js`, defaulting to the dark default. A function rather than a constant so a
 * spec that never reads it (the website suites) is not tripped by a stray variable.
 */
export function resolveScreenshotTheme(): string {
  const theme = process.env.MUSCLOG_SCREENSHOT_THEME ?? DEFAULT_THEME_BY_MODE.dark;
  if (!THEME_IDS.includes(theme)) {
    throw new Error(
      `Unknown MUSCLOG_SCREENSHOT_THEME "${theme}". Choose one of: ${THEME_IDS.join(', ')}`
    );
  }

  return theme;
}

/** `screenshots/app-store/<theme>/<device project>[/<sub>…]`, created when missing. */
export function appStoreScreenshotDir(
  theme: string,
  projectName: string,
  ...subfolders: string[]
): string {
  const dir = path.join('screenshots/app-store', theme, projectName, ...subfolders);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// The website's Preferences control needs a desktop-width layout to be reachable reliably.
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

export async function navigateTo(page: Page, url: string) {
  await page.goto(url, { timeout: 60000 });
  await page.waitForTimeout(3000);
}

/**
 * Seeds the demo data. `layoutAuditData` adds the layout audit's extra records on top
 * (`database/seeders/layoutAudit.ts`: notes, cycle day logs, a grouped meal, goals, a plan); the
 * store and website captures leave it off, so they keep the demo data they were framed around.
 */
export async function seedDemoData(page: Page, { layoutAuditData = false } = {}) {
  const extra = layoutAuditData ? '&layoutAuditData=true' : '';
  await page.goto(`${APP_URL}/onboarding/landing?demoModeEnabled=true${extra}`, {
    timeout: 60000,
  });
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
