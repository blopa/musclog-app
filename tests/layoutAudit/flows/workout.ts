import { APP_URL } from '@/tests/helpers/screenshotSession';
import {
  clickTopmost,
  closeOverlay,
  type FlowContext,
  type FlowRunner,
} from '@/tests/layoutAudit/flowKit';

/** The demo template whose first two exercises share a superset group (`seedDevData`). */
export const SUPERSET_TEMPLATE = 'Grouped Test Workout';

/**
 * A live workout, end to end: start the demo's superset template from the library, look at both
 * views, add warm-ups, finish one, skip a set, complete working sets, let the rest timer run down
 * (−15 s until "Get ready", then out), open the session's sheets, finish and look at the summary.
 *
 * The rest timer, rest over and exercise transition SCREENS (`app/app/workout/rest-*.tsx`,
 * `exercise-transition.tsx`) are no longer navigated to by the session, which shows its rest in
 * `RestTimerBar`; they still ship and open from a link. They are measured by URL with the live
 * session's real ids (read from the app's database), which is the only way to reach them.
 */
export const workoutFlow: FlowRunner = async (ctx) => {
  const { page } = ctx;
  const tf = (key: string) => ctx.copy('workoutSession', ['trainingFlow', key]);

  await page.goto(`${APP_URL}/workout/workouts`, { timeout: 60000 });
  await ctx.settle();
  const card = page
    .getByTestId('workout-card-preview')
    .filter({ hasText: SUPERSET_TEMPLATE })
    .locator('xpath=..');
  await clickTopmost(
    card.getByRole('button', { name: ctx.copy('startWorkout', ['startWorkout', 'start']) })
  );
  await page.waitForURL(/workout-session/, { timeout: 30000 });
  await ctx.settle(2000);
  const sessionUrl = page.url();
  const workoutLogId = new URL(sessionUrl).searchParams.get('workoutLogId');

  await clickTopmost(page.getByText(tf('guided'), { exact: true }));
  await ctx.settle(800);
  await ctx.screen('workout-session (guided)');

  await clickTopmost(page.getByText(tf('inline'), { exact: true }));
  await ctx.settle(800);
  await ctx.screen('workout-session (inline)');

  // Set states: warm-ups added to the first exercise, one done, one skipped, then the superset's
  // two working sets completed, which starts a working rest.
  await clickTopmost(
    page.getByRole('button', {
      name: ctx.copy('workoutSession', ['trainingFlow', 'actions', 'warmup']),
      exact: true,
    })
  );
  await ctx.settle(800);
  const completeIds = await page
    .locator('[data-testid^="set-"][data-testid$="-complete"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));
  if (completeIds.length < 6) {
    throw new Error(`expected warm-ups plus four working sets, found ${completeIds.length} sets`);
  }

  await clickTopmost(page.getByTestId(completeIds[0]));
  await ctx.settle(800);
  const skip = page.getByTestId(completeIds[1].replace(/-complete$/, '-skip'));
  await clickTopmost((await skip.count()) > 0 ? skip : page.locator('[data-testid$="-skip"]'));
  await ctx.settle(800);
  // The first working set comes after the four warm-ups; its superset partner right after it.
  await clickTopmost(page.getByTestId(completeIds[completeIds.length - 4]));
  await page.waitForTimeout(800);
  await clickTopmost(page.getByTestId(completeIds[completeIds.length - 3]));
  await ctx.settle(800);
  await ctx.screen('workout-session (set states)');

  await restTimerSteps(ctx, tf);
  await sessionSheets(ctx, tf);

  if (workoutLogId) {
    // The rest timer screen resumes the session's stored rest and leaves at once when it has run
    // out, so a fresh rest is started first: the next exercise's working set.
    await clickTopmost(page.getByTestId(completeIds[completeIds.length - 2]));
    await ctx.settle(800);
    await legacyRestScreens(ctx, workoutLogId);
    await page.goto(sessionUrl, { timeout: 60000 });
    await ctx.settle(1500);
  } else {
    for (const step of ['workout-rest-timer', 'workout-rest-over', 'workout-exercise-transition']) {
      ctx.skip(step, 'the session URL carried no workoutLogId');
    }
  }

  await clickTopmost(page.getByRole('button', { name: tf('finish'), exact: true }));
  await ctx.settle(800);
  await ctx.overlay('workout-session (end workout)');
  await clickTopmost(
    page.getByRole('button', { name: ctx.copy('endWorkout', ['endWorkout', 'finishAndSave']) })
  );
  await page.waitForURL(/workout-summary/, { timeout: 30000 });
  await ctx.settle(2500);
  await ctx.screen('workout-summary');

  await clickTopmost(
    page.getByRole('button', { name: ctx.copy('sessionFeedback', ['sessionFeedback', 'title']) })
  );
  await ctx.settle(800);
  await ctx.overlay('workout-summary (session feedback)');
};

/** The rest bar while resting (expanded), in its last seconds, and after it ran out. */
async function restTimerSteps(ctx: FlowContext, tf: (key: string) => string): Promise<void> {
  const { page } = ctx;
  const bar = page.getByTestId('session-rest-timer');
  const label = async () => (await bar.innerText()).replace(/\s+/g, ' ');
  // "Skip rest" is offered only while a rest is counting down.
  if (!(await label()).includes(tf('skipRest'))) {
    throw new Error(`no rest was running after the sets were completed (bar: ${await label()})`);
  }

  await clickTopmost(bar.getByRole('button').first());
  await page.waitForTimeout(600);
  await ctx.screen('workout-session (rest panel)');

  // The countdown keeps moving, so these two are measured as soon as they show, not after the
  // usual wait for the text to settle.
  const getReady = tf('getReady');
  // −15 s at a time until about 20 s are left, then wait: one press too many jumps straight past
  // the "Get ready" window to the end of the rest.
  const remaining = async () => {
    const match = /(\d+):(\d{2})/.exec(await label());
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  };

  for (let press = 0; press < 12 && (await remaining()) > 20; press++) {
    await clickTopmost(bar.getByRole('button', { name: tf('minus15'), exact: true }));
    await page.waitForTimeout(300);
  }

  await page
    .waitForFunction(
      ({ testId, text }) =>
        document.querySelector(`[data-testid="${testId}"]`)?.textContent?.includes(text) ?? false,
      { testId: 'session-rest-timer', text: getReady },
      { timeout: 25000 }
    )
    .catch(() => undefined);

  if ((await label()).includes(getReady)) {
    await ctx.screen('workout-session (get ready)');
  } else {
    ctx.skip('workout-session (get ready)', `the rest never showed "${getReady}"`);
  }

  await page
    .waitForFunction(
      ({ testId, ready }) =>
        document.querySelector(`[data-testid="${testId}"]`)?.textContent?.includes(ready) ?? false,
      { testId: 'session-rest-timer', ready: tf('restReady') },
      { timeout: 30000 }
    )
    .catch(() => undefined);
  await ctx.screen('workout-session (rest over)');
}

/** The sheets a set and an exercise open: effort and details, "Why?", notes, workout options. */
async function sessionSheets(ctx: FlowContext, tf: (key: string) => string): Promise<void> {
  const { page } = ctx;
  const sheets: [step: string, open: () => Promise<void>][] = [
    [
      'workout-session (set details)',
      () => clickTopmost(page.getByRole('button', { name: new RegExp(tf('details')) })),
    ],
    ['workout-session (why)', () => clickTopmost(page.getByTestId('guidance-why'))],
    [
      'workout-session (notes)',
      () =>
        clickTopmost(
          page.getByRole('button', {
            name: ctx.copy('workoutSession', ['trainingFlow', 'actions', 'notes']),
            exact: true,
          })
        ),
    ],
    [
      'workout-session (workout options)',
      // The top bar's More comes before every exercise card's.
      async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page
          .getByRole('button', {
            name: ctx.copy('workoutSession', ['trainingFlow', 'actions', 'more']),
            exact: true,
          })
          .first()
          .click();
      },
    ],
  ];

  for (const [step, open] of sheets) {
    await open();
    await ctx.settle(800);
    await ctx.overlay(step);
    await closeOverlay(ctx);
  }
}

