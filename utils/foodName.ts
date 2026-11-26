// How the names of foods are compared when several answers talk about the same meal: the readings
// of one photo, a review's corrections, the estimate a request returns for each ingredient it was
// asked about. Pure and relative-import-only.

/** The key two spellings of one food are matched by: case, accents and extra spaces do not count. */
export function normalizeFoodName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Pairs every target with the estimate that answers it, in the order of `targets`.
 *
 * Names meet first, and an estimate answers at most one target (two targets with the same name take
 * two estimates, in order). A model that spelled a name differently is paired by position, but only
 * among what is left over and only when the leftovers are as many on both sides, so a late estimate
 * never lands on a target another estimate already answered.
 */
export function alignEstimates<T extends { name: string }>(
  targets: readonly { name: string }[],
  estimates: readonly T[]
): (T | undefined)[] {
  const taken = new Set<number>();
  const answers = targets.map((target) => {
    const key = normalizeFoodName(target.name);
    const index = estimates.findIndex(
      (estimate, position) => !taken.has(position) && normalizeFoodName(estimate.name) === key
    );

    if (index < 0) {
      return undefined;
    }

    taken.add(index);

    return estimates[index];
  });

  const unanswered = answers.flatMap((answer, position) => (answer ? [] : [position]));
  const spare = estimates.flatMap((_, position) => (taken.has(position) ? [] : [position]));
  if (unanswered.length > 0 && unanswered.length === spare.length) {
    unanswered.forEach((target, position) => {
      answers[target] = estimates[spare[position]];
    });
  }

  return answers;
}
