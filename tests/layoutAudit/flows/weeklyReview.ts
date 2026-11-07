import { APP_URL } from '@/tests/helpers/screenshotSession';

import {
  clickTopmost,
  closeOverlay,
  copyPattern,
  escapeRegExp,
  type FlowContext,
  type FlowRunner,
} from '@/tests/layoutAudit/flowKit';

/** Far enough ahead that the latest reviewed week holds no activity at all. */
const WEEK_OFF_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Weekly Review decided the way a person decides it. The seeded week is short of weigh-ins, so
 * the nutrition half opens collecting data; switching to weekly targets offers to log the missing
 * weigh-in on its day, which makes the recommendation ready to edit and apply. Then an earlier
 * stored review, a legacy check-in, and a later week with nothing logged (the clock moved on).
 * The welcome sheet and the untouched screen are the `weekly-review` route's.
 */
export const weeklyReviewFlow: FlowRunner = async (ctx) => {
  const { page } = ctx;
  const wr = (...keys: string[]) => ctx.copy('workoutSession', ['weeklyReview', ...keys]);
  const button = (name: string | RegExp) =>
    page.getByRole('button', typeof name === 'string' ? { name, exact: true } : { name });

  await page.goto(`${APP_URL}/weekly-review`, { timeout: 60000 });
  await ctx.settle();
  const welcome = page.getByTestId('weekly-review-welcome');
  if ((await welcome.count()) > 0) {
    await clickTopmost(button(wr('welcome', 'cta')));
    await welcome.waitFor({ state: 'detached', timeout: 10000 });
    await ctx.settle(600);
  }

  // The confirm button names the recommended choice, which depends on the week (the seeded goals
  // can make it a repeat or a lighter week).
  const confirm = page.getByRole('button', {
    name: new RegExp(
      `^(${['progress', 'repeat', 'lighter']
        .map((choice) => escapeRegExp(wr('trainingDecision', choice, 'confirm')))
        .join('|')})$`
    ),
  });
  await tapIfOffered(ctx, confirm, 'weekly-review (training decided)', async () => {
    await ctx.screen('weekly-review (training decided)');
  });

  await tapIfOffered(
    ctx,
    button(wr('switchWeekly')),
    'weekly-review (weekly targets)',
    async () => {
      await ctx.screen('weekly-review (weekly targets)');
    }
  );

  await tapIfOffered(
    ctx,
    button(copyPattern(wr('logWeightOn'))),
    'weekly-review (log weight)',
    async () => {
      await ctx.overlay('weekly-review (log weight)');
      // The entry opens on the missing day with a weight filled in; saving it is the weigh-in.
      await clickTopmost(button(ctx.copy('bodyMetrics', ['bodyMetrics', 'addEntry', 'saveEntry'])));
      await ctx.settle(1500);
    }
  );
  await ctx.screen('weekly-review (recommendation ready)');

  await tapIfOffered(
    ctx,
    button(wr('editShort')),
    'weekly-review (edit recommendation)',
    async () => {
      await ctx.overlay('weekly-review (edit recommendation)');
      await closeOverlay(ctx);
    }
  );

  await tapIfOffered(ctx, button(wr('applyTomorrow')), 'weekly-review (applied)', async () => {
    await ctx.screen('weekly-review (applied)');
  });

  // History lists stored reviews by their period, then legacy check-ins as "Earlier review · date".
  const legacyPattern = copyPattern(`${wr('legacy')} · {{date}}`);
  const stored = page
    .getByRole('button', { name: copyPattern(wr('period')) })
    .filter({ hasNotText: wr('legacy') });
  await tapIfOffered(ctx, stored, 'weekly-review (earlier review)', async () => {
    await ctx.screen('weekly-review (earlier review)');
    await clickTopmost(button(wr('latest')));
    await ctx.settle(800);
  });

  await tapIfOffered(ctx, button(legacyPattern), 'weekly-review (legacy check-in)', async () => {
    await ctx.overlay('weekly-review (legacy check-in)');
    await closeOverlay(ctx);
  });

  await page.clock.setFixedTime(new Date(Date.now() + WEEK_OFF_DAYS * DAY_MS));
  await page.reload({ timeout: 60000 });
  await ctx.settle(1500);
  await ctx.screen('weekly-review (week off)');
};

/**
 * Taps the first visible match and runs `then`; when the screen does not offer it (the data did not
 * lead there), records the step as skipped instead of failing everything after it.
 */
async function tapIfOffered(
  ctx: FlowContext,
  target: ReturnType<FlowContext['page']['getByRole']>,
  step: string,
  then: () => Promise<void>
): Promise<void> {
  const visible = target.filter({ visible: true });
  if ((await visible.count()) === 0) {
    ctx.skip(step, 'the screen did not offer the button that leads here');
    return;
  }

  await clickTopmost(visible);
  await ctx.settle(1000);
  await then();
}
