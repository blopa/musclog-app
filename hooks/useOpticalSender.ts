/**
 * Optical transfer — the sending half.
 *
 * Owns the whole sender lifecycle: dump the database, pack it into a container, calibrate this
 * device, then drive the display loop. Returns a plain `QrRaster` rather than an `SkImage` so the
 * hook itself stays free of Skia (and so it needs no `.web.ts` stub); turning that into pixels is
 * `components/optical/OpticalQrCanvas.tsx`'s job.
 *
 * WHY THE PACKED CONTAINER IS RETAINED for the whole session: calibration measures *this* phone,
 * but whether a code is readable depends on the *other* phone's camera, which nothing here can
 * observe. So the user has to be able to change density mid-stream, and re-deriving the payload
 * would mean another dump + gzip + hash — seconds of dead time every adjustment. Keeping the
 * container costs one extra copy of a few hundred KB and makes `setPreset` instant.
 *
 * Three things here were learned the hard way on real hardware — see `docs/OPTICAL_TRANSFER.md`:
 *
 *  1. The display loop SELF-SCHEDULES. `setInterval` at a period shorter than a frame's encode
 *     cost queues callbacks faster than they drain, and the frame rate collapses progressively
 *     after a few seconds. Queuing the next tick only once the current one finishes makes an
 *     unreachable target degrade gracefully instead.
 *  2. Frames are CACHED as module matrices and replayed. A frame's contents depend only on its
 *     seq, so the first pass pays the encode cost and every pass after it is nearly free.
 *  3. The fps target is MEASURED, not guessed. Encode cost varies by ~4x across devices at the
 *     same density, so a fixed default is wrong nearly everywhere.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { dumpDatabase } from '@/database/exportDb';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { calibrateDevice, planFrameCache } from '@/utils/optical/bench';
import {
  type OpticalContainerMeta,
  type OpticalPackStep,
  packOpticalContainer,
} from '@/utils/optical/container';
import {
  DEFAULT_OPTICAL_PRESET_ID,
  getOpticalPreset,
  type OpticalPreset,
  type OpticalPresetId,
  QR_QUIET_ZONE_MODULES,
} from '@/utils/optical/presets';
import { encodeQrAlphanumericFixed, type QrMatrix } from '@/utils/optical/qrEncode';
import { type QrRaster, rasterizeQr } from '@/utils/optical/qrRaster';
import { newOpticalSessionId, OpticalStream } from '@/utils/optical/senderSession';

export type OpticalSenderPhase =
  'idle' | 'calibrating' | 'dumping' | 'packing' | 'ready' | 'streaming' | 'error';

export interface OpticalSenderSummary {
  plainBytes: number;
  containerBytes: number;
  encrypted: boolean;
  sourceBlocks: number;
  preset: OpticalPreset;
  /** Whether the cache can cover a safely loopable set; false means we encode forever. */
  loopSafe: boolean;
  estimatedSeconds: number;
  meta: OpticalContainerMeta;
}

export interface OpticalSenderState {
  phase: OpticalSenderPhase;
  prepareStep?: 'calibrating' | 'dumping' | OpticalPackStep;
  prepareFraction: number;
  summary?: OpticalSenderSummary;
  errorMessage?: string;
  raster: null | QrRaster;
  framesShown: number;
  cachedFrames: number;
  cacheTarget: number;
  presetId: OpticalPresetId;
  fps: number;
}

const DEFAULT_FPS = 8;

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const idleState = (): OpticalSenderState => ({
  cacheTarget: 0,
  cachedFrames: 0,
  fps: DEFAULT_FPS,
  framesShown: 0,
  phase: 'idle',
  prepareFraction: 0,
  presetId: DEFAULT_OPTICAL_PRESET_ID,
  raster: null,
});

