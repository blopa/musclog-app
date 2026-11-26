// The extra requests a thinking level makes (`utils/aiThinkingLevel.ts` -> `THINKING_PIPELINE`),
// in two shapes every feature shares: independent samples of one job, combined afterwards by code,
// and rounds of critique and revision that replace an answer only when code says the revision is no
// worse. Both keep the rule the meal refinement set: an extra request may make an answer better,
// never fail it, so only a cancel propagates. Relative imports only.

import { AiCancelledError } from './aiErrors';
import type { CoachAIConfig } from './coachAI';
import { providerPolicyFor } from './providerPolicy';

/**
 * Runs a job `count` times and returns every answer it gave, in order. Cloud providers run the
 * samples together; the on-device model and a local server run them one after another, since a
 * second request would only queue behind the first (or fight it for memory). Each sample is its
 * own logical request, so Musclog Iron gives each its own idempotency key. A sample that fails or
 * answers nothing is left out; a cancel stops everything. When no sample answers, the first
 * failure is rethrown, so a wrong key or an exhausted allowance still reaches the person as it
 * would with one request.
 *
 * A failure that is left out because other samples answered is swallowed, so it is handed to
 * `onDroppedFailure` (callers pass `reportAiError` with their context): nobody else will see it.
 * When nothing answered, the rethrown failure is the report and the callback is not called.
 */
export async function runSamples<T>(
  config: Pick<CoachAIConfig, 'provider' | 'engine'>,
  count: number,
  run: (index: number) => Promise<T | null | undefined>,
  options: { onDroppedFailure?: (error: unknown) => void } = {}
): Promise<T[]> {
  const total = Math.max(1, Math.floor(count));
  const settled: PromiseSettledResult<T | null | undefined>[] = [];

  if (providerPolicyFor(config).runsSamplesSequentially) {
    for (let index = 0; index < total; index++) {
      try {
        settled.push({ status: 'fulfilled', value: await run(index) });
      } catch (error) {
        if (error instanceof AiCancelledError) {
          throw error;
        }

        settled.push({ status: 'rejected', reason: error });
      }
    }
  } else {
    settled.push(
      ...(await Promise.allSettled(Array.from({ length: total }, (_, index) => run(index))))
    );
  }

  const cancelled = settled.find(
    (result) => result.status === 'rejected' && result.reason instanceof AiCancelledError
  );

  if (cancelled?.status === 'rejected') {
    throw cancelled.reason;
  }

  const answers = settled.flatMap((result) =>
    result.status === 'fulfilled' && result.value != null ? [result.value] : []
  );

  const failures = settled.flatMap((result) =>
    result.status === 'rejected' ? [result.reason as unknown] : []
  );
  if (answers.length === 0 && failures.length > 0) {
    throw failures[0];
  }

  for (const failure of failures) {
    options.onDroppedFailure?.(failure);
  }

  return answers;
}

export type ReviewAndReviseOptions<T> = {
  draft: T;
  rounds: number;
  /** Asks for a corrected version of `current`; null means the reviewer had nothing to offer. */
  critique: (current: T, round: number) => Promise<T | null | undefined>;
  /**
   * Whether `revised` may replace `current`, decided by code (fewer implausible numbers, fewer
   * broken constraints, fewer figures the data does not hold), never by the model's own say-so.
   */
  accept: (current: T, revised: T) => boolean;
  /** Told about a failed round, which keeps the answer it had; a cancel is rethrown instead. */
  onError?: (error: unknown) => void;
  /**
   * Whether a revision is the answer it reviewed, unchanged. Off by default. Given (a level that
   * exits early passes `sameValue`), a revision that changes nothing adds nothing, so the loop ends
   * there instead of asking for the remaining rounds.
   */
  isUnchanged?: (current: T, revised: T) => boolean;
};

/** Structural equality for plain JSON-like answers (a meal, a plan, a text): same content, same order. */
export function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Up to `rounds` rounds of critique and revision. A round whose revision is refused, empty,
 * failed or (with `isUnchanged`) identical to the answer it reviewed ends the loop with the answer
 * it had: a reviewer that could not improve it once is not asked again.
 */
export async function reviewAndRevise<T>({
  draft,
  rounds,
  critique,
  accept,
  onError,
  isUnchanged,
}: ReviewAndReviseOptions<T>): Promise<T> {
  let current = draft;

  for (let round = 0; round < rounds; round++) {
    let revised: T | null | undefined;
    try {
      revised = await critique(current, round);
    } catch (error) {
      if (error instanceof AiCancelledError) {
        throw error;
      }

      onError?.(error);
      return current;
    }

    if (revised == null || !accept(current, revised)) {
      return current;
    }

    if (isUnchanged?.(current, revised)) {
      return current;
    }

    current = revised;
  }

  return current;
}
