// Device-local Musclog Iron state (plan 6.1). One JSON string in AsyncStorage under
// PREMIUM_DEVICE_STATE. It never holds a token: unknown keys are dropped on every read and write.
// Storage failures never reach callers: a read returns the empty state, a write is swallowed.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PREMIUM_DEVICE_STATE } from '@/constants/misc';
import { isRecord } from '@/utils/isRecord';
import { RC_ID_PATTERN } from '@/utils/premium/deviceKeyCrypto';
import {
  parseDevices,
  parseIsoDate,
  parsePercent,
  PREMIUM_PERIOD_STATUSES,
  type PremiumDevices,
  type PremiumPeriodStatus,
} from '@/utils/premium/premiumState';

export type PremiumLocalState = {
  /** The key-derived id this device enrolled with. */
  rcId: string | null;
  /** The Worker answered 401 unknown_device. */
  removed: boolean;
  lastStatus: PremiumPeriodStatus | null;
  /** 0..100, last value from the Worker. */
  usedPct: number | null;
  /** ISO string. */
  resetsAt: string | null;
  devices: PremiumDevices | null;
};

export const EMPTY_PREMIUM_LOCAL_STATE: PremiumLocalState = {
  rcId: null,
  removed: false,
  lastStatus: null,
  usedPct: null,
  resetsAt: null,
  devices: null,
};

/**
 * Pure and tolerant: bad JSON, wrong types, unknown keys and out-of-range values fall back
 * field by field to the empty value. Never throws.
 */
export function parsePremiumLocalState(raw: string | null): PremiumLocalState {
  if (typeof raw !== 'string') {
    return { ...EMPTY_PREMIUM_LOCAL_STATE };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...EMPTY_PREMIUM_LOCAL_STATE };
  }

  if (!isRecord(data)) {
    return { ...EMPTY_PREMIUM_LOCAL_STATE };
  }

  const rcId = typeof data.rcId === 'string' && RC_ID_PATTERN.test(data.rcId) ? data.rcId : null;
  const lastStatus = PREMIUM_PERIOD_STATUSES.find((kind) => kind === data.lastStatus) ?? null;
  const usedPct = parsePercent(data.usedPct);

  return {
    rcId,
    removed: data.removed === true,
    lastStatus,
    usedPct,
    resetsAt: parseIsoDate(data.resetsAt),
    devices: parseDevices(data.devices),
  };
}

export async function loadPremiumLocalState(): Promise<PremiumLocalState> {
  try {
    return parsePremiumLocalState(await AsyncStorage.getItem(PREMIUM_DEVICE_STATE));
  } catch {
    return { ...EMPTY_PREMIUM_LOCAL_STATE };
  }
}

// Every read-merge-write runs one after another, so two concurrent patches cannot drop each other.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function savePremiumLocalState(
  patch: Partial<PremiumLocalState>
): Promise<PremiumLocalState> {
  return enqueue(async () => {
    const current = await loadPremiumLocalState();
    // Re-parsing drops unknown keys (a session token can never be stored) and bad values.
    const next = parsePremiumLocalState(JSON.stringify({ ...current, ...patch }));
    try {
      await AsyncStorage.setItem(PREMIUM_DEVICE_STATE, JSON.stringify(next));
    } catch {
      // Storage failures are swallowed: the caller still gets the state it asked to save.
    }

    return next;
  });
}

export function clearPremiumLocalState(): Promise<void> {
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(PREMIUM_DEVICE_STATE);
    } catch {
      // Swallowed, as for writes.
    }
  });
}
