import type { Page } from '@playwright/test';

/**
 * How the audit decides a page is ready to be measured. Waiting, not measuring, is what a run
 * costs, so readiness is detected instead of slept for; every wait here is capped, so none is ever
 * slower than the fixed sleep it replaced.
 */

/** How long the DOM must sit still after a page is loaded or tapped before it is measured. */
export const SETTLE_QUIET_MS = 300;
/** How far apart two reads of the page text are. */
export const STABLE_TEXT_POLL_MS = 200;
/** How many reads to try before giving up (50 × 200 ms = 10 s), as the old 25 × 400 ms did. */
export const STABLE_TEXT_MAX_READS = 50;

/**
 * Clock-like text (`00:01:44`, `0:58`) changes every second on a live workout, so it is compared
 * with its digits masked: a ticking clock is not "the page is still loading".
 */
export function maskClocks(text: string): string {
  return text.replace(/\d{1,2}:\d{2}(?::\d{2})?/g, '#:##');
}

/** The slice of a Playwright page that `waitForStableText` uses, so a test can stand in for it. */
export type TextReader = {
  evaluate: (read: () => string) => Promise<string>;
  waitForTimeout: (ms: number) => Promise<void>;
};

/**
 * Waits until the page text stops changing (loading skeletons, counters, late data): two reads in
 * a row, `STABLE_TEXT_POLL_MS` apart, with clocks masked. Returns how many reads it took.
 */
export async function waitForStableText(page: TextReader | Page): Promise<number> {
  const reader = page as TextReader;
  let previous = '';
  let stableReads = 0;
  let reads = 0;
  while (reads < STABLE_TEXT_MAX_READS && stableReads < 2) {
    const text = maskClocks(await reader.evaluate(() => document.body.innerText).catch(() => ''));
    reads += 1;
    stableReads = text === previous ? stableReads + 1 : 0;
    previous = text;
    await reader.waitForTimeout(STABLE_TEXT_POLL_MS);
  }

  return reads;
}

/**
 * Waits until nothing in the document has changed for `quietMs`, at most `maxMs`. It replaces a
 * fixed sleep after a tap or a scroll: a page that is ready is measured as soon as it is quiet,
 * and one that never goes quiet (a running animation) still waits the whole `maxMs`.
 */
export async function waitForQuiet(page: Page, quietMs: number, maxMs: number): Promise<void> {
  await page
    .evaluate(
      ({ quiet, max }) =>
        new Promise<void>((resolve) => {
          let quietTimer: ReturnType<typeof setTimeout>;
          const finish = () => {
            observer.disconnect();
            clearTimeout(quietTimer);
            clearTimeout(capTimer);
            resolve();
          };

          const arm = () => {
            clearTimeout(quietTimer);
            quietTimer = setTimeout(finish, quiet);
          };

          const observer = new MutationObserver(arm);
          observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          const capTimer = setTimeout(finish, max);
          arm();
        }),
      { quiet: quietMs, max: maxMs }
    )
    .catch(() => undefined);
}
