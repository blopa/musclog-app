export type HarnessAction =
  | 'configure'
  | 'offerings'
  | 'buyMonthly'
  | 'restore'
  | 'syncPurchases'
  | 'logIn'
  | 'customerInfo'
  | 'resetKey'
  | 'bench'
  | 'hostedChallenge'
  | 'hostedEnroll'
  | 'hostedSession';

export type HarnessLogError = {
  name: string;
  message: string;
  code?: string | number;
  userCancelled?: boolean;
  [extra: string]: unknown;
};

export type HarnessLogEntry = {
  id: number;
  action: HarnessAction;
  startedAtIso: string;
  durationMs: number;
  ok: boolean;
  rcId: string | null;
  result: unknown;
  error: HarnessLogError | null;
};

const MAX_DEPTH = 12;
const MAX_STRING = 20000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safe(value: unknown, depth: number, seen: unknown[]): unknown {
  try {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === 'string') {
      return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : String(value);
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (seen.includes(value)) {
      return '[circular]';
    }

    if (depth >= MAX_DEPTH) {
      return '[max depth]';
    }

    const nextSeen = [...seen, value];

    if (value instanceof Map) {
      const out: Record<string, unknown> = {};

      for (const [k, v] of value.entries()) {
        const copy = safe(v, depth + 1, nextSeen);

        if (copy !== undefined) {
          out[String(k)] = copy;
        }
      }

      return out;
    }

    if (value instanceof Set) {
      return Array.from(value.values()).map((v) => {
        const copy = safe(v, depth + 1, nextSeen);

        return copy === undefined ? null : copy;
      });
    }

    if (Array.isArray(value)) {
      return value.map((v) => {
        const copy = safe(v, depth + 1, nextSeen);

        return copy === undefined ? null : copy;
      });
    }

    if (isRecord(value)) {
      const out: Record<string, unknown> = {};

      for (const key of Object.keys(value)) {
        const copy = safe(value[key], depth + 1, nextSeen);

        if (copy !== undefined) {
          out[key] = copy;
        }
      }

      return out;
    }

    return undefined;
  } catch {
    return '[unreadable]';
  }
}

export function toJsonSafe(value: unknown): unknown {
  const result = safe(value, 0, []);

  return result === undefined ? null : result;
}

export function describeError(e: unknown): HarnessLogEntry['error'] {
  if (!isRecord(e)) {
    return { name: 'Error', message: String(e) };
  }

  const out: HarnessLogError = {
    name: typeof e.name === 'string' && e.name ? e.name : 'Error',
    message: typeof e.message === 'string' ? e.message : String(e),
  };

  if (typeof e.code === 'string' || typeof e.code === 'number') {
    out.code = e.code;
  }

  if (typeof e.userCancelled === 'boolean') {
    out.userCancelled = e.userCancelled;
  }

  if (typeof e.underlyingErrorMessage === 'string') {
    out.underlyingErrorMessage = e.underlyingErrorMessage;
  }

  if (typeof e.readableErrorCode === 'string') {
    out.readableErrorCode = e.readableErrorCode;
  }

  return out;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function summarizeCustomerInfo(info: unknown): {
  originalAppUserId: string | null;
  activeEntitlementIds: string[];
  entitlements: unknown;
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  subscriptionsByProductIdentifier: unknown;
  nonSubscriptionTransactions: unknown;
  latestExpirationDate: string | null;
  requestDate: string | null;
  firstSeen: string | null;
  managementURL: string | null;
} {
  const i = isRecord(info) ? info : {};
  const entitlements = isRecord(i.entitlements) ? i.entitlements : {};
  const active = isRecord(entitlements.active) ? entitlements.active : {};

  return {
    originalAppUserId: str(i.originalAppUserId),
    activeEntitlementIds: Object.keys(active),
    entitlements: toJsonSafe(i.entitlements ?? null),
    activeSubscriptions: strings(i.activeSubscriptions),
    allPurchasedProductIdentifiers: strings(i.allPurchasedProductIdentifiers),
    subscriptionsByProductIdentifier: toJsonSafe(i.subscriptionsByProductIdentifier ?? null),
    nonSubscriptionTransactions: toJsonSafe(i.nonSubscriptionTransactions ?? []),
    latestExpirationDate: str(i.latestExpirationDate),
    requestDate: str(i.requestDate),
    firstSeen: str(i.firstSeen),
    managementURL: str(i.managementURL),
  };
}

export function summarizePurchase(result: unknown): {
  productIdentifier: string | null;
  transactionIdentifier: string | null;
  customerInfo: ReturnType<typeof summarizeCustomerInfo>;
} {
  const r = isRecord(result) ? result : {};
  const transaction = isRecord(r.transaction) ? r.transaction : {};

  return {
    productIdentifier: str(r.productIdentifier),
    transactionIdentifier: str(transaction.transactionIdentifier),
    customerInfo: summarizeCustomerInfo(r.customerInfo),
  };
}

export function makeLogEntry(
  partial: Pick<HarnessLogEntry, 'id' | 'action'> & Partial<HarnessLogEntry>
): HarnessLogEntry {
  return {
    id: partial.id,
    action: partial.action,
    startedAtIso: partial.startedAtIso ?? new Date().toISOString(),
    durationMs: partial.durationMs ?? 0,
    ok: partial.ok ?? true,
    rcId: partial.rcId ?? null,
    result: partial.result === undefined ? null : toJsonSafe(partial.result),
    error: partial.error ?? null,
  };
}

export function serializeLog(entries: HarnessLogEntry[]): string {
  const ordered = [...entries]
    .sort((a, b) => a.id - b.id)
    .map((e) => ({
      id: e.id,
      action: e.action,
      startedAtIso: e.startedAtIso,
      durationMs: e.durationMs,
      ok: e.ok,
      rcId: e.rcId,
      result: toJsonSafe(e.result),
      error: e.error,
    }));

  return JSON.stringify(ordered, null, 2);
}
