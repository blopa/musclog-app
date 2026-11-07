import { test, type Page, type TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { installFixtureRoutes, APP_URL, seedDemoData } from './helpers/screenshotSession';
import { analyzeSnapshot } from './layoutAudit/analyze';
import {
  applyPseudoLocale,
  collectLayoutSnapshot,
  markBaseline,
  scrollLargestToEnd,
} from './layoutAudit/inPage';
import { selectAppLanguage } from './layoutAudit/language';
import { localeSignatures, resolveLocales } from './layoutAudit/locales';
import {
  REPORT_DIR,
  SCREENSHOT_DIR,
  SHARD_DIR,
  type ReportGroup,
  type ShardEntry,
  type Surface,
} from './layoutAudit/report';
import {
  MAIN_ROUTES,
  MODAL_AUDIT_BUTTONS,
  ONBOARDING_ROUTES,
  type AuditRoute,
} from './layoutAudit/routes';

/**
 * Walks the web build at a phone profile and reports the layouts that look cramped. The build is
 * the one `npm run layout:audit` makes: a static export with `EXPO_PUBLIC_SCREENSHOT_MODE=1`,
 * which is what lets the production bundle serve the `/app/test/modals` fixture.
 *
 * Environment:
 *  - MUSCLOG_LAYOUT_LOCALES   comma list of locale tags; default `all` = every bundled locale
 *                             (en-US, es-ES, nl-NL, pt-BR, ru-RU); add `pseudo` for English
 *                             lengthened by 40%
 *  - MUSCLOG_LAYOUT_ONLY      comma list; only screens/modals whose name contains one of them
 *  - MUSCLOG_LAYOUT_SURFACES  comma list of `screens`, `modals`, `onboarding` (default all)
 *  - MUSCLOG_LAYOUT_PSEUDO_FACTOR  how much `pseudo` stretches text (default 1.4)
 */

const LOCALES = resolveLocales(process.env.MUSCLOG_LAYOUT_LOCALES);
const ONLY = (process.env.MUSCLOG_LAYOUT_ONLY ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const SURFACES = new Set(
  (process.env.MUSCLOG_LAYOUT_SURFACES ?? 'screens,modals,onboarding')
    .split(',')
    .map((s) => s.trim())
);
const PSEUDO_FACTOR = Number(process.env.MUSCLOG_LAYOUT_PSEUDO_FACTOR ?? 1.4);
/** The locale a `pseudo` run renders in before its text is stretched. */
const PSEUDO_BASE_LOCALE = 'en-US';

const wanted = (name: string) =>
  ONLY.length === 0 || ONLY.some((part) => name.toLowerCase().includes(part));
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface Auditor {
  entries: ShardEntry[];
  settle: (extraMs?: number) => Promise<void>;
  audit: (target: {
    surface: Surface;
    name: string;
    url: string;
    onlyNew: boolean;
  }) => Promise<void>;
  record: (
    entry: Pick<ShardEntry, 'surface' | 'name' | 'url' | 'status' | 'note' | 'screenshot'>
  ) => void;
  /** Screenshot of the page as it is now, for the report; undefined when it cannot be taken. */
  capture: (surface: Surface, name: string, pass: 'top' | 'end') => Promise<string | undefined>;
  flush: (suffix: string) => void;
}

function createAuditor(
  page: Page,
  testInfo: TestInfo,
  localeSpec: string,
  signatures: string[],
  group: ReportGroup
): Auditor {
  const profile = testInfo.project.name;
  const fontScale = Number(/-fs([\d.]+)$/.exec(profile)?.[1] ?? 1);
  const pseudo = localeSpec === 'pseudo';
  const entries: ShardEntry[] = [];
  const base = () => ({
    platform: 'web' as const,
    group,
    profile,
    locale: localeSpec,
    fontScale,
    viewport: page.viewportSize() ?? { width: 0, height: 0 },
  });

  const settle = async (extraMs = 1200) => {
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    // A cold route is a blank page until its bundle runs; wait for any text before measuring.
    await page
      .waitForFunction(() => document.body.innerText.trim().length > 0, undefined, {
        timeout: 15000,
      })
      .catch(() => undefined);
    // The app draws in English until its settings load from the database. Measuring that frame
    // would audit the wrong language (and a half-loaded screen), so wait for the locale's copy.
    if (signatures.length > 0) {
      await waitForLocale(page, signatures, 8000);
    }

    await waitForStableText(page);
    await page.waitForTimeout(extraMs);
  };

  const record: Auditor['record'] = (entry) => {
    entries.push({ ...base(), pass: 'top', findings: [], ...entry });
  };

  /**
   * Every audited page is kept as a clean JPEG for `report.html`, which draws the findings over it
   * from their rects (so the outlines can be switched off). JPEG, because a full run holds
   * thousands of them.
   */
  const capture: Auditor['capture'] = async (surface, name, pass) => {
    const file = path.join(
      SCREENSHOT_DIR,
      profile,
      slug(localeSpec),
      `${surface}-${slug(name)}-${pass}.jpg`
    );
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage: false });
      return path.relative(REPORT_DIR, file);
    } catch {
      return undefined;
    }
  };

  const audit: Auditor['audit'] = async ({ surface, name, url, onlyNew }) => {
    for (const pass of ['top', 'end'] as const) {
      if (pass === 'end') {
        const moved = await page.evaluate(scrollLargestToEnd, onlyNew);
        if (!moved) {
          return;
        }

        await page.waitForTimeout(400);
      }

      if (pseudo) {
        await page.evaluate(applyPseudoLocale, PSEUDO_FACTOR);
      }

      const snapshot = await page.evaluate(collectLayoutSnapshot, { onlyNew });
      if (snapshot.nodes.length === 0) {
        entries.push({
          ...base(),
          surface,
          name,
          url,
          pass,
          status: 'skipped',
          note: 'nothing rendered to measure',
          findings: [],
          screenshot: await capture(surface, name, pass),
        });
        return;
      }

      entries.push({
        ...base(),
        surface,
        name,
        url,
        pass,
        status: 'audited',
        note: snapshot.capped ? 'node cap reached; later content not examined' : undefined,
        findings: analyzeSnapshot(snapshot, { pass }),
        screenshot: await capture(surface, name, pass),
      });
    }
  };

  const flush = (suffix: string) => {
    fs.mkdirSync(SHARD_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(SHARD_DIR, `${slug(profile)}__${slug(localeSpec)}__${suffix}.json`),
      JSON.stringify(entries)
    );
  };

  return { entries, settle, audit, record, capture, flush };
}

