/**
 * Bookkeeping for logs the user edited after they were imported from another app.
 *
 * Health Connect / HealthKit only let an app change records it wrote, so editing an imported
 * log writes Musclog's own corrected record next to the original. The log then belongs to
 * Musclog (`ownedLogIds`) and the original record is never imported again
 * (`ignoredRecordIds`). Stored as one JSON setting; parsed tolerantly because rows can come
 * from a newer build or a backup, and capped so it cannot grow without bound.
 */

export type HealthTakeovers = {
  /** Platform record ids of the originals that were superseded by Musclog's own copy. */
  ignoredRecordIds: string[];
  /** Ids of the nutrition logs Musclog now owns on the platform. */
  ownedLogIds: string[];
};

export const MAX_HEALTH_TAKEOVERS = 1000;

export const EMPTY_HEALTH_TAKEOVERS: HealthTakeovers = { ignoredRecordIds: [], ownedLogIds: [] };

function readIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
}

export function parseHealthTakeovers(raw: string): HealthTakeovers {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ignoredRecordIds: [], ownedLogIds: [] };
    }

    const record = parsed as Record<string, unknown>;

    return {
      ignoredRecordIds: readIds(record.ignoredRecordIds).slice(-MAX_HEALTH_TAKEOVERS),
      ownedLogIds: readIds(record.ownedLogIds).slice(-MAX_HEALTH_TAKEOVERS),
    };
  } catch {
    return { ignoredRecordIds: [], ownedLogIds: [] };
  }
}

export function serializeHealthTakeovers(value: HealthTakeovers): string {
  return JSON.stringify(parseHealthTakeovers(JSON.stringify(value)));
}

/** `current` plus one takeover; adding the same pair twice changes nothing. */
export function withHealthTakeover(
  current: HealthTakeovers,
  logId: string,
  originalRecordId: string
): HealthTakeovers {
  const add = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);

  return {
    ignoredRecordIds: add(current.ignoredRecordIds, originalRecordId).slice(-MAX_HEALTH_TAKEOVERS),
    ownedLogIds: add(current.ownedLogIds, logId).slice(-MAX_HEALTH_TAKEOVERS),
  };
}
