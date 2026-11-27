import {
  AI_REPORT_MAX_MESSAGE_CHARS,
  buildAiReportEnvelope,
  parseSentryDsn,
} from '@/utils/aiReplyReport';
import type { FeedbackEnvironment } from '@/utils/feedbackLinks';

const DSN = 'https://abc123@o42.ingest.de.sentry.io/4507';

const env: FeedbackEnvironment = {
  appVersion: '2.18.0',
  buildNumber: 300,
  platform: 'android',
  osVersion: '36',
  locale: 'nl-NL',
};

describe('parseSentryDsn', () => {
  it('builds the envelope address from a DSN', () => {
    expect(parseSentryDsn(DSN)).toEqual({
      dsn: DSN,
      envelopeUrl:
        'https://o42.ingest.de.sentry.io/api/4507/envelope/?sentry_key=abc123&sentry_version=7',
    });
  });

  it.each([undefined, null, '', 'not a dsn', 'https://o42.ingest.sentry.io/4507'])(
    'answers null for %s',
    (dsn) => {
      expect(parseSentryDsn(dsn)).toBeNull();
    }
  );
});

describe('buildAiReportEnvelope', () => {
  const build = (reply: string) =>
    buildAiReportEnvelope({
      target: parseSentryDsn(DSN)!,
      eventId: 'a'.repeat(32),
      now: new Date('2026-11-27T10:00:00Z'),
      reply,
      env,
    });

  it('is a header, a feedback item header and one line of payload', () => {
    const lines = build('line one\nline two').trimEnd().split('\n');

    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toMatchObject({ event_id: 'a'.repeat(32), dsn: DSN });
    expect(JSON.parse(lines[1])).toEqual({ type: 'feedback' });
    expect(JSON.parse(lines[2]).contexts.feedback.message).toBe('line one\nline two');
  });

  it('carries the app version, platform and language and nothing about the person', () => {
    const event = JSON.parse(build('reply').trimEnd().split('\n')[2]);

    expect(Object.keys(event.tags).sort()).toEqual(['app_locale', 'app_platform', 'app_version']);
    expect(event.tags.app_platform).toBe('android 36');
    expect(event.user).toBeUndefined();
  });

  it('cuts a reply Sentry would refuse', () => {
    const event = JSON.parse(
      build('x'.repeat(AI_REPORT_MAX_MESSAGE_CHARS + 50))
        .trimEnd()
        .split('\n')[2]
    );

    expect(event.contexts.feedback.message).toHaveLength(AI_REPORT_MAX_MESSAGE_CHARS);
  });
});
