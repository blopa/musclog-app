import {
  evictHiddenTabs,
  KEEP_ALIVE_TABS,
  keepAliveLimit,
  LOW_MEMORY_DEVICE_BYTES,
  LOW_MEMORY_KEEP_ALIVE_TABS,
  shouldRenderTab,
  touchKeptTab,
} from '@/utils/tabKeepAlive';

describe('keepAliveLimit', () => {
  it('keeps Home plus the three bar slots on an ordinary phone', () => {
    expect(keepAliveLimit(3.7e9)).toBe(KEEP_ALIVE_TABS);
    expect(keepAliveLimit(12e9)).toBe(KEEP_ALIVE_TABS);
    expect(KEEP_ALIVE_TABS).toBe(4);
  });

  it('keeps fewer on a phone with about 3 GB or less', () => {
    expect(keepAliveLimit(2.8e9)).toBe(LOW_MEMORY_KEEP_ALIVE_TABS);
    expect(keepAliveLimit(LOW_MEMORY_DEVICE_BYTES - 1)).toBe(LOW_MEMORY_KEEP_ALIVE_TABS);
  });

  it('keeps the full number when the RAM is unknown (web)', () => {
    expect(keepAliveLimit(null)).toBe(KEEP_ALIVE_TABS);
    expect(keepAliveLimit(undefined)).toBe(KEEP_ALIVE_TABS);
    expect(keepAliveLimit(0)).toBe(KEEP_ALIVE_TABS);
  });
});

describe('touchKeptTab', () => {
  it('puts the focused tab first and drops the least recently used past the limit', () => {
    let order: readonly string[] = [];
    for (const key of ['home', 'food', 'workouts', 'profile', 'settings']) {
      order = touchKeptTab(order, key, 4);
    }

    expect(order).toEqual(['settings', 'profile', 'workouts', 'food']);
    expect(touchKeptTab(order, 'food', 4)).toEqual(['food', 'settings', 'profile', 'workouts']);
  });

  it('stays bounded however many switches happen', () => {
    let order: readonly string[] = [];
    for (let round = 0; round < 200; round++) {
      order = touchKeptTab(order, ['home', 'food', 'workouts', 'notes', 'cycle'][round % 5], 4);
      expect(order.length).toBeLessThanOrEqual(4);
      expect(new Set(order).size).toBe(order.length);
    }
  });

  it('returns the same array when the focused tab is already first', () => {
    const order = ['food', 'home'];
    expect(touchKeptTab(order, 'food', 4)).toBe(order);
  });

  it('always keeps at least the focused tab', () => {
    expect(touchKeptTab(['home'], 'food', 0)).toEqual(['food']);
  });
});

describe('evictHiddenTabs / shouldRenderTab', () => {
  it('keeps only the focused tab when memory is short', () => {
    expect(evictHiddenTabs(['food', 'home', 'workouts'])).toEqual(['food']);
    const single = ['food'];
    expect(evictHiddenTabs(single)).toBe(single);
  });

  it('renders the focused tab and the kept ones, unmounts the rest', () => {
    const order = ['food', 'home'];
    expect(shouldRenderTab(order, 'home', false)).toBe(true);
    expect(shouldRenderTab(order, 'workouts', false)).toBe(false);
    expect(shouldRenderTab([], 'workouts', true)).toBe(true);
  });
});
