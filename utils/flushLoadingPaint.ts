import { InteractionManager } from 'react-native';

/** Yields so React can commit a setState (e.g. loading) before more sync work. */
export async function yieldToUi(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 1));
}

/**
 * After setting loading UI, call this before heavy synchronous/async DB work so the
 * spinner can paint. Parent-only loading on large screens often never paints in time.
 */
export async function flushLoadingPaint(): Promise<void> {
  await yieldToUi();
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
}
