import type { Locator, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { countOpenLayers } from './inPage';
import type { AuditFlow } from './routes';

/**
 * What a flow (`tests/layoutAudit/flows/`) gets from the spec: the page, the locale's copy and a
 * way to measure each step it reaches. A flow drives the app the way a person does (taps, never a
 * hand-made URL where a tap reaches the same state) and names every step it measures; the names
 * are declared in `AUDIT_FLOWS` (`routes.ts`), and measuring an undeclared one fails the step.
 */
export interface FlowContext {
  page: Page;
  /** The app's language for this run, e.g. `ru-RU`. */
  locale: string;
  /** The locale's own copy at `lang/locales/<locale>/<file>.json` → `keyPath` (English fallback). */
  copy: (file: string, keyPath: string[], fallback?: string) => string;
  /** Waits for the page to finish loading and its text to stop changing. */
  settle: (extraMs?: number) => Promise<void>;
  /** Measures the whole page as `step` (a variant such as a page number goes inside the brackets). */
  screen: (step: string, variant?: string) => Promise<void>;
  /** Measures only the topmost open overlay (a sheet, a modal, a tour page) as `step`. */
  overlay: (step: string, variant?: string) => Promise<void>;
  /** Records that `step` could not be reached, and why. */
  skip: (step: string, note: string, variant?: string) => void;
  /** The live rows of a table in the app's own database (read-only; see `readLokiChunks`). */
  rows: (table: string) => Promise<Record<string, unknown>[]>;
}

export type FlowRunner = (ctx: FlowContext) => Promise<void>;

/** `weekly-review (applied)` + `2` → `weekly-review (applied 2)`. */
export function stepName(step: string, variant?: string): string {
  if (!variant) {
    return step;
  }

  return step.endsWith(')') ? `${step.slice(0, -1)} ${variant})` : `${step} (${variant})`;
}

/** The declared step a measured name belongs to, or null when the flow never declared it. */
export function declaredStep(flow: AuditFlow, name: string): string | null {
  return (
    flow.steps.find(
      (step) => name === step || (step.endsWith(')') && name.startsWith(`${step.slice(0, -1)} `))
    ) ?? null
  );
}

/**
 * A flow runs when `MUSCLOG_LAYOUT_ONLY` names it or any of its steps; it then measures the steps
 * that are wanted (all of them when the flow itself is named). It still drives through the others,
 * because a later step's state is built on the earlier ones.
 */
export function flowSelection(
  flow: AuditFlow,
  wanted: (name: string) => boolean
): { runs: boolean; measures: (step: string) => boolean } {
  const whole = wanted(flow.name);
  return {
    runs: whole || flow.steps.some(wanted),
    measures: (step) => whole || wanted(step),
  };
}

const COPY_ROOT = path.resolve(__dirname, '..', '..', 'lang', 'locales');

/**
 * Reads one string of the locale's own copy (`lang/locales/<locale>/<file>.json`, at `keyPath`);
 * English when the locale has none, `fallback` when neither does.
 */
export function localeCopy(
  locale: string,
  file: string,
  keyPath: string[],
  fallback: string,
  root: string = COPY_ROOT
): string {
  for (const dir of [locale.toLowerCase(), 'en-us']) {
    try {
      let value: unknown = JSON.parse(fs.readFileSync(path.join(root, dir, `${file}.json`), 'utf8'));
      for (const key of keyPath) {
        value = (value as Record<string, unknown> | undefined)?.[key];
      }

      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    } catch {
      // Try the next directory.
    }
  }

  return fallback;
}

/** i18next's `{{name}}` placeholders, so a label with one can still be matched. */
export function copyPattern(copy: string, { prefix = false } = {}): RegExp {
  const parts = copy.split(/\{\{[^}]+\}\}/).map(escapeRegExp);
  return new RegExp(`^${parts.join('.+?')}${prefix ? '' : '$'}`);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The persisted rows of `table` from the entries of LokiJS's IndexedDB store (`loki.db` →
 * `LokiIncrementalData`, one `<table>.chunk.<n>` entry per chunk of rows): soft-deleted and
 * tombstoned rows left out. Pure, so the parsing is tested without a browser.
 */
export function liveRows(
  entries: { key: string; value: string }[],
  table: string
): Record<string, unknown>[] {
  return entries
    .filter((entry) => entry.key.startsWith(`${table}.chunk.`))
    .flatMap((entry) => JSON.parse(entry.value) as Record<string, unknown>[])
    .filter((row) => row._status !== 'deleted' && row.deleted_at == null);
}

/**
 * Runs in the page: every entry of the app's LokiJS store. What it returns is what has been saved,
 * which trails a write by LokiJS's autosave (500 ms); callers wait that out first. Read-only: the
 * audit learns ids from it (a set's order, an exercise id) and never writes.
 */
export async function readLokiChunks(): Promise<{ key: string; value: string }[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('loki.db');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction('LokiIncrementalData')
        .objectStore('LokiIncrementalData')
        .getAll();
      request.onsuccess = () => resolve(request.result as { key: string; value: string }[]);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Clicks the match that is really on top at its centre. react-native-web keeps a tab view's other
 * panes and a closing sheet in the DOM, so a label can match a copy that sits under something else;
 * Playwright would wait for that one until it times out.
 */
export async function clickTopmost(locator: Locator): Promise<void> {
  const count = await locator.count();
  for (let index = 0; index < count; index++) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
    const onTop = await candidate
      .evaluate((node) => {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) {
          return false;
        }

        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return !!hit && (hit === node || node.contains(hit));
      })
      .catch(() => false);
    if (onTop) {
      await candidate.click();
      return;
    }
  }

  // Nothing on screen: bring the first match into view and let Playwright report what blocks it.
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().click({ timeout: 5000 });
}

/**
 * Closes the topmost overlay the way a person would: Escape (react-native-web hands it to the
 * Modal's `onRequestClose`), then the overlay's own Close or Back button. Throws when it stays
 * open, because every later step would be measured under it.
 */
export async function closeOverlay(ctx: FlowContext): Promise<void> {
  const { page } = ctx;
  const before = await page.evaluate(countOpenLayers);
  if (before === 0) {
    return;
  }

  const closed = async () => {
    await page.waitForTimeout(700);
    return (await page.evaluate(countOpenLayers)) < before;
  };

  await page.keyboard.press('Escape');
  if (await closed()) {
    return;
  }

  for (const key of ['close', 'back', 'cancel']) {
    const label = ctx.copy('common', ['common', key], '');
    const button = page.getByRole('button', { name: label, exact: true });
    if (label && (await button.count()) > 0) {
      await clickTopmost(button).catch(() => undefined);
      if (await closed()) {
        return;
      }
    }
  }

  throw new Error(`could not close the overlay on ${page.url()}`);
}
