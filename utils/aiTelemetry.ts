// Quality signals of the AI features that are not exceptions: nothing threw, but the answer was
// unusable, or a step had to be rescued. They reach Sentry as one grouped message each, so a small
// model that stopped following its schema, or a download that arrives corrupt, shows up as a count
// rather than as a silent drop in quality. Consent is checked inside `captureMessage`.
//
// Content-free by construction: tags carry the provider, the operation and a short fixed reason,
// never a prompt, a reply, a food name, a path or a key. Fire and forget: reporting must never
// change what the person sees or throw into a request.
import { captureMessage } from './sentry';

export type AiTelemetryEvent =
  /** A local model's structured reply was still unusable after the shape check and the repair call. */
  | 'ai-structured-reply-unusable'
  /** The repair call turned an unusable local reply into a usable one (how often it is needed). */
  | 'ai-structured-reply-repaired'
  /** The downloaded model's files did not match their published checksum. */
  | 'local-model-checksum-mismatch'
  /** The photo projector of the downloaded model could not be attached. */
  | 'local-model-projector-failed'
  /** A first look at a meal came back but held nothing the estimate could use. */
  | 'ai-meal-look-unusable'
  /** A meal estimate finished with no ingredient at all (no reply, or a reply with nothing in it). */
  | 'ai-meal-estimate-empty'
  /** The downloaded model's chat reply copied one of its own earlier ones and was written again. */
  | 'ai-chat-reply-copied';

const LEVELS: Record<AiTelemetryEvent, 'warning' | 'info' | 'error'> = {
  'ai-structured-reply-unusable': 'warning',
  'ai-structured-reply-repaired': 'info',
  'local-model-checksum-mismatch': 'error',
  'local-model-projector-failed': 'error',
  'ai-meal-look-unusable': 'warning',
  'ai-meal-estimate-empty': 'warning',
  'ai-chat-reply-copied': 'info',
};

export type AiTelemetryTags = Record<string, string | number | boolean | undefined>;

/** Tags as Sentry wants them: strings, with the unset ones left out. */
export function aiTelemetryTags(tags: AiTelemetryTags): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value !== undefined) {
      out[key] = String(value);
    }
  }

  return out;
}

export function reportAiEvent(event: AiTelemetryEvent, tags: AiTelemetryTags = {}): void {
  try {
    const clean = aiTelemetryTags(tags);

    void captureMessage(event, {
      level: LEVELS[event],
      tags: clean,
      // One issue per event, provider and operation: a count to watch, not a stream of reports.
      fingerprint: [event, clean.provider ?? '', clean.operation ?? ''],
    }).catch(() => {});
  } catch {
    // Never throws.
  }
}
