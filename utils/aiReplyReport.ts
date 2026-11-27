// A report of one AI reply as a Sentry user-feedback envelope. Pure: nothing is sent here.
//
// Built by hand, not through the Sentry SDK, on purpose: the SDK is running only while "Anonymous
// bug report" is on, and a report the person sends themselves must work either way without turning
// crash reporting on behind their back.

import { formatAppVersion } from '@/utils/appVersionLabel';
import type { FeedbackEnvironment } from '@/utils/feedbackLinks';

/** Sentry refuses a longer user-feedback message. */
export const AI_REPORT_MAX_MESSAGE_CHARS = 4000;

export type SentryTarget = { dsn: string; envelopeUrl: string };

/** Reads `https://<key>@<host>/<project>`; null when there is no usable DSN. */
export function parseSentryDsn(dsn: string | undefined | null): SentryTarget | null {
  const match = /^(https?):\/\/([^:@/]+)(?::[^@/]*)?@([^/]+)((?:\/[^/]+)*)\/(\d+)\/?$/.exec(
    dsn?.trim() ?? ''
  );

  if (!match) {
    return null;
  }

  const [, protocol, publicKey, host, path, projectId] = match;

  return {
    dsn: match[0],
    envelopeUrl: `${protocol}://${host}${path}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`,
  };
}

type EnvelopeInput = {
  target: SentryTarget;
  /** 32 hexadecimal characters. */
  eventId: string;
  now: Date;
  reply: string;
  env: FeedbackEnvironment;
};

/** The reply and the app's version, platform and language. Nothing about the person. */
export function buildAiReportEnvelope({ target, eventId, now, reply, env }: EnvelopeInput): string {
  const message = reply.slice(0, AI_REPORT_MAX_MESSAGE_CHARS) || '(empty reply)';

  const header = { event_id: eventId, sent_at: now.toISOString(), dsn: target.dsn };
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: 'javascript',
    level: 'info',
    contexts: { feedback: { message, source: 'ai-reply-report' } },
    tags: {
      app_version: formatAppVersion(env),
      app_platform: env.osVersion ? `${env.platform} ${env.osVersion}` : env.platform,
      app_locale: env.locale,
    },
  };

  // `JSON.stringify` escapes newlines, so each part stays on its own line as the format requires.
  return `${JSON.stringify(header)}\n${JSON.stringify({ type: 'feedback' })}\n${JSON.stringify(event)}\n`;
}
