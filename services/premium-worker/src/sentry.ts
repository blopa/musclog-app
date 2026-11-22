// Sentry for the Worker (errors and low-rate traces only). The Worker is content-free by design
// (src/log.ts: no prompt, response, token, key, rc_id or IP), so Sentry gets the same promise:
// nothing from the request, no user, no breadcrumbs, and exception messages are dropped (an
// upstream failure message could echo content). What stays is the exception type, the stack
// trace, the release and the tags this file allows. With no SENTRY_DSN (local, test) the SDK
// is off and sends nothing.
//
// Outgoing calls are never traced: the SDK's default fetch integration would record a span per
// RevenueCat request, and its URL carries the device identifier (`/customers/mlg1_…`), and it would
// add trace headers to the OpenRouter and RevenueCat requests. So that integration is removed, no
// request is a propagation target, and `scrubEvent` drops spans as a second lock.
import type { CloudflareOptions } from '@sentry/cloudflare';
import type { Env } from './env';

/** Fraction of requests traced. Staging traces everything, production keeps it low. */
export function tracesSampleRateFor(workerEnv: string): number {
  if (workerEnv === 'production') return 0.1;
  if (workerEnv === 'staging') return 1;
  return 0;
}

const ALLOWED_TAGS = new Set(['route', 'status', 'code', 'severity']);

interface Scrubbable {
  request?: unknown;
  user?: unknown;
  breadcrumbs?: unknown;
  extra?: unknown;
  contexts?: Record<string, unknown>;
  spans?: unknown;
  tags?: Record<string, unknown>;
  exception?: { values?: { type?: string; value?: string }[] };
  message?: string;
  server_name?: string;
}

/** The trace context's own ids and outcome. Its `data` holds span attributes (URLs, headers). */
const TRACE_CONTEXT_KEYS = ['trace_id', 'span_id', 'parent_span_id', 'op', 'status', 'origin'];

function scrubTraceContext(trace: unknown): Record<string, unknown> | null {
  if (typeof trace !== 'object' || trace === null) return null;
  const source = trace as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const key of TRACE_CONTEXT_KEYS) if (key in source) kept[key] = source[key];
  return kept;
}

/**
 * Strips everything but the exception type, stack, release, runtime and allowed tags. Child spans
 * are dropped whole: a span of an outgoing call names its URL, and a RevenueCat URL holds `rc_id`.
 */
export function scrubEvent<T extends Scrubbable>(event: T): T {
  delete event.request;
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  delete event.message;
  delete event.server_name;
  delete event.spans;
  if (event.exception?.values) {
    for (const v of event.exception.values) v.value = '';
  }
  if (event.contexts) {
    const { trace, runtime, cloud_resource } = event.contexts as Record<string, unknown>;
    const safeTrace = scrubTraceContext(trace);
    event.contexts = {
      ...(safeTrace ? { trace: safeTrace } : {}),
      ...(runtime ? { runtime } : {}),
      ...(cloud_resource ? { cloud_resource } : {}),
    };
  }
  if (event.tags) {
    for (const k of Object.keys(event.tags)) if (!ALLOWED_TAGS.has(k)) delete event.tags[k];
  }
  return event;
}

export function sentryOptions(env: Env): CloudflareOptions {
  return {
    dsn: env.SENTRY_DSN || undefined,
    environment: env.WORKER_ENV,
    dataCollection: { userInfo: false },
    // No outgoing-request spans and no trace headers on the OpenRouter and RevenueCat calls.
    integrations: (defaults) => defaults.filter((integration) => integration.name !== 'Fetch'),
    tracePropagationTargets: [],
    tracesSampleRate: tracesSampleRateFor(env.WORKER_ENV),
    beforeBreadcrumb: () => null,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  };
}
