import { expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { APP_URL } from '@/tests/helpers/screenshotSession';

import { localeDirectory } from './locales';

/**
 * Switches a seeded app to `locale` through Settings → Profile and units → Language, the way a
 * person does, because demo seeding leaves the stored language English whatever the browser's
 * locale is (the app renders the device language until its settings load, then follows the
 * database). The page must be showing English when this runs: it clicks English labels.
 */

const COPY_ROOT = path.resolve(process.cwd(), 'lang', 'locales');
/** The key the app mirrors its first-frame settings under (`SETTINGS_MIRROR_STORAGE_KEY`). */
const SETTINGS_MIRROR_KEY = 'musclog_settings_mirror';

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** The language's own name, which is what its menu item says in every UI language. */
export function languageMenuLabel(locale: string): string {
  const names = readJson<{ untranslated: Record<string, { name: string }> }>(
    path.join(COPY_ROOT, 'untranslated.json')
  );
  const entry = names.untranslated[localeDirectory(locale)];
  if (!entry) {
    throw new Error(`no language name for ${locale} in lang/locales/untranslated.json`);
  }

  return entry.name;
}

export async function selectAppLanguage(page: Page, locale: string): Promise<void> {
  const copy = readJson<{
    settings: { basicSettings: { title: string; language: string } };
  }>(path.join(COPY_ROOT, 'en-us', 'settings.json'));

  await page.goto(`${APP_URL}/settings`, { timeout: 60000 });
  await page.getByText(copy.settings.basicSettings.title, { exact: true }).first().click();
  await page.getByText(copy.settings.basicSettings.language, { exact: true }).first().click();
  await page.getByText(languageMenuLabel(locale), { exact: true }).first().click();

  // The mirror follows the settings table, so it proves the choice reached the database layer.
  await expect
    .poll(
      () =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? '{}').language as string | undefined,
          SETTINGS_MIRROR_KEY
        ),
      { timeout: 15000 }
    )
    .toBe(locale);
  // LokiJS autosaves every 500ms; leaving earlier discards the choice on the next load.
  await page.waitForTimeout(2000);
}
