import { APP_URL } from '@/tests/helpers/screenshotSession';
import { COMEBACK_RAMP_WEEKS } from '@/utils/comeback/comebackProgram';
import { COMEBACK_OFFER_MIN_GAP_DAYS, COMEBACK_STALL_DAYS } from '@/utils/comeback/lapse';

import {
  clickTopmost,
  closeOverlay,
  type FlowContext,
  type FlowRunner,
} from '@/tests/layoutAudit/flowKit';
import { countOpenLayers } from '@/tests/layoutAudit/inPage';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A comeback from offer to graduation. The demo has activity up to today, so the clock moves on
 * past the lapse threshold and Home offers a comeback; its setup is walked step by step and
 * finished, then the running plan, its tailor and edit questionnaires, a stall and graduation are
 * each reached by moving the clock again. Nothing is written to fake a state.
 */
export const comebackFlow: FlowRunner = async (ctx) => {
  const { page } = ctx;
  const start = Date.now() + (COMEBACK_OFFER_MIN_GAP_DAYS + 2) * DAY_MS;

  await atTime(ctx, start, APP_URL);
  const offer = page.getByTestId('comeback-card-offer');
  await offer.waitFor({ timeout: 20000 });
  await offer.scrollIntoViewIfNeeded();
  await ctx.screen('comeback (home offer)');

  await clickTopmost(page.getByTestId('comeback-offer-start'));
  await ctx.settle(1000);
  await walkSetup(ctx, 'comeback (setup)');
  await ctx.settle(1500);

  const active = page.getByTestId('comeback-card-active');
  await active.waitFor({ timeout: 20000 });
  await active.scrollIntoViewIfNeeded();
  await ctx.screen('comeback (home active)');

  await clickTopmost(page.getByTestId('comeback-tailor'));
  await ctx.settle(1000);
  await walkSetup(ctx, 'comeback (tailor)', { finish: false });

  await page.goto(`${APP_URL}/comeback`, { timeout: 60000 });
  await ctx.settle();
  await ctx.screen('comeback (running)');
  await clickTopmost(
    page.getByText(ctx.copy('comeback', ['comeback', 'screen', 'edit']), { exact: true })
  );
  await ctx.settle(1000);
  await walkSetup(ctx, 'comeback (edit)', { finish: false });

  await atTime(ctx, start + (COMEBACK_STALL_DAYS + 1) * DAY_MS, APP_URL);
  const stalled = page.getByTestId('comeback-card-stalled');
  await stalled.waitFor({ timeout: 20000 });
  await stalled.scrollIntoViewIfNeeded();
  await ctx.screen('comeback (home stalled)');

  await atTime(ctx, start + (COMEBACK_RAMP_WEEKS * 7 + 1) * DAY_MS, `${APP_URL}/comeback`);
  await ctx.screen('comeback (graduated)');
};

/** Opens `url` with the page's clock fixed at `at`, as if the person came back that day. */
async function atTime(ctx: FlowContext, at: number, url: string): Promise<void> {
  await ctx.page.clock.setFixedTime(new Date(at));
  await ctx.page.goto(url, { timeout: 60000 });
  await ctx.settle(1500);
}

/**
 * Measures each step of the comeback questionnaire, moving on with its own Next (the default
 * answers are valid on every step). The last step's button no longer says Next: it starts or saves
 * the plan. With `finish: false` the questionnaire is closed there instead, leaving the running
 * plan as it was.
 */
async function walkSetup(
  ctx: FlowContext,
  step: string,
  { finish = true }: { finish?: boolean } = {}
): Promise<void> {
  const { page } = ctx;
  const next = page.getByTestId('comeback-next').filter({ visible: true }).last();
  const nextLabel = ctx.copy('common', ['common', 'next']);
  for (let number = 1; number <= 15; number++) {
    await ctx.overlay(step, String(number));
    const onLastStep = (await next.innerText()).trim() !== nextLabel;
    if (onLastStep && !finish) {
      await closeOverlay(ctx);
      return;
    }

    const before = await page.evaluate(countOpenLayers);
    await clickTopmost(next);
    await ctx.settle(800);
    if (onLastStep || (await page.evaluate(countOpenLayers)) < before) {
      return;
    }
  }

  throw new Error(`the ${step} questionnaire never reached its last step`);
}
