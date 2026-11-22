// Content-free structured logging (plan section 10). Only these fields exist, so a prompt,
// response, token, key, rc_id or IP cannot be logged by accident: there is no free-text field.
// Error and overrun lines are always kept; everything else is sampled at `sampleRate`.

export interface LogEvent {
  route: string;
  status: number;
  code?: string;
  latency_ms?: number;
  /** First 8 hex chars of the lineage key (a hash), never an rc_id. */
  lineage_prefix?: string;
  model?: string;
  tokens?: number;
  cost_u?: number;
  overrun?: boolean;
  /** 'info' | 'error' | 'high' (high = page someone: breaker opened, identity conflict). */
  severity?: 'info' | 'error' | 'high';
}

export interface Logger {
  log(event: LogEvent): void;
}

const ALLOWED = new Set<keyof LogEvent>([
  'route',
  'status',
  'code',
  'latency_ms',
  'lineage_prefix',
  'model',
  'tokens',
  'cost_u',
  'overrun',
  'severity',
]);

/** Drops any key that is not a LogEvent field (a defence for callers that spread objects). */
export function sanitize(event: LogEvent): LogEvent {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(event)) {
    if (ALLOWED.has(k as keyof LogEvent) && v !== undefined) out[k] = v;
  }
  return out as unknown as LogEvent;
}

export function consoleLogger(sampleRate = 0.1, random: () => number = Math.random): Logger {
  return {
    log(event) {
      const keep =
        event.severity === 'error' ||
        event.severity === 'high' ||
        event.overrun === true ||
        event.status >= 500 ||
        random() < sampleRate;
      if (keep) console.log(JSON.stringify(sanitize(event)));
    },
  };
}

export const lineagePrefix = (lineageKey: string) => lineageKey.slice(0, 8);