/**
 * The three legacy screens, opened with the live session's own ids: the latest performed set for
 * the rest timer, the next planned one for rest over, and two exercises outside the superset for
 * the transition.
 */
async function legacyRestScreens(ctx: FlowContext, workoutLogId: string): Promise<void> {
  const { page } = ctx;
  const exercises = (await ctx.rows('workout_log_exercises'))
    .filter((row) => row.workout_log_id === workoutLogId)
    .sort((a, b) => Number(a.exercise_order) - Number(b.exercise_order));
  const exerciseIds = new Set(exercises.map((row) => row.id));
  const sets = (await ctx.rows('workout_log_sets'))
    .filter((row) => exerciseIds.has(row.log_exercise_id))
    .sort((a, b) => Number(a.set_order) - Number(b.set_order));
  const performed = sets.filter((row) => row.completion_status === 'performed');
  const planned = sets.filter((row) => row.completion_status === 'planned');
  const lastDone = performed[performed.length - 1];
  const nextUp = planned.find((row) => Number(row.set_order) > Number(lastDone?.set_order ?? 0));
  const solo = exercises.filter((row) => !row.group_id);
  const [from, to] = solo.length >= 2 ? solo : exercises.slice(-2);

  const screens: [step: string, path: string | null][] = [
    [
      'workout-rest-timer',
      lastDone
        ? `rest-timer?workoutLogId=${workoutLogId}&completedSetOrder=${lastDone.set_order}`
        : null,
    ],
    [
      'workout-rest-over',
      nextUp ? `rest-over?workoutLogId=${workoutLogId}&nextSetOrder=${nextUp.set_order}` : null,
    ],
    [
      'workout-exercise-transition',
      from && to
        ? `exercise-transition?workoutLogId=${workoutLogId}&completedExerciseId=${from.exercise_id}&nextExerciseId=${to.exercise_id}`
        : null,
    ],
  ];

  for (const [step, path] of screens) {
    if (!path) {
      ctx.skip(step, 'the live session had no set or exercise in the state this screen shows');
      continue;
    }

    await page.goto(`${APP_URL}/workout/${path}`, { timeout: 60000 });
    await ctx.settle(1500);
    const screen = path.split('?')[0];
    if (!new URL(page.url()).pathname.endsWith(screen)) {
      ctx.skip(step, `opened ${screen}, which went on to ${new URL(page.url()).pathname}`);
      continue;
    }

    await ctx.screen(step);
  }
}
