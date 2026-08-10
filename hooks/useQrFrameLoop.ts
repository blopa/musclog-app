/**
 * Optical transfer — the QR display loop, shared by the send screen and the bench.
 *
 * This is the one place three behaviours learned the hard way on real hardware are implemented.
 * They were previously copied between `useOpticalSender` and the bench screen, which is the worst
 * possible split: the bench is the instrument used to VALIDATE these behaviours, so a copy there
 * can silently stop measuring what ships. See `docs/OPTICAL_TRANSFER.md`.
 *
 *  1. The loop SELF-SCHEDULES. `setInterval` at a period shorter than a frame's encode cost queues
 *     callbacks faster than they drain and the frame rate collapses progressively after a few
 *     seconds. Queuing the next tick only once the current one has finished makes an unreachable
 *     target degrade gracefully instead. The 16 ms floor guarantees the thread yields between
 *     frames, so the controls stay responsive even while every frame costs an encode.
 *  2. Frames are CACHED as module matrices and replayed. A frame's contents depend only on its
 *     seq, so the first pass pays the encode cost and every pass after it is nearly free. Matrices
 *     rather than rasters: ~1 byte per module against a raster's 4 bytes per pixel, and
 *     re-rasterizing costs ~1 ms — nothing next to the ~175 ms encode.
 *  3. The cache is ALL-OR-NOTHING. `cacheFrames === 0` means this payload cannot hold a safely
 *     loopable set, so frames are generated forever rather than looping a set the receiver can
 *     exhaust — which would deadlock it at ~98%.
 *
 * fps is held in a ref and read on each tick, so changing it never tears the loop down (which
 * would drop the in-flight frame).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { monotonicNowMs } from '@/utils/optical/clock';
import { QR_QUIET_ZONE_MODULES } from '@/utils/optical/presets';
import { encodeQrAlphanumericFixed, type QrMatrix } from '@/utils/optical/qrEncode';
import { type QrRaster, rasterizeQr } from '@/utils/optical/qrRaster';
import type { OpticalStream } from '@/utils/optical/senderSession';

export interface QrFrameLoopStats {
  framesShown: number;
  cachedFrames: number;
  /** Frames a safely loopable cache needs, or 0 when this payload cannot have one. */
  cacheTarget: number;
}

export interface QrFrameLoopOptions {
  /** Drives the loop. Flipping to false clears the pending timer. */
  running: boolean;
  onFrame: (raster: QrRaster, stats: QrFrameLoopStats) => void;
  /** Wall time a live encode cost, in ms. Only fires while the cache is still filling. */
  onEncode?: (durationMs: number) => void;
}

export interface QrFrameLoop {
  /** Install a stream and its cache plan. Resets the cursor, the cache and the frame count. */
  install: (stream: OpticalStream, cacheFrames: number) => void;
  clear: () => void;
  setFps: (fps: number) => void;
  /**
   * The rate the loop is currently pacing to. The loop owns this value — callers read it back
   * rather than mirroring it in a ref of their own, which is two sources of truth for one number.
   */
  readFps: () => number;
  /** Current counters, read straight off refs — safe to poll. */
  readStats: () => QrFrameLoopStats;
}

const DEFAULT_FPS = 8;
/** Never schedule closer than this, so the thread yields between frames. */
const MIN_FRAME_PERIOD_MS = 16;

