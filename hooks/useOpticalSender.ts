/**
 * Optical transfer — the sending half.
 *
 * Owns the whole sender lifecycle: dump the database, pack it into a container, calibrate this
 * device, then drive the display loop. Returns a plain `QrRaster` rather than an `SkImage` so the
 * hook itself stays free of Skia (and so it needs no `.web.ts` stub); turning that into pixels is
 * `components/optical/OpticalQrCanvas.tsx`'s job.
 *
 * Three things here were learned the hard way on a 2018 phone and must not be undone — see
 * `docs/OPTICAL_TRANSFER.md`:
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
import { calibrateDevice, planFrameCache, suggestedFpsForFrameCost } from '@/utils/optical/bench';
import {
  type OpticalContainerMeta,
  type OpticalPackStep,
  packOpticalContainer,
} from '@/utils/optical/container';
import {
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
  compressionRatio: number;
  encrypted: boolean;
  sourceBlocks: number;
  preset: OpticalPreset;
  fps: number;
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
}

/** Frames of headroom before the first display, so the stream does not stutter on frame one. */
const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function useOpticalSender(options: { passphrase?: string; presetId?: OpticalPresetId }) {
  const { passphrase, presetId } = options;

  const [state, setState] = useState<OpticalSenderState>({
    cacheTarget: 0,
    cachedFrames: 0,
    framesShown: 0,
    phase: 'idle',
    prepareFraction: 0,
    raster: null,
  });

  const streamRef = useRef<null | OpticalStream>(null);
  const cacheRef = useRef<QrMatrix[]>([]);
  const cacheTargetRef = useRef(0);
  const cursorRef = useRef(0);
  const framesShownRef = useRef(0);
  const fpsRef = useRef(8);
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
    streamRef.current = null;
    cacheRef.current = [];
    cacheTargetRef.current = 0;
    cursorRef.current = 0;
    framesShownRef.current = 0;
    setState({
      cacheTarget: 0,
      cachedFrames: 0,
      framesShown: 0,
      phase: 'idle',
      prepareFraction: 0,
      raster: null,
    });
  }, []);

  const prepare = useCallback(async () => {
    const generation = ++generationRef.current;
    const alive = () => generationRef.current === generation;

    try {
      // Calibrate first: it decides the density, and the density decides how the container is
      // sliced into frames.
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

      const preset = getOpticalPreset(presetId ?? calibration.recommendedPresetId);
      const chosen = calibration.presets.find((row) => row.presetId === preset.id);
      const fps = chosen
        ? suggestedFpsForFrameCost(1000 / chosen.buildFps)
        : calibration.recommendedFps;
      fpsRef.current = fps;

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

      const stream = new OpticalStream(container, preset, newOpticalSessionId());
      const plan = planFrameCache(stream.k, preset.moduleCount);

      streamRef.current = stream;
      cacheRef.current = [];
      cacheTargetRef.current = plan.frames;
      cursorRef.current = 0;
      framesShownRef.current = 0;

      setState({
        cacheTarget: plan.frames,
        cachedFrames: 0,
        framesShown: 0,
        phase: 'ready',
        prepareFraction: 1,
        raster: null,
        summary: {
          compressionRatio: meta.plainLen / Math.max(1, meta.bodyLen),
          containerBytes: container.length,
          encrypted: meta.encrypted,
          estimatedSeconds: Math.ceil((stream.k * 1.25) / Math.max(1, fps)),
          fps,
          loopSafe: plan.loopSafe,
          meta,
          plainBytes: meta.plainLen,
          preset,
          sourceBlocks: stream.k,
        },
      });
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
  }, [passphrase, presetId]);

  const start = useCallback(() => {
    if (!streamRef.current) {
      return;
    }
    runningRef.current = true;
    setState((previous) => ({ ...previous, phase: 'streaming' }));
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
      // The 16 ms floor guarantees the thread yields between frames, so the Stop control stays
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

  return { ...state, prepare, reset, start, stop };
}
