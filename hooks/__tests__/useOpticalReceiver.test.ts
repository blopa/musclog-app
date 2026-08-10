/**
 * @jest-environment jsdom
 */

/**
 * The receiver hook's published UI state.
 *
 * Drives a real `OpticalStream` carrying a real packed container into the hook's `onCodeScanned`,
 * so nothing about the data path is stubbed — container, fountain, base44 and the frame header are
 * all the shipping code. Only the camera, keep-awake and the database write are mocked.
 */

import { act, renderHook } from '@testing-library/react';
import { TextEncoder as NodeTextEncoder } from 'node:util';

import { useOpticalReceiver } from '@/hooks/useOpticalReceiver';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_SHARE,
  packOpticalContainer,
} from '@/utils/optical/container';
import { getOpticalPreset } from '@/utils/optical/presets';
import { OpticalStream } from '@/utils/optical/senderSession';
import { parseShareEnvelope, type MealShareEnvelope } from '@/utils/share/shareEnvelope';

// jsdom ships no TextEncoder. Hermes has it natively and the Jest `node` project inherits Node's,
// so this gap is specific to this test environment and not something the app ever hits.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}

jest.mock('@/hooks/useKeepScreenAwake', () => ({
  useKeepScreenAwake: () => {},
}));

jest.mock('@/database/importDb', () => ({
  restoreDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/app', () => ({
  isProduction: () => false,
  reloadApp: jest.fn().mockResolvedValue(undefined),
}));

const preset = getOpticalPreset('tiny');
const FRAME = { height: 480, width: 640 };

let container: Uint8Array;
let shareContainer: Uint8Array;

beforeAll(async () => {
  // Deliberately high-entropy: a repetitive dump gzips down to a single source block, and a
  // transfer that completes on frame one cannot exercise a progress bar at all.
  let seed = 0x2f6e2b1;
  const hex = (length: number) => {
    let out = '';
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) | 0;
      out += ((seed >>> 24) & 0xf).toString(16);
    }
    return out;
  };

  const dump = JSON.stringify({
    _exportVersion: 1,
    user_metrics: Array.from({ length: 400 }, (_, index) => ({ id: index, note: hex(64) })),
  });

  // Built with real timers — packing yields through setTimeout to keep the UI alive, which fake
  // timers would stall.
  ({ container } = await packOpticalContainer(dump));

  const share: MealShareEnvelope = {
    _musclogShare: 1,
    createdAtMs: 1,
    kind: 'meal',
    kindVersion: 1,
    records: {
      foods: [{ id: 'food-1', name: 'Rice' }],
      meal_foods: [{ amount: 100, food_id: 'food-1', id: 'mf-1', meal_id: 'meal-1' }],
      meals: [{ id: 'meal-1', name: 'Rice bowl' }],
    },
    rootId: 'meal-1',
    rootTable: 'meals',
    summary: {
      hasImage: false,
      ingredients: [{ amount: 100, calories: 130, name: 'Rice', unit: 'g' }],
      name: 'Rice bowl',
      nutritionBasis: 'per_recipe',
      totals: { calories: 130, carbs: 28, fat: 0.3, fiber: 0.4, protein: 2.7 },
    },
  };
  ({ container: shareContainer } = await packOpticalContainer(JSON.stringify(share), {
    exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
    payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
  }));
});

/**
 * Feed frames one act() at a time so React commits between iterations — reading `result.current`
 * from inside a single long act() would only ever see the pre-flush value.
 */
function runTransfer(
  result: { current: ReturnType<typeof useOpticalReceiver> },
  maxFrames = 500,
  transferContainer = container
) {
  const stream = new OpticalStream(transferContainer, preset, 4242);
  const seen: number[] = [];

  for (let seq = 0; seq < maxFrames; seq++) {
    act(() => {
      result.current.onCodeScanned([{ type: 'qr', value: stream.next() }], FRAME);
      // State is published on the 250 ms tick, never in the scanner callback — MLKit fires that
      // 15–30x/s and a setState there would starve the decode it feeds.
      jest.advanceTimersByTime(250);
    });
    seen.push(result.current.fraction);
    if (result.current.fraction >= 1) {
      break;
    }
  }

  return seen;
}

