/** Legacy setting format, read only for lossless migration into nutrition_health_ownership. */
export type HealthTakeovers = {
  ignoredRecordIds: string[];
  ownedLogIds: string[];
};

function readIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
}

/** Older backups may contain arbitrary JSON; every valid fact survives, without a size cap. */
export function parseHealthTakeovers(raw: string): HealthTakeovers {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      return {
        ignoredRecordIds: readIds(record.ignoredRecordIds),
        ownedLogIds: readIds(record.ownedLogIds),
      };
    }
  } catch {
    // Invalid old settings carry no ownership facts.
  }

  return { ignoredRecordIds: [], ownedLogIds: [] };
}
