import { APP_URL } from '@/tests/helpers/screenshotSession';

import {
  clickTopmost,
  closeOverlay,
  type FlowContext,
  type FlowRunner,
} from '@/tests/layoutAudit/flowKit';

/** A loose entry of the demo's diary (seed data is English in every locale). */
const LOOSE_FOOD = 'Greek Yogurt';

/**
 * The food diary with today's entries (the demo's plus the audit seed's snack, "other" entry and
 * a saved meal logged as one group): a loose entry and the group opened, My meals and a saved meal
 * in it, the day summary menu, and the bulk selection a long press starts.
 */
export const diaryFlow: FlowRunner = async (ctx) => {
  const { page } = ctx;
  await page.goto(`${APP_URL}/nutrition/food`, { timeout: 60000 });
  await ctx.settle();

  await clickTopmost(page.getByText(LOOSE_FOOD, { exact: true }));
  await ctx.settle(1000);
  await ctx.overlay('diary (food entry)');
  await closeOverlay(ctx);

  const group = (await ctx.rows('nutrition_logs')).find(
    (row) => row.group_id && typeof row.logged_meal_name === 'string'
  );
  if (group) {
    await clickTopmost(page.getByText(String(group.logged_meal_name), { exact: true }));
    await ctx.settle(1000);
    await ctx.overlay('diary (grouped meal)');
    await closeOverlay(ctx);
  } else {
    ctx.skip('diary (grouped meal)', 'no grouped meal in the diary (the audit seed logs one)');
  }

  await clickTopmost(
    page.getByRole('button', { name: ctx.copy('meals', ['meals', 'title']), exact: true })
  );
  await ctx.settle(1000);
  await ctx.overlay('diary (my meals)');
  // A saved meal opens through its card's menu; Track there opens the meal itself. The meal is the
  // first one the list shows without scrolling.
  const viewport = page.viewportSize()?.height ?? 0;
  let card = null;
  for (const name of (await ctx.rows('meals')).map((row) => String(row.name ?? ''))) {
    const title = page.getByText(name, { exact: true }).filter({ visible: true }).first();
    const box = name ? await title.boundingBox().catch(() => null) : null;
    if (box && box.y > 0 && box.y + box.height < viewport) {
      card = title.locator(
        'xpath=ancestor::div[descendant::button or descendant::*[@role="button"]][1]'
      );
      break;
    }
  }

  if (card && (await card.count()) > 0) {
    await clickTopmost(card.getByRole('button').last());
    await ctx.settle(800);
    await ctx.overlay('diary (meal options)');
    await clickTopmost(
      page.getByText(ctx.copy('food', ['food', 'actions', 'track']), { exact: true })
    );
    await ctx.settle(1200);
    await ctx.overlay('diary (saved meal)');
    await closeOverlay(ctx);
  } else {
    ctx.skip('diary (meal options)', 'My meals listed no saved meal to open');
    ctx.skip('diary (saved meal)', 'My meals listed no saved meal to open');
  }

  await closeOverlay(ctx);

  await clickTopmost(page.getByTestId('daily-summary-menu'));
  await ctx.settle(800);
  await ctx.overlay('diary (day summary menu)');
  await closeOverlay(ctx);

  await longPress(ctx, LOOSE_FOOD);
  await ctx.settle(800);
  await ctx.screen('diary (selection)');
};

/** A press held long enough for react-native-web's `onLongPress` (500 ms). */
async function longPress(ctx: FlowContext, text: string): Promise<void> {
  const target = ctx.page.getByText(text, { exact: true }).filter({ visible: true }).first();
  await target.evaluate((node) => node.scrollIntoView({ block: 'center' }));
  const box = await target.boundingBox();
  if (!box) {
    throw new Error(`"${text}" has no box to press`);
  }

  await ctx.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await ctx.page.mouse.down();
  await ctx.page.waitForTimeout(900);
  await ctx.page.mouse.up();
}