/** True once any of the locale-only strings is on screen. */
function waitForLocale(page: Page, signatures: string[], timeout: number): Promise<boolean> {
  return page
    .waitForFunction(
      (candidates) => {
        const text = document.body.innerText;
        return candidates.some((candidate) => text.includes(candidate));
      },
      signatures,
      { timeout }
    )
    .then(() => true)
    .catch(() => false);
}

/** Waits until the page text stops changing (loading skeletons, counters, late data). */
async function waitForStableText(page: Page): Promise<void> {
  let previous = '';
  let stableReads = 0;
  for (let attempt = 0; attempt < 25 && stableReads < 2; attempt++) {
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    stableReads = text === previous ? stableReads + 1 : 0;
    previous = text;
    await page.waitForTimeout(400);
  }
}

/**
 * A run labelled `ru-RU` that quietly rendered English would report a layout nobody sees. The
 * first page of every test must show copy that only the requested locale has.
 */
async function assertRendersLocale(
  page: Page,
  locale: string,
  signatures: string[]
): Promise<void> {
  if (signatures.length === 0 || (await waitForLocale(page, signatures, 30000))) {
    return;
  }

  throw new Error(
    `the app is not rendering in ${locale}: none of its ${signatures.length} locale-only strings are on screen`
  );
}

