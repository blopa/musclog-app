/**
 * Optical transfer — the receiving half.
 *
 * THE RULE THAT SHAPES THIS FILE: `onCodeScanned` is `useCallback(…, [])` and writes only to refs.
 * No `setState` on the scanner path. MLKit fires it 15–30 times a second, and driving a React
 * render at that rate starves the very thread doing the decode bookkeeping. A 250 ms interval
 * publishes derived state instead.
 *
 * That interval also owns the transition out of `collecting` — never the scanner callback — so
 * camera teardown and container unpacking never run inside a native callback.
 *
 * Progress tracks FRAMES COLLECTED, not blocks solved: LT peeling back-loads, so a bar driven by
 * solved blocks sits near zero for most of the transfer and then teleports.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type Code, type CodeScannerFrame } from 'react-native-vision-camera';

import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import {
  OpticalContainerError,
  type OpticalContainerErrorCode,
  type OpticalContainerMeta,
  unpackOpticalContainer,
} from '@/utils/optical/container';
import { NoSignalHintTimer } from '@/utils/optical/noSignal';
import { estimateTransferProgress } from '@/utils/optical/progress';
import { OpticalReceiver } from '@/utils/optical/receiverSession';

export type OpticalReceiverPhase = 'collecting' | 'unpacking' | 'passphrase' | 'verified' | 'error';

export interface OpticalReceiverState {
  phase: OpticalReceiverPhase;
  fraction: number;
  etaSeconds?: number;
  framesNew: number;
  framesDup: number;
  sourceBlocks: number;
  solvedBlocks: number;
  payloadBytes: number;
  elapsedSeconds: number;
  /** The code scanner's analysis resolution. Drives the density advice in the no-signal hint. */
  analysisFrame?: { width: number; height: number };
  showNoSignalHint: boolean;
  meta?: OpticalContainerMeta;
  errorCode?: OpticalContainerErrorCode | 'checksum-failed';
  errorMessage?: string;
}

const initialState: OpticalReceiverState = {
  elapsedSeconds: 0,
  fraction: 0,
  framesDup: 0,
  framesNew: 0,
  payloadBytes: 0,
  phase: 'collecting',
  showNoSignalHint: false,
  solvedBlocks: 0,
  sourceBlocks: 0,
};

