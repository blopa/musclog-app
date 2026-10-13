/** How far back a workout must have been trained to count as part of the user's current rotation. */
export const ROTATION_LOOKBACK_DAYS = 42;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RotationLog = { templateId?: string | null; completedAt?: number | null };

export type RotationSuggestion = {
  templateId: string;
  /** When it was last completed: the reason it is suggested. */
  lastCompletedAt: number;
};

/**
 * "What do I train now?" for someone with no schedule and no rotating plan — most users. Among the
 * workouts they have actually trained in the last {@link ROTATION_LOOKBACK_DAYS}, the one rested
 * longest is the next in their de-facto split (push → pull → legs repeats without being declared).
 * Returns null when nothing qualifies, or when a workout was already finished today: the card then
 * shows that, rather than pushing a second session.
 *
 * Only `templateIds` that are still live (not archived/deleted) may be suggested.
 */
export function pickRotationSuggestion(
  logs: RotationLog[],
  templateIds: ReadonlySet<string>,
  todayStartMs: number
): RotationSuggestion | null {
  const since = todayStartMs - ROTATION_LOOKBACK_DAYS * DAY_MS;
  const latest = new Map<string, number>();
  for (const log of logs) {
    if (!log.templateId || log.completedAt == null || !templateIds.has(log.templateId)) {
      continue;
    }

    if (log.completedAt < since) {
      continue;
    }

    if (log.completedAt >= todayStartMs) {
      return null;
    }

    latest.set(log.templateId, Math.max(latest.get(log.templateId) ?? 0, log.completedAt));
  }

  let best: RotationSuggestion | null = null;
  for (const [templateId, lastCompletedAt] of latest) {
    if (!best || lastCompletedAt < best.lastCompletedAt) {
      best = { templateId, lastCompletedAt };
    }
  }

  return best;
}