/** The route's final pathname differs from the requested one: the app redirected. */
function redirectedTo(page: Page, requestedUrl: string): string | null {
  const strip = (value: string) =>
    new URL(value).pathname.replace(/\/+$/, '').replace(/\.html$/, '');
  const final = strip(page.url());
  return final === strip(requestedUrl) ? null : final;
}

async function auditRoutes(
  page: Page,
  auditor: Auditor,
  routes: AuditRoute[],
  label: string,
  locale: string,
  signatures: string[]
): Promise<void> {
  let localeChecked = false;
  for (const route of routes.filter((candidate) => wanted(candidate.name))) {
    const url = `${APP_URL}${route.path}`;
    try {
      console.log(`[layout] ${label}: ${route.name}`);
      await page.goto(url, { timeout: 60000 });
      await auditor.settle();
      const moved = redirectedTo(page, url);
      if (moved) {
        auditor.record({
          surface: 'screen',
          name: route.name,
          url,
          status: 'redirected',
          note: `redirected to ${moved}`,
          screenshot: await auditor.capture('screen', route.name, 'top'),
        });
        continue;
      }

      if (!localeChecked) {
        await assertRendersLocale(page, locale, signatures);
        localeChecked = true;
      }

      await auditor.audit({ surface: 'screen', name: route.name, url, onlyNew: false });
    } catch (error) {
      if (!localeChecked && (error as Error).message.startsWith('the app is not rendering')) {
        throw error;
      }

      auditor.record({
        surface: 'screen',
        name: route.name,
        url,
        status: 'failed',
        note: (error as Error).message.split('\n')[0],
        screenshot: await auditor.capture('screen', route.name, 'top'),
      });
    }
  }
}

/** Reads the locale's own copy for the Start workout button; English when it has none. */
function startWorkoutLabel(locale: string): string {
  for (const dir of [locale.toLowerCase(), 'en-us']) {
    try {
      const copy = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'lang', 'locales', dir, 'workout.json'), 'utf8')
      ) as { workout?: { startWorkout?: string } };
      if (copy.workout?.startWorkout) {
        return copy.workout.startWorkout;
      }
    } catch {
      // Try the next directory.
    }
  }

  return 'Start workout';
}

