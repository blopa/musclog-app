/** Yields so React can commit a setState (e.g. loading) before more sync work. */
export async function yieldToUi(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 1));
}

function waitForIdlePaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    const ric = globalThis.requestIdleCallback;
    if (typeof ric === 'function') {
      // Prefer idle time; timeout ensures we still proceed if the main thread stays busy.
      ric(() => resolve(), { timeout: 150 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * After setting loading UI, call this before heavy synchronous/async DB work so the
 * spinner can paint. Parent-only loading on large screens often never paints in time.
 */
export async function flushLoadingPaint(): Promise<void> {
  await yieldToUi();
  await waitForIdlePaint();
}