describe('useOpticalReceiver progress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports exactly 100% once the payload is out, not the frame estimate', () => {
    // The bug this pins: `estimateTransferProgress` asymptotes to 99% and never returns 1,
    // because mid-flight it cannot know how many more frames a given stream will need. The
    // peeling cascade then solves every remaining block in one step, so the last tick before
    // completion published whatever the frame curve had reached — about 95% — and the transfer
    // jumped from there straight to the verified screen. 100% was never displayed.
    const { result } = renderHook(() => useOpticalReceiver({ active: true }));
    const seen = runTransfer(result);

    expect(result.current.fraction).toBe(1);
    // No stale ETA left sitting next to a finished bar.
    expect(result.current.etaSeconds).toBeUndefined();

    // The bar must never exceed its track, and must have actually moved on the way up.
    expect(seen.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(seen.filter((value) => value > 0 && value < 1).length).toBeGreaterThan(0);
  });

  it('unpacks and verifies the container after the bar completes', async () => {
    const { result } = renderHook(() => useOpticalReceiver({ active: true }));
    runTransfer(result);

    // `unpack` is async and yields through setTimeout (so a large payload does not block the UI),
    // so the phase change lands a few ticks after the bar hits 100% — drive the clock and the
    // microtask queue together until it settles.
    await act(async () => {
      const settling = () =>
        result.current.phase === 'collecting' || result.current.phase === 'unpacking';
      for (let i = 0; i < 400 && settling(); i++) {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
      }
    });

    expect(result.current.phase).toBe('verified');
    expect(result.current.meta?.plainLen).toBeGreaterThan(0);
  });

  it('exposes the payload size, so progress can be shown in KB', () => {
    const { result } = renderHook(() => useOpticalReceiver({ active: true }));
    runTransfer(result);

    // Read off the frame header, so it is known long before the transfer finishes.
    expect(result.current.payloadBytes).toBe(container.length);
    expect(result.current.sourceBlocks).toBeGreaterThan(0);
  });

  it('publishes a stable average payload speed and clears it on reset', () => {
    jest.setSystemTime(new Date('2026-08-09T12:00:00Z'));
    const stream = new OpticalStream(container, preset, 4242);
    const { result } = renderHook(() => useOpticalReceiver({ active: true }));

    act(() => {
      result.current.onCodeScanned([{ type: 'qr', value: stream.next() }], FRAME);
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.elapsedSeconds).toBe(1);
    expect(result.current.averageBytesPerSecond).toBeCloseTo(
      result.current.fraction * container.length,
      5
    );
    expect(result.current.averageBytesPerSecond).toBeGreaterThan(0);

    act(() => result.current.reset());

    expect(result.current.averageBytesPerSecond).toBe(0);
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('stays at 0% and out of the way while nothing is being decoded', () => {
    // The camera hands us every code in view; a cereal box must not move the bar.
    const { result } = renderHook(() => useOpticalReceiver({ active: true }));

    act(() => {
      result.current.onCodeScanned([{ type: 'qr', value: 'https://example.com' }], FRAME);
      jest.advanceTimersByTime(250);
    });

    expect(result.current.fraction).toBe(0);
    expect(result.current.averageBytesPerSecond).toBe(0);
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.payloadBytes).toBe(0);
    expect(result.current.phase).toBe('collecting');
  });

  it('discards an unpack that a reset has already made obsolete', async () => {
    // The hook stays mounted when the receive modal closes, and unpacking (decompress + verify,
    // plus decrypt when a passphrase is involved) runs long enough for the user to close or
    // rescan mid-flight. Without a generation token the stale continuation publishes over the
    // newer state — a reopened screen would land straight in `verified` on the PREVIOUS payload.
    const { result } = renderHook(() => useOpticalReceiver({ active: true }));
    runTransfer(result, 50, shareContainer);

    // Reset while the unpack kicked off by the completing transfer is still in flight.
    act(() => result.current.reset());

    await act(async () => {
      for (let i = 0; i < 100; i++) {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
      }
    });

    expect(result.current.phase).toBe('collecting');
    expect(result.current.takeJson()).toBeNull();
    expect(result.current.meta).toBeUndefined();
  });

  it('lets a fresh transfer verify normally after a reset mid-unpack', async () => {
    // The flip side: cancelling the stale run must not wedge `unpackingRef` and lock out the
    // transfer that replaces it.
    const { result } = renderHook(() => useOpticalReceiver({ active: true }));
    runTransfer(result, 50, shareContainer);
    act(() => result.current.reset());
    await act(async () => {
      for (let i = 0; i < 50; i++) {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
      }
    });

    runTransfer(result, 50, shareContainer);
    await act(async () => {
      for (let i = 0; i < 100 && result.current.phase !== 'verified'; i++) {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
      }
    });

    expect(result.current.phase).toBe('verified');
    expect(parseShareEnvelope(result.current.takeJson() as string).summary.name).toBe('Rice bowl');
  });

  it('publishes and parses a tiny share payload through the real stream', async () => {
    const stream = new OpticalStream(shareContainer, preset, 4242);
    expect(stream.k).toBeLessThanOrEqual(2);

    const { result } = renderHook(() => useOpticalReceiver({ active: true }));
    runTransfer(result, 50, shareContainer);
    await act(async () => {
      for (let i = 0; i < 100 && result.current.phase !== 'verified'; i++) {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
      }
    });

    expect(result.current.phase).toBe('verified');
    expect(result.current.meta).toMatchObject({
      exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
      payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
    });
    expect(parseShareEnvelope(result.current.takeJson() as string).summary.name).toBe('Rice bowl');
  });
});
