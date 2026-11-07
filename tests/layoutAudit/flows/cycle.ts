import { APP_URL } from '@/tests/helpers/screenshotSession';
import { CYCLE_REMINDER_KINDS } from '@/utils/cycle/cycleReminders';

import {
  clickTopmost,
  closeOverlay,
  copyPattern,
  escapeRegExp,
  type FlowContext,
  type FlowRunner,
} from '@/tests/layoutAudit/flowKit';

/**
 * The cycle screen with records behind it (the demo's four periods plus the audit seed's day logs
 * and context): a logged day's sheet opened from the calendar, each sheet the screen
 * opens, the three history tabs besides the calendar with a period opened for editing, and the
 * explainer a tapped reminder opens.
 */
export const cycleFlow: FlowRunner = async (ctx) => {
  const { page } = ctx;
  const cy = (...keys: string[]) => ctx.copy('cycle', ['cycle', ...keys]);
  const open = async (step: string, label: string | RegExp, kind: 'screen' | 'overlay') => {
    const target = page
      .getByRole(
        'button',
        typeof label === 'string' ? { name: label, exact: true } : { name: label }
      )
      .filter({ visible: true });
    if ((await target.count()) === 0) {
      ctx.skip(step, 'the cycle screen did not offer the button that leads here');
      return false;
    }

    await clickTopmost(target);
    await ctx.settle(1000);
    await (kind === 'overlay' ? ctx.overlay(step) : ctx.screen(step));
    return true;
  };

  await page.goto(`${APP_URL}/cycle`, { timeout: 60000 });
  await ctx.settle();

  // A calendar day whose label says something was logged (the seed logs two days this month);
  // tapping it opens that day's log.
  const logged = new RegExp(`, ${escapeRegExp(cy('calendar', 'a11y', 'observation'))}`);
  if (await open('cycle (day log)', logged, 'overlay')) {
    await closeOverlay(ctx);
  }

  for (const [step, key] of [
    ['cycle (prediction details)', ['prediction', 'howCalculated']],
    ['cycle (appointment summary)', ['settings', 'summaryCreate']],
    ['cycle (log past period)', ['actions', 'logPastPeriod']],
  ] as const) {
    if (await open(step, cy(...key), 'overlay')) {
      await closeOverlay(ctx);
    }
  }

  await historyTab(ctx, cy('history', 'tabHistory'), 'cycle (periods)');
  if (
    await open(
      'cycle (edit period)',
      copyPattern(`{{range}}. ${cy('history', 'editHint')}`),
      'overlay'
    )
  ) {
    await closeOverlay(ctx);
  }

  if (await open('cycle (life stage)', cy('settings', 'changeContext'), 'overlay')) {
    await closeOverlay(ctx);
  }

  await historyTab(ctx, cy('comparison', 'tab'), 'cycle (compare)');
  await historyTab(ctx, cy('complete', 'trends'), 'cycle (trends)');

  // Tapping a cycle reminder opens the screen with `?reminder=<kind>`, which explains the reminder
  // ("why did I get this?"). Web never delivers the notification, so the link it carries is used.
  await page.goto(`${APP_URL}/cycle?reminder=${CYCLE_REMINDER_KINDS[0]}`, { timeout: 60000 });
  await ctx.settle(1000);
  await ctx.overlay('cycle (reminder explainer)');
};

/** The history section's tabs are plain text controls under the calendar. */
async function historyTab(ctx: FlowContext, label: string, step: string): Promise<void> {
  await clickTopmost(ctx.page.getByText(label, { exact: true }));
  await ctx.settle(1000);
  await ctx.screen(step);
}
