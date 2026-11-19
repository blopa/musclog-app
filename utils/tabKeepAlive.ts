/**
 * Which tab screens stay mounted while hidden. Pure, so the rule is tested without React.
 *
 * Keeping a visited tab mounted makes coming back to it instant (no rebuild, no reload, scroll
 * position kept), which is how Musclog 1.x's drawer felt. It costs that screen's memory and its
 * live database subscriptions keep running while it is hidden, so the number kept is bounded:
 * the most recently used tabs, the focused one included. Phones with little RAM keep fewer.
 *
 * `order` is most recent first. A tab outside it is unmounted while hidden and rebuilt the next
 * time it is opened.
 */

/** Home plus the three customisable bar slots: everything the bar can reach stays warm. */
export const KEEP_ALIVE_TABS = 4;

/** The focused tab and one other (usually Home), on phones with little memory. */
export const LOW_MEMORY_KEEP_ALIVE_TABS = 2;

/**
 * Below this, a phone counts as low on memory. `Device.totalMemory` reports what the kernel sees,
 * a little under the advertised size (a "4 GB" phone reports about 3.7e9 bytes, a "3 GB" one
 * about 2.8e9), so the line sits between those two.
 */
export const LOW_MEMORY_DEVICE_BYTES = 3.3e9;

/** How many tabs to keep, from the phone's RAM. `null` (web, unknown) keeps the full number. */
export function keepAliveLimit(totalMemoryBytes: number | null | undefined): number {
  if (typeof totalMemoryBytes === 'number' && totalMemoryBytes > 0) {
    return totalMemoryBytes < LOW_MEMORY_DEVICE_BYTES
      ? LOW_MEMORY_KEEP_ALIVE_TABS
      : KEEP_ALIVE_TABS;
  }

  return KEEP_ALIVE_TABS;
}

/**
 * `key` was just focused: it moves to the front, and the least recently used fall off past
 * `limit`. Returns the SAME array when nothing changed, so subscribers can skip a render.
 */
export function touchKeptTab(
  order: readonly string[],
  key: string,
  limit: number
): readonly string[] {
  const max = Math.max(1, Math.floor(limit));
  if (order[0] === key && order.length <= max) {
    return order;
  }

  return [key, ...order.filter((kept) => kept !== key)].slice(0, max);
}

/** Memory is short: keep only the focused tab (the most recent one), unmount every hidden one. */
export function evictHiddenTabs(order: readonly string[]): readonly string[] {
  return order.length <= 1 ? order : order.slice(0, 1);
}

/** A hidden tab is rendered only while it is in `order`; the focused one always is. */
export function shouldRenderTab(order: readonly string[], key: string, focused: boolean): boolean {
  return focused || order.includes(key);
}
