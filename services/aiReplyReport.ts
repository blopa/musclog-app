import { randomUUID } from 'expo-crypto';

import { buildAiReportEnvelope, parseSentryDsn } from '@/utils/aiReplyReport';
import type { FeedbackEnvironment } from '@/utils/feedbackLinks';

const SEND_TIMEOUT_MS = 10_000;

/**
 * Sends the report the person confirmed. Resolves false when it could not be delivered (no
 * reporting address in this build, offline, refused), so the screen can offer the mail draft.
 */
export async function sendAiReplyReport(reply: string, env: FeedbackEnvironment): Promise<boolean> {
  const target = parseSentryDsn(process.env.EXPO_PUBLIC_SENTRY_DSN);

  if (!target) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch(target.envelopeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: buildAiReportEnvelope({
        target,
        eventId: randomUUID().replace(/-/g, ''),
        now: new Date(),
        reply,
        env,
      }),
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
