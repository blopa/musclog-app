import fs from 'fs';
import path from 'path';

import { WHATS_NEW_SEEN_THROUGH_KEY } from '@/constants/whatsNew';
import { APP_URL } from '@/tests/helpers/screenshotSession';

import {
  clickTopmost,
  closeOverlay,
  copyPattern,
  type FlowContext,
  type FlowRunner,
} from '@/tests/layoutAudit/flowKit';
import { countOpenLayers } from '@/tests/layoutAudit/inPage';

/** A version older than every announcement, as an upgrade from an old install has stored. */
const OLD_SEEN_THROUGH = '2.0.0';

/** The tour's actions that open a modal inside it (`WHATS_NEW_ACTION_CATALOG`), by step. */
const MODAL_ACTION_STEPS: Record<string, string> = {
  openWorkoutSettings: 'whats-new (workout settings)',
  openCardioLog: 'whats-new (cardio log)',
};

interface ReleaseBlock {
  type: string;
  action?: string;
  labelKey?: string;
  items?: { action?: string; labelKey?: string }[];
}

/**
 * The label key of every modal action in the bundled releases, by action. Read from the release
 * files rather than listed here, so a new page with one of these actions is opened too.
 */
export function modalActionLabelKeys(
  releases: { pages: { blocks: ReleaseBlock[] }[] }[]
): Map<string, string> {
  const keys = new Map<string, string>();
  for (const block of releases.flatMap((release) => release.pages.flatMap((page) => page.blocks))) {
    for (const entry of [block, ...(block.items ?? [])]) {
      if (entry.action && entry.labelKey && entry.action in MODAL_ACTION_STEPS) {
        if (!keys.has(entry.action)) {
          keys.set(entry.action, entry.labelKey);
        }
      }
    }
  }

  return keys;
}

function bundledReleases() {
  const dir = path.resolve(__dirname, '..', '..', '..', 'data', 'whatsNew');
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
}

/**
 * The What's new tour as an upgrader meets it on Home (every release since the stored version,
 * merged), page by page with each modal action opened once, then the Settings replay of the newest
 * release. The tour is never finished or skipped, so nothing marks it seen.
 */
export const whatsNewFlow: FlowRunner = async (ctx) => {
  const { page } = ctx;
  await page.goto(APP_URL, { timeout: 60000 });
  await ctx.settle();
  await page.evaluate(
    ([key, version]) => localStorage.setItem(key, version),
    [WHATS_NEW_SEEN_THROUGH_KEY, OLD_SEEN_THROUGH]
  );
  // AsyncStorage is localStorage on web; the reload re-runs the once-per-session check.
  await page.reload({ timeout: 60000 });
  await ctx.settle(2000);
  await page.waitForFunction(countOpenLayers, undefined, { timeout: 30000 });

  const pending = modalActionLabelKeys(bundledReleases());
  await walkTour(ctx, 'whats-new (tour intro)', 'whats-new (tour page)', pending);
  for (const [action] of pending) {
    ctx.skip(MODAL_ACTION_STEPS[action], 'no page of the tour offered this action');
  }

  await page.goto(`${APP_URL}/settings`, { timeout: 60000 });
  await ctx.settle();
  await clickTopmost(page.getByText(ctx.copy('whatsNew', ['whatsNew', 'settingsCard', 'title'])));
  await ctx.settle(1000);
  await walkTour(ctx, 'whats-new (replay intro)', 'whats-new (replay page)', new Map());
};

/**
 * Measures the intro, then every page through Next until the last (whose button says Done), and
 * opens each still-pending modal action on the page that offers it.
 */
async function walkTour(
  ctx: FlowContext,
  introStep: string,
  pageStep: string,
  pending: Map<string, string>
): Promise<void> {
  const { page } = ctx;
  const next = page.getByRole('button', {
    name: ctx.copy('whatsNew', ['whatsNew', 'next']),
    exact: true,
  });
  await ctx.overlay(introStep);
  for (let number = 1; number <= 30 && (await next.count()) > 0; number++) {
    await clickTopmost(next);
    await ctx.settle(600);
    await ctx.overlay(pageStep, String(number));
    for (const [action, labelKey] of [...pending]) {
      const label = ctx.copy('whatsNew', labelKey.split('.'));
      const button = page
        .getByRole('button', { name: copyPattern(label, { prefix: true }) })
        .filter({ visible: true })
        .first();
      if (!(await button.isVisible().catch(() => false))) {
        continue;
      }

      await clickTopmost(button);
      await ctx.settle(1000);
      await ctx.overlay(MODAL_ACTION_STEPS[action]);
      await closeOverlay(ctx);
      pending.delete(action);
    }
  }
}
