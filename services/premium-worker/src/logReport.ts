// Forwards the Worker's serious faults to Sentry (paging), on top of the console line that
// `consoleLogger` already writes. Content-free by construction: the signal's identity is its
// exception type (the event code) and the tags `src/sentry.ts` allows; the exception message is
// empty and `scrubEvent` drops everything else. An `info` event, and an `error` event that is an
// operator switch (`hosted_disabled`), is never reported.
import * as Sentry from '@sentry/cloudflare';
import type { LogEvent, Logger } from './log';
import { consoleLogger } from './log';

/** Error events that are still faults. Other error events (for example `hosted_disabled`) are a switch. */
export const REPORTED_ERROR_CODES: ReadonlySet<string> = new Set([
  'otari_provider_unverified',
  'settle_failed',
]);

export const REPORT_INTERVAL_MS = 60_000;

/** Module level on purpose: each request builds a new logger, the throttle must outlive it (per isolate). */
const lastReported = new Map<string, number>();

export function resetLogReportThrottle(): void {
  lastReported.clear();
}

export function shouldReport(event: LogEvent): boolean {
  if (event.severity === 'high') return true;
  return (
    event.severity === 'error' && event.code !== undefined && REPORTED_ERROR_CODES.has(event.code)
  );
}

class WorkerSignal extends Error {
  constructor(code: string) {
    super(code);
    this.name = code;
  }
}

export function describeLogEvent(event: LogEvent): {
  name: string;
  tags: Record<string, string>;
  fingerprint: string[];
} {
  const name = event.code ?? 'unknown';
  const tags: Record<string, string> = {
    route: event.route,
    status: String(event.status),
    code: name,
    severity: event.severity ?? 'info',
  };
  if (event.upstream !== undefined) tags.upstream = event.upstream;
  return { name, tags, fingerprint: ['premium-worker', event.route, name] };
}

export function captureLogEvent(event: LogEvent): void {
  try {
    const { name, tags, fingerprint } = describeLogEvent(event);
    Sentry.captureException(new WorkerSignal(name), { tags, fingerprint });
  } catch {
    // Reporting must never break a request.
  }
}

export function sentryLogger(
  inner: Logger,
  send: (event: LogEvent) => void = captureLogEvent,
  now: () => number = Date.now
): Logger {
  return {
    log(event) {
      inner.log(event);
      if (!shouldReport(event)) return;
      const key = `${event.route}|${event.code ?? 'unknown'}`;
      const at = now();
      const last = lastReported.get(key);
      if (last !== undefined && at - last < REPORT_INTERVAL_MS) return;
      lastReported.set(key, at);
      try {
        send(event);
      } catch {
        // Reporting must never throw out of log.
      }
    },
  };
}
