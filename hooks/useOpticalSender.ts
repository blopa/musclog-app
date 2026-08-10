/**
 * Optical transfer — the sending half.
 *
 * Owns the whole sender lifecycle: dump the database, pack it into a container, calibrate this
 * device, then drive the display loop. Returns a plain `QrRaster` rather than an `SkImage` so the
 * hook itself stays free of Skia (and so it needs no `.web.ts` stub); turning that into pixels is
 * `components/optical/OpticalQrCanvas.tsx`'s job.
 *
 * The display loop itself lives in `hooks/useQrFrameLoop.ts`, shared with the bench screen — see
 * that file for the three hardware-learned behaviours it implements.
 *
 * WHY THE PACKED CONTAINER IS RETAINED for the whole session: calibration measures *this* phone,
 * but whether a code is readable depends on the *other* phone's camera, which nothing here can
 * observe. So the user has to be able to change density mid-stream, and re-deriving the payload
 * would mean another dump + gzip + hash — seconds of dead time every adjustment. Keeping the
 * container costs one extra copy of a few hundred KB and makes `setPreset` instant.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { dumpDatabase } from '@/database/exportDb';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useQrFrameLoop } from '@/hooks/useQrFrameLoop';
import { calibrateDevice, planFrameCache } from '@/utils/optical/bench';
import {
  OPTICAL_PAYLOAD_KIND_DATABASE,
  type OpticalContainerMeta,
  type OpticalPackStep,
  packOpticalContainer,
} from '@/utils/optical/container';
import {
  DEFAULT_OPTICAL_PRESET_ID,
  getOpticalPreset,
  type OpticalPreset,
  type OpticalPresetId,
} from '@/utils/optical/presets';
import { type QrRaster } from '@/utils/optical/qrRaster';
import {
  estimateStreamSeconds,
  newOpticalSessionId,
  OpticalStream,
} from '@/utils/optical/senderSession';

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

export interface OpticalSenderPayload {
  json: string;
  payloadKind: number;
  exportVersion?: number;
}

export type OpticalPayloadBuilder = () => Promise<OpticalSenderPayload>;

const DEFAULT_FPS = 8;

const buildDatabasePayload: OpticalPayloadBuilder = async () => ({
  json: await dumpDatabase(),
  payloadKind: OPTICAL_PAYLOAD_KIND_DATABASE,
});

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

export function useOpticalSender(options: {
  passphrase?: string;
  buildPayload?: OpticalPayloadBuilder;
}) {
  const { buildPayload, passphrase } = options;

  const [state, setState] = useState<OpticalSenderState>(idleState);

  const containerRef = useRef<null | Uint8Array>(null);
  const metaRef = useRef<null | OpticalContainerMeta>(null);
  /**
   * Bumped on every prepare and stop. `dumpDatabase()` can run for a long time, and the user can
   * back out or restart while it is in flight; a stale continuation must not install its stream
   * over a newer one.
   */
  const generationRef = useRef(0);
  const buildPayloadRef = useRef<OpticalPayloadBuilder>(buildPayload ?? buildDatabasePayload);
  const calibrationRef = useRef<null | Awaited<ReturnType<typeof calibrateDevice>>>(null);
  /**
   * The density currently installed, or null before the first `installStream`.
   *
   * A re-pack (the photo toggle) must NOT snap back to the calibrated default: the quality controls
   * sit on the same screen as the toggle, so "set compact, then include the photo" would silently
   * undo the density the user just chose. Calibration seeds the first stream only.
   */
  const presetIdRef = useRef<null | OpticalPresetId>(null);

  useEffect(() => {
    buildPayloadRef.current = buildPayload ?? buildDatabasePayload;
  }, [buildPayload]);

  const isStreaming = state.phase === 'streaming';
  useKeepScreenAwake('optical-send', isStreaming);

  const handleFrame = useCallback(
    (raster: QrRaster, stats: { cachedFrames: number; framesShown: number }) => {
      setState((previous) => ({
        ...previous,
        cachedFrames: stats.cachedFrames,
        framesShown: stats.framesShown,
        raster,
      }));
    },
    []
  );

  const loop = useQrFrameLoop({ onFrame: handleFrame, running: isStreaming });

  /** Build (or rebuild) the stream and frame cache for a density, from the retained container. */
  const installStream = useCallback(
    (presetId: OpticalPresetId, fps: number) => {
      const container = containerRef.current;
      const meta = metaRef.current;
      if (!container || !meta) {
        return;
      }

      const preset = getOpticalPreset(presetId);
      const stream = new OpticalStream(container, preset, newOpticalSessionId());
      const plan = planFrameCache(stream.k, preset.moduleCount);

      loop.install(stream, plan.frames);
      loop.setFps(fps);
      presetIdRef.current = presetId;

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
          estimatedSeconds: estimateStreamSeconds(stream.k, fps),
          loopSafe: plan.loopSafe,
          meta,
          plainBytes: meta.plainLen,
          preset,
          sourceBlocks: stream.k,
        },
      }));
    },
    [loop]
  );

  /** Halt the loop and invalidate any prepare still in flight. Shared by `stop` and `reset`. */
  const haltStream = useCallback(() => {
    generationRef.current++;
    loop.clear();
  }, [loop]);

  const stop = useCallback(() => {
    haltStream();
    setState((previous) =>
      previous.phase === 'streaming' ? { ...previous, phase: 'ready', raster: null } : previous
    );
  }, [haltStream]);

  const reset = useCallback(() => {
    haltStream();
    containerRef.current = null;
    metaRef.current = null;
    loop.setFps(DEFAULT_FPS);
    calibrationRef.current = null;
    presetIdRef.current = null;
    setState(idleState());
  }, [haltStream, loop]);

  const prepare = useCallback(
    async (override?: OpticalPayloadBuilder) => {
      const generation = ++generationRef.current;
      const alive = () => generationRef.current === generation;

      try {
        // Calibrate first: it decides the starting density, and the density decides how the
        // container is sliced into frames.
        let calibration = calibrationRef.current;
        if (!calibration) {
          setState((previous) => ({
            ...previous,
            phase: 'calibrating',
            prepareFraction: 0,
            prepareStep: 'calibrating',
          }));
          calibration = await calibrateDevice();
          if (!alive()) {
            return;
          }
          calibrationRef.current = calibration;
        }

        setState((previous) => ({ ...previous, phase: 'dumping', prepareStep: 'dumping' }));
        const payload = await (override ?? buildPayloadRef.current)();
        if (!alive()) {
          return;
        }

        setState((previous) => ({ ...previous, phase: 'packing', prepareStep: 'encoding' }));
        const { container, meta } = await packOpticalContainer(payload.json, {
          exportVersion: payload.exportVersion,
          onProgress: (step, fraction) =>
            alive() &&
            setState((previous) => ({ ...previous, prepareFraction: fraction, prepareStep: step })),
          passphrase,
          payloadKind: payload.payloadKind,
        });
        if (!alive()) {
          return;
        }

        containerRef.current = container;
        metaRef.current = meta;
        // Calibration seeds the FIRST stream only. Once a stream exists the user may have adjusted
        // density or speed, and a re-pack (the photo toggle) must preserve that rather than reset it.
        installStream(
          presetIdRef.current ?? calibration.recommendedPresetId,
          presetIdRef.current ? loop.readFps() : calibration.recommendedFps
        );
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
    },
    [installStream, loop, passphrase]
  );

  const start = useCallback(() => {
    // `presetIdRef` is set by `installStream` and cleared by `reset`, so it is exactly "a stream
    // is installed" — without the dependency churn that reading `state.summary` would cause.
    if (!presetIdRef.current) {
      return;
    }

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
      installStream(presetId, loop.readFps());
    },
    [installStream, loop]
  );

  /**
   * Change the display rate. Free: the loop reads this from a ref on its next tick.
   *
   * `state.fps` is a copy for rendering only — the loop owns the live value, which is why every
   * read here goes through `loop.readFps()` rather than a ref mirrored on this side.
   */
  const setFps = useCallback(
    (fps: number) => {
      loop.setFps(fps);
      setState((previous) => ({
        ...previous,
        fps,
        summary: previous.summary
          ? {
              ...previous.summary,
              estimatedSeconds: estimateStreamSeconds(previous.summary.sourceBlocks, fps),
            }
          : undefined,
      }));
    },
    [loop]
  );

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