export function useOpticalSender(options: { passphrase?: string }) {
  const { passphrase } = options;

  const [state, setState] = useState<OpticalSenderState>(idleState);

  const containerRef = useRef<null | Uint8Array>(null);
  const metaRef = useRef<null | OpticalContainerMeta>(null);
  const streamRef = useRef<null | OpticalStream>(null);
  const cacheRef = useRef<QrMatrix[]>([]);
  const cacheTargetRef = useRef(0);
  const cursorRef = useRef(0);
  const framesShownRef = useRef(0);
  const fpsRef = useRef(DEFAULT_FPS);
  const runningRef = useRef(false);
  const timerRef = useRef<null | ReturnType<typeof setTimeout>>(null);
  /**
   * Bumped on every prepare and stop. `dumpDatabase()` can run for a long time, and the user can
   * back out or restart while it is in flight; a stale continuation must not install its stream
   * over a newer one.
   */
  const generationRef = useRef(0);

  const isStreaming = state.phase === 'streaming';
  useKeepScreenAwake('optical-send', isStreaming);

  /** Build (or rebuild) the stream and frame cache for a density, from the retained container. */
  const installStream = useCallback((presetId: OpticalPresetId, fps: number) => {
    const container = containerRef.current;
    const meta = metaRef.current;
    if (!container || !meta) {
      return;
    }

    const preset = getOpticalPreset(presetId);
    const stream = new OpticalStream(container, preset, newOpticalSessionId());
    const plan = planFrameCache(stream.k, preset.moduleCount);

    streamRef.current = stream;
    // A new density invalidates every cached frame: they are a different QR version, and a
    // receiver that saw one mid-stream would stop decoding.
    cacheRef.current = [];
    cacheTargetRef.current = plan.frames;
    cursorRef.current = 0;
    framesShownRef.current = 0;
    fpsRef.current = fps;

    setState((previous) => ({
      ...previous,
      cachedFrames: 0,
      cacheTarget: plan.frames,
      fps,
      framesShown: 0,
      presetId,
      raster: null,
      summary: {
        containerBytes: container.length,
        encrypted: meta.encrypted,
        estimatedSeconds: Math.ceil((stream.k * 1.25) / Math.max(1, fps)),
        loopSafe: plan.loopSafe,
        meta,
        plainBytes: meta.plainLen,
        preset,
        sourceBlocks: stream.k,
      },
    }));
  }, []);

  const stop = useCallback(() => {
    generationRef.current++;
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState((previous) =>
      previous.phase === 'streaming' ? { ...previous, phase: 'ready', raster: null } : previous
    );
  }, []);

  const reset = useCallback(() => {
    generationRef.current++;
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    containerRef.current = null;
    metaRef.current = null;
    streamRef.current = null;
    cacheRef.current = [];
    cacheTargetRef.current = 0;
    cursorRef.current = 0;
    framesShownRef.current = 0;
    fpsRef.current = DEFAULT_FPS;
    setState(idleState());
  }, []);

  const prepare = useCallback(async () => {
    const generation = ++generationRef.current;
    const alive = () => generationRef.current === generation;

    try {
      // Calibrate first: it decides the starting density, and the density decides how the
      // container is sliced into frames.
      setState((previous) => ({
        ...previous,
        phase: 'calibrating',
        prepareFraction: 0,
        prepareStep: 'calibrating',
      }));
      const calibration = await calibrateDevice();
      if (!alive()) {
        return;
      }

      setState((previous) => ({ ...previous, phase: 'dumping', prepareStep: 'dumping' }));
      const json = await dumpDatabase();
      if (!alive()) {
        return;
      }

      setState((previous) => ({ ...previous, phase: 'packing', prepareStep: 'encoding' }));
      const { container, meta } = await packOpticalContainer(json, {
        onProgress: (step, fraction) =>
          alive() &&
          setState((previous) => ({ ...previous, prepareFraction: fraction, prepareStep: step })),
        passphrase,
      });
      if (!alive()) {
        return;
      }

      containerRef.current = container;
      metaRef.current = meta;
      installStream(calibration.recommendedPresetId, calibration.recommendedFps);
      setState((previous) => ({ ...previous, phase: 'ready', prepareFraction: 1 }));
    } catch (error) {
      if (!alive()) {
        return;
      }
      setState((previous) => ({
        ...previous,
        errorMessage: error instanceof Error ? error.message : String(error),
        phase: 'error',
      }));
    }
  }, [installStream, passphrase]);

  const start = useCallback(() => {
    if (!streamRef.current) {
      return;
    }
    runningRef.current = true;
    setState((previous) => ({ ...previous, phase: 'streaming' }));
  }, []);

  /**
   * Change density.
   *
   * This restarts the stream: every frame becomes a different QR version, so the receiver sees a
   * new `streamIdentity`, rebuilds its decoder, and loses whatever it had collected. That is why
   * the UI says so, and why fps — which costs nothing — is the knob to try first.
   */
  const setPreset = useCallback(
    (presetId: OpticalPresetId) => {
      installStream(presetId, fpsRef.current);
    },
    [installStream]
  );

  /** Change the display rate. Free: the loop reads this from a ref on its next tick. */
  const setFps = useCallback((fps: number) => {
    fpsRef.current = fps;
    setState((previous) => ({
      ...previous,
      fps,
      summary: previous.summary
        ? {
            ...previous.summary,
            estimatedSeconds: Math.ceil((previous.summary.sourceBlocks * 1.25) / Math.max(1, fps)),
          }
        : undefined,
    }));
  }, []);

  const nextFrame = useCallback((): null | QrRaster => {
    const stream = streamRef.current;
    if (!stream) {
      return null;
    }

    let matrix: QrMatrix;
    const target = cacheTargetRef.current;

    if (target > 0 && cacheRef.current.length >= target) {
      matrix = cacheRef.current[cursorRef.current % cacheRef.current.length];
      cursorRef.current++;
    } else {
      matrix = encodeQrAlphanumericFixed(stream.next(), stream.preset.qrVersion, 'L');
      // target === 0 means this payload is too large to cache a safely loopable set, so we keep
      // generating rather than risk looping a set the receiver can exhaust.
      if (target > 0) {
        cacheRef.current.push(matrix);
      }
    }

    return rasterizeQr(matrix.moduleCount, matrix.modules, QR_QUIET_ZONE_MODULES);
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const tick = () => {
      if (!runningRef.current) {
        return;
      }
      const started = nowMs();
      const raster = nextFrame();
      if (raster) {
        framesShownRef.current++;
        setState((previous) => ({
          ...previous,
          cachedFrames: cacheRef.current.length,
          framesShown: framesShownRef.current,
          raster,
        }));
      }
      // The 16 ms floor guarantees the thread yields between frames, so the controls stay
      // responsive even while every frame costs an encode.
      const period = 1000 / Math.max(1, fpsRef.current);
      timerRef.current = setTimeout(tick, Math.max(16, period - (nowMs() - started)));
    };

    tick();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isStreaming, nextFrame]);

  // Backgrounding the app stops the stream: the screen is the transmitter, so there is nothing to
  // transmit, and continuing would burn battery encoding frames nobody can see.
  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        stop();
      }
    });
    return () => subscription.remove();
  }, [isStreaming, stop]);

  return { ...state, prepare, reset, setFps, setPreset, start, stop };
}
