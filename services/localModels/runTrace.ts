/**
 * What the downloaded model was doing, for Sentry. Two things a plain exception cannot tell us:
 *
 * - Breadcrumbs (`traceLocalModel`) put the phases (load, projector attach, completion, parse)
 *   and their sizes and timings on any event that follows, so "it failed" says where.
 * - A run marker. A native crash or the OS killing the app for memory raises no JS exception, so
 *   nothing reaches Sentry. The marker is written BEFORE each heavy native call and removed when
 *   the run ends; one still there on the next launch means the process died inside that phase
 *   (`reportInterruptedLocalRun`).
 *
 * Only phase names, sizes, timings and ids: never a prompt, a reply, a photo or a path.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { LOCAL_MODEL_RUN_MARKER } from '@/constants/misc';

export type LocalRunPhase = 'load' | 'projector' | 'completion';

type TraceData = Record<string, string | number | boolean | null | undefined>;

type RunMarker = {
  phase: LocalRunPhase;
  at: number;
  model: string;
  hasImage: boolean;
  imageChars: number;
};

/** Greppable in `adb logcat` (React Native prints console.log under the ReactNativeJS tag). */
export const LOCAL_MODEL_LOG_TAG = '[LocalModel]';

/** One greppable line in `adb logcat`; never sent to Sentry, so it may carry the model's own text. */
export function logLocal(message: string, ...rest: unknown[]): void {
  console.log(LOCAL_MODEL_LOG_TAG, message, ...rest);
}

/** An error as one loggable string: name, message and the first stack lines. */
export function describeLogError(error: unknown): string {
  if (error instanceof Error) {
    const reason = (error as { reason?: unknown }).reason;

    return `${error.name}: ${error.message}${reason ? ` (reason ${String(reason)})` : ''}\n${(error.stack ?? '').split('\n').slice(0, 6).join('\n')}`;
  }

  return String(error);
}

export function traceLocalModel(message: string, data?: TraceData): void {
  // Same fields as the Sentry breadcrumb, so a phone on a cable and a field report read alike.
  console.log(LOCAL_MODEL_LOG_TAG, message, data ? JSON.stringify(data) : '');
  try {
    Sentry.addBreadcrumb({ category: 'local-model', level: 'info', message, data });
  } catch {
    // Tracing never affects a run.
  }
}

export async function markLocalRun(marker: Omit<RunMarker, 'at'>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LOCAL_MODEL_RUN_MARKER,
      JSON.stringify({ ...marker, at: Date.now() })
    );
  } catch {
    // Best effort.
  }
}

export async function clearLocalRun(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCAL_MODEL_RUN_MARKER);
  } catch {
    // Best effort.
  }
}

/** Boot: a marker left behind is a run the process did not survive. Reports once and clears it. */
export async function reportInterruptedLocalRun(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(LOCAL_MODEL_RUN_MARKER);
  } catch {
    return;
  }

  if (!raw) {
    return;
  }

  await clearLocalRun();
  console.log(LOCAL_MODEL_LOG_TAG, 'previous run did not finish', raw);
  let marker: RunMarker;
  try {
    marker = JSON.parse(raw) as RunMarker;
  } catch {
    return;
  }

  try {
    // Inline: this module is reached from the runtime, whose tests mock `@/utils/sentry`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { captureMessage } = require('@/utils/sentry') as typeof import('@/utils/sentry');
    await captureMessage('on-device-run-interrupted', {
      level: 'warning',
      tags: {
        context: 'localModels.interrupted',
        phase: marker.phase,
        model: marker.model,
        hasImage: String(marker.hasImage),
      },
      extra: { ageMs: Date.now() - marker.at, imageChars: marker.imageChars },
    });
  } catch {
    // Nothing to do if reporting itself fails.
  }
}

/**
 * A run that ended without an exception but without a usable answer (an empty reply, a reply that
 * does not match the schema, no food found). Silent otherwise: the person sees a generic failure.
 */
export async function reportLocalOutcome(outcome: string, data: TraceData): Promise<void> {
  traceLocalModel(outcome, data);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { captureMessage } = require('@/utils/sentry') as typeof import('@/utils/sentry');
    await captureMessage(`on-device-${outcome}`, {
      level: 'warning',
      tags: { context: 'localModels.outcome', outcome },
      extra: data,
    });
  } catch {
    // Reporting never blocks the flow.
  }
}
