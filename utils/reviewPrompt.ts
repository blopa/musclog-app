/**
 * When to ask for a store rating. Pure policy: the service reads and writes the state, the OS
 * decides whether the dialog really shows (it throttles and never says).
 */
export type ReviewMoment = 'workoutCompleted' | 'weeklyReviewDecided';

export interface ReviewPromptState {
  /** Positive moments since the last request. */
  moments: number;
  lastRequestedAt: number | null;
  requestCount: number;
}

export const REVIEW_MIN_MOMENTS = 3;
export const REVIEW_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;
export const REVIEW_MAX_REQUESTS = 3;

export const INITIAL_REVIEW_PROMPT_STATE: ReviewPromptState = {
  moments: 0,
  lastRequestedAt: null,
  requestCount: 0,
};

const nonNegativeInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;

export function parseReviewPromptState(raw: string | null): ReviewPromptState {
  if (!raw) {
    return { ...INITIAL_REVIEW_PROMPT_STATE };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...INITIAL_REVIEW_PROMPT_STATE };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ...INITIAL_REVIEW_PROMPT_STATE };
  }

  const record = parsed as Record<string, unknown>;

  return {
    moments: nonNegativeInt(record.moments) ?? 0,
    lastRequestedAt: nonNegativeInt(record.lastRequestedAt),
    requestCount: nonNegativeInt(record.requestCount) ?? 0,
  };
}

export function recordReviewMoment(
  state: ReviewPromptState,
  now: number
): { next: ReviewPromptState; shouldRequest: boolean } {
  const moments = state.moments + 1;
  const cooledDown =
    state.lastRequestedAt === null || now - state.lastRequestedAt >= REVIEW_COOLDOWN_MS;
  const shouldRequest =
    moments >= REVIEW_MIN_MOMENTS && state.requestCount < REVIEW_MAX_REQUESTS && cooledDown;

  if (!shouldRequest) {
    return { next: { ...state, moments }, shouldRequest: false };
  }

  return {
    next: { moments: 0, lastRequestedAt: now, requestCount: state.requestCount + 1 },
    shouldRequest: true,
  };
}