export function useQrFrameLoop(options: QrFrameLoopOptions): QrFrameLoop {
  const { running } = options;

  const streamRef = useRef<null | OpticalStream>(null);
  const cacheRef = useRef<QrMatrix[]>([]);
  const cacheTargetRef = useRef(0);
  const cursorRef = useRef(0);
  const framesShownRef = useRef(0);
  const fpsRef = useRef(DEFAULT_FPS);
  const timerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  // Held in a ref so a caller that rebuilds its handlers each render does not tear the loop down
  // and drop the in-flight frame. Synced in an effect rather than during render — a ref write
  // during render is not safe under the React Compiler.
  const handlersRef = useRef(options);

  const readStats = useCallback(
    (): QrFrameLoopStats => ({
      cacheTarget: cacheTargetRef.current,
      cachedFrames: cacheRef.current.length,
      framesShown: framesShownRef.current,
    }),
    []
  );

  /**
   * Both preconditions — a stream is installed and the caller wants it running — are held in refs
   * and can be satisfied in either order. Whichever arrives second starts the loop, so a caller
   * that installs before arming and a caller that arms before installing both work. The earlier
   * copies of this loop only worked because their callers happened to install first, which is an
   * ordering requirement nothing stated or enforced.
   */
  const runningRef = useRef(running);

  /**
   * The scheduled tick, in a ref so it can name itself when queuing its successor without the
   * hook's callbacks becoming mutually recursive. Populated by the effect below, which is declared
   * before the arming effect so it has always run by the time anything can call `start`.
   */
  const tickRef = useRef<null | (() => void)>(null);

  const start = useCallback(() => {
    if (runningRef.current && streamRef.current && timerRef.current === null) {
      tickRef.current?.();
    }
  }, []);

  const install = useCallback(
    (stream: OpticalStream, cacheFrames: number) => {
      streamRef.current = stream;
      // A new stream invalidates every cached frame: at a different density they are a different
      // QR version, and a receiver that saw one mid-stream would stop decoding.
      cacheRef.current = [];
      cacheTargetRef.current = cacheFrames;
      cursorRef.current = 0;
      framesShownRef.current = 0;
      start();
    },
    [start]
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current = null;
    cacheRef.current = [];
    cacheTargetRef.current = 0;
    cursorRef.current = 0;
    framesShownRef.current = 0;
  }, []);

  const setFps = useCallback((fps: number) => {
    fpsRef.current = fps;
  }, []);

  const readFps = useCallback(() => fpsRef.current, []);

  const tick = useCallback((): void => {
    const stream = streamRef.current;
    if (!stream || !runningRef.current) {
      timerRef.current = null;
      return;
    }

    const startedAt = monotonicNowMs();
    const target = cacheTargetRef.current;
    let matrix: QrMatrix;

    if (target > 0 && cacheRef.current.length >= target) {
      matrix = cacheRef.current[cursorRef.current % cacheRef.current.length];
      cursorRef.current++;
    } else {
      const encodeStartedAt = monotonicNowMs();
      matrix = encodeQrAlphanumericFixed(stream.next(), stream.preset.qrVersion, 'L');
      handlersRef.current.onEncode?.(monotonicNowMs() - encodeStartedAt);
      if (target > 0) {
        cacheRef.current.push(matrix);
      }
    }

    framesShownRef.current++;
    handlersRef.current.onFrame(
      rasterizeQr(matrix.moduleCount, matrix.modules, QR_QUIET_ZONE_MODULES),
      readStats()
    );

    const period = 1000 / Math.max(1, fpsRef.current);
    timerRef.current = setTimeout(
      () => tickRef.current?.(),
      Math.max(MIN_FRAME_PERIOD_MS, period - (monotonicNowMs() - startedAt))
    );
  }, [readStats]);

  // Ref syncing lives here, and before the arming effect below, so the loop never reads a stale
  // handler, a stale `running`, or a missing `tick` on the frame it is about to schedule. Writing
  // refs during render is not safe under the React Compiler.
  useEffect(() => {
    handlersRef.current = options;
    runningRef.current = running;
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!running) {
      return;
    }

    start();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running, start]);

  // Memoized, not a fresh literal per render. Every member is already identity-stable, so a new
  // wrapper object would be the ONLY unstable thing this hook produces — and it propagates: a
  // consumer that puts the loop in a dep array (the bench does, to push fps) re-runs that effect
  // on every render, and `useOpticalSender`'s whole public API becomes unstable by taking `[loop]`.
  // A hook whose reason for existing is "never tear the loop down" must not hand out churn.
  return useMemo(
    () => ({ clear, install, readFps, readStats, setFps }),
    [clear, install, readFps, readStats, setFps]
  );
}