export function useOpticalReceiver(options: { active: boolean }) {
  const { active } = options;
  const [state, setState] = useState<OpticalReceiverState>(initialState);

  const receiverRef = useRef(new OpticalReceiver());
  const noSignalRef = useRef(new NoSignalHintTimer());
  const analysisRef = useRef<undefined | { width: number; height: number }>(undefined);
  const startedAtRef = useRef(0);
  const outcomeRef = useRef<null | 'checksum-failed' | 'complete'>(null);
  /** The reassembled container, held so a wrong passphrase costs a re-prompt and not a rescan. */
  const containerRef = useRef<null | Uint8Array>(null);
  const jsonRef = useRef<null | string>(null);
  const unpackingRef = useRef(false);

  useKeepScreenAwake('optical-receive', active);

  const onCodeScanned = useCallback((codes: Code[], frame: CodeScannerFrame) => {
    analysisRef.current = { height: frame.height, width: frame.width };
    if (outcomeRef.current) {
      return;
    }

    for (const code of codes) {
      if (!code.value) {
        continue;
      }
      if (startedAtRef.current === 0) {
        startedAtRef.current = Date.now();
      }

      const result = receiverRef.current.accept(code.value, Date.now());
      if (result !== 'ignored') {
        noSignalRef.current.frameDecoded();
      }
      if (result === 'complete') {
        containerRef.current = receiverRef.current.takeContainer();
        outcomeRef.current = 'complete';
        return;
      }
      if (result === 'checksum-failed') {
        outcomeRef.current = 'checksum-failed';
        return;
      }
    }
  }, []);

  const unpack = useCallback(async (passphrase?: string) => {
    const container = containerRef.current;
    if (!container || unpackingRef.current) {
      return;
    }

    unpackingRef.current = true;
    setState((previous) => ({ ...previous, phase: 'unpacking' }));
    try {
      const { json, meta } = await unpackOpticalContainer(container, { passphrase });
      jsonRef.current = json;
      setState((previous) => ({ ...previous, meta, phase: 'verified' }));
    } catch (error) {
      const code =
        error instanceof OpticalContainerError
          ? error.code
          : ('checksum' as OpticalContainerErrorCode);
      setState((previous) => ({
        ...previous,
        errorCode: code,
        errorMessage: error instanceof Error ? error.message : String(error),
        // A passphrase problem is recoverable in place — the container is still in memory, so the
        // user retypes rather than re-scanning the whole stream.
        phase: code === 'needs-passphrase' || code === 'bad-passphrase' ? 'passphrase' : 'error',
      }));
    } finally {
      unpackingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    receiverRef.current.reset();
    noSignalRef.current = new NoSignalHintTimer();
    noSignalRef.current.cameraStarted(Date.now());
    startedAtRef.current = 0;
    outcomeRef.current = null;
    containerRef.current = null;
    jsonRef.current = null;
    unpackingRef.current = false;
    setState(initialState);
  }, []);

  const submitPassphrase = useCallback(
    (passphrase: string) => {
      void unpack(passphrase);
    },
    [unpack]
  );

  const dismissNoSignalHint = useCallback(() => {
    noSignalRef.current.dismiss(Date.now());
    setState((previous) => ({ ...previous, showNoSignalHint: false }));
  }, []);

  /** The verified dump, ready for `restoreDatabase`. Non-null only in the `verified` phase. */
  const takeJson = useCallback(() => jsonRef.current, []);

  /**
   * The camera session is genuinely streaming — wired to vision-camera's `onStarted`, not to the
   * screen becoming visible. The distinction matters: while the OS permission prompt is up, or
   * while the session is still binding, no frames can arrive, and arming the countdown then would
   * pop "nothing is coming through — move the phones closer" over a dialog asking for camera
   * access.
   */
  const cameraStarted = useCallback(() => {
    noSignalRef.current.cameraStarted(Date.now());
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    const id = setInterval(() => {
      const stats = receiverRef.current.stats;
      const now = Date.now();
      const elapsed = startedAtRef.current ? (now - startedAtRef.current) / 1000 : 0;
      const progress = estimateTransferProgress(
        stats.k,
        stats.framesNew,
        elapsed,
        stats.solvedBlocks
      );

      noSignalRef.current.tick(now);

      // `estimateTransferProgress` deliberately asymptotes to 99% and never reaches 1: mid-flight
      // it cannot know how many more frames this particular stream will need, and a bar that sits
      // at 100% while frames keep arriving is worse than one that never quite gets there.
      //
      // But completion is a fact, not an estimate. Without this the bar jumped from wherever the
      // frame curve happened to be — around 95%, because the peeling cascade solves every
      // remaining block in a single step, so the blocks-based term never gets a tick of its own —
      // straight to the verified screen, and 100% was never displayed.
      const isComplete = outcomeRef.current === 'complete';

      setState((previous) => {
        // The completion transition is taken here rather than in the scanner callback, so the
        // camera is never torn down from inside a native callback.
        if (isComplete && previous.phase === 'collecting') {
          void unpack();
        }

        const failed = outcomeRef.current === 'checksum-failed' && previous.phase === 'collecting';
        return {
          ...previous,
          analysisFrame: analysisRef.current,
          elapsedSeconds: elapsed,
          etaSeconds: isComplete ? undefined : progress.etaSeconds,
          fraction: isComplete ? 1 : progress.fraction,
          framesDup: stats.framesDup,
          framesNew: stats.framesNew,
          payloadBytes: stats.totalLen,
          ...(failed
            ? { errorCode: 'checksum-failed' as const, phase: 'error' as const }
            : undefined),
          showNoSignalHint: noSignalRef.current.isVisible,
          solvedBlocks: stats.solvedBlocks,
          sourceBlocks: stats.k,
        };
      });
    }, 250);

    return () => clearInterval(id);
  }, [active, unpack]);

  // Leaving the app mid-scan is a pause, not a failure — the fountain has no notion of a
  // connection, so pointing the camera back at the sender simply resumes.
  useEffect(() => {
    if (!active) {
      return;
    }
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        noSignalRef.current.cameraStarted(Date.now());
      }
    });
    return () => subscription.remove();
  }, [active]);

  return {
    ...state,
    cameraStarted,
    dismissNoSignalHint,
    onCodeScanned,
    reset,
    submitPassphrase,
    takeJson,
  };
}