/** The live session is reached by starting a workout from the library, never by URL. */
async function auditWorkoutSession(page: Page, auditor: Auditor, locale: string): Promise<void> {
  const name = 'workout-session';
  const url = `${APP_URL}/workout/workout-session`;
  if (!wanted(name)) {
    return;
  }

  try {
    await page.goto(`${APP_URL}/workout/workouts`, { timeout: 60000 });
    await auditor.settle();
    const label = startWorkoutLabel(locale);
    const start = page
      .getByRole('button', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .first();
    if ((await start.count()) === 0) {
      auditor.record({
        surface: 'screen',
        name,
        url,
        status: 'skipped',
        note: `no "${label}" button on the workouts screen (no template in the demo data?)`,
      });
      return;
    }

    await start.click();
    await page.waitForURL(/workout-session/, { timeout: 20000 });
    await auditor.settle(2000);
    await auditor.audit({ surface: 'screen', name, url: page.url(), onlyNew: false });
  } catch (error) {
    auditor.record({
      surface: 'screen',
      name,
      url,
      status: 'skipped',
      note: `could not start a workout: ${(error as Error).message.split('\n')[0]}`,
    });
  }
}

async function auditModals(page: Page, auditor: Auditor): Promise<void> {
  const fixtureUrl = `${APP_URL}/test/modals`;
  await page.goto(fixtureUrl, { timeout: 60000 });
  await auditor.settle();
  if (!page.url().includes('/test/modals')) {
    auditor.record({
      surface: 'modal',
      name: 'modals-fixture',
      url: fixtureUrl,
      status: 'skipped',
      note: 'the /app/test/modals fixture redirected; build with EXPO_PUBLIC_SCREENSHOT_MODE=1',
    });
    return;
  }

  for (const text of MODAL_AUDIT_BUTTONS.filter(wanted)) {
    try {
      console.log(`[layout] modal: ${text}`);
      const button = page.getByText(text, { exact: true }).first();
      if ((await button.count()) === 0) {
        auditor.record({
          surface: 'modal',
          name: text,
          url: fixtureUrl,
          status: 'skipped',
          note: 'button not found on the fixture',
        });
        continue;
      }

      await page.evaluate(markBaseline);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await auditor.settle(1000);
      await auditor.audit({ surface: 'modal', name: text, url: fixtureUrl, onlyNew: true });
    } catch (error) {
      auditor.record({
        surface: 'modal',
        name: text,
        url: fixtureUrl,
        status: 'failed',
        note: (error as Error).message.split('\n')[0],
        screenshot: await auditor.capture('modal', text, 'top'),
      });
    } finally {
      // Some fixture modals cannot be dismissed with Escape; a reload starts the next one clean.
      await page.reload({ timeout: 60000 }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
  }
}

/**
 * Seeds the demo data (in English: the labels clicked below are English), then moves the app to
 * `locale` the way a person does and proves it renders there.
 */
async function seedInLocale(
  page: Page,
  auditor: Auditor,
  locale: string,
  signatures: string[]
): Promise<void> {
  await seedDemoData(page);
  if (signatures.length > 0) {
    await selectAppLanguage(page, locale);
  }

  await page.goto(APP_URL, { timeout: 60000 });
  await auditor.settle();
  await assertRendersLocale(page, locale, signatures);
}

for (const localeSpec of LOCALES) {
  const pseudo = localeSpec === 'pseudo';
  const locale = pseudo ? PSEUDO_BASE_LOCALE : localeSpec;
  const signatures = localeSignatures(locale);

  test.describe(`layout audit [${localeSpec}]`, () => {
    test.use({ reducedMotion: 'reduce', actionTimeout: 15000 });
    test.setTimeout(3_600_000);

    // Demo seeding leaves the stored language English whatever the browser says, so a seeded app
    // is audited in a browser that says English and then switched through Settings.
    test.describe('seeded', () => {
      test.use({ locale: 'en-US' });

      test('screens', async ({ page }, testInfo) => {
        test.skip(!SURFACES.has('screens'), 'screens are not selected');
        const auditor = createAuditor(page, testInfo, localeSpec, signatures, 'screens');
        try {
          await installFixtureRoutes(page);
          await seedInLocale(page, auditor, locale, signatures);
          await auditRoutes(page, auditor, MAIN_ROUTES, 'screen', locale, signatures);
          await auditWorkoutSession(page, auditor, locale);
        } finally {
          auditor.flush('screens');
        }
      });

      test('modals', async ({ page }, testInfo) => {
        test.skip(!SURFACES.has('modals'), 'modals are not selected');
        const auditor = createAuditor(page, testInfo, localeSpec, signatures, 'modals');
        try {
          await installFixtureRoutes(page);
          await seedInLocale(page, auditor, locale, signatures);
          await auditModals(page, auditor);
        } finally {
          auditor.flush('modals');
        }
      });
    });

    // A fresh install has no stored language yet, so it follows the browser's locale.
    test.describe('fresh install', () => {
      test.use({ locale });

      test('onboarding', async ({ page }, testInfo) => {
        test.skip(!SURFACES.has('onboarding'), 'onboarding is not selected');
        const auditor = createAuditor(page, testInfo, localeSpec, signatures, 'onboarding');
        try {
          await installFixtureRoutes(page);
          await auditRoutes(page, auditor, ONBOARDING_ROUTES, 'onboarding', locale, signatures);
        } finally {
          auditor.flush('onboarding');
        }
      });
    });
  });
}
