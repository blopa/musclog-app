/**
 * Superset-aware ordering for workout sets.
 * When sets share a group_id, they are ordered by "rounds": round 0 = first set of each
 * exercise in the group, round 1 = second set of each, etc.
 */

/** Minimal shape needed for superset ordering; WorkoutLogSet and plain objects satisfy this. */
export interface SetLike {
  setOrder: number;
  groupId?: string | null;
  exerciseId?: string | null;
  difficultyLevel?: number | null;
  isSkipped?: boolean | null;
  id?: string;
}

function isUnlogged(set: SetLike): boolean {
  return (set.difficultyLevel ?? 0) === 0 && !(set.isSkipped ?? false);
}

/**
 * Returns sets in effective (superset) order.
 * - Ungrouped sets: order by set_order, in place relative to each other.
 * - Grouped sets: group by groupId; within each group, order exercises by min set_order;
 *   then for each round index r, take the r-th set of each exercise (if exists).
 * - Multiple groups: ordered by the minimum set_order of each group.
 */
export function getEffectiveOrder<T extends SetLike>(sets: T[]): T[] {
  if (sets.length === 0) {
    return [];
  }

  const ungrouped = sets.filter((s) => s.groupId == null || s.groupId === '');
  const grouped = sets.filter((s) => s.groupId != null && s.groupId !== '');

  const result: T[] = [];

  // Sort ungrouped by set_order and add to result in order (we'll interleave with groups)
  const ungroupedSorted = [...ungrouped].sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));

  // Group by group_id
  const groupIds = [...new Set(grouped.map((s) => s.groupId).filter(Boolean))] as string[];
  // Order groups by min set_order of any set in the group
  const groupMinOrder = new Map<string, number>();
  groupIds.forEach((gid) => {
    const groupSets = grouped.filter((s) => s.groupId === gid);
    const minOrder = Math.min(...groupSets.map((s) => s.setOrder ?? 0));
    groupMinOrder.set(gid, minOrder);
  });
  const sortedGroupIds = [...groupIds].sort(
    (a, b) => (groupMinOrder.get(a) ?? 0) - (groupMinOrder.get(b) ?? 0)
  );

  // Build effective order: we need to merge "runs" of ungrouped and grouped blocks in set_order space
  // Simpler approach: collect all "blocks" (ungrouped run or one group) with their min set_order, sort blocks, then expand each block in effective order
  const blocks: { minOrder: number; sets: T[] }[] = [];

  ungroupedSorted.forEach((s) => {
    blocks.push({ minOrder: s.setOrder ?? 0, sets: [s] });
  });

  sortedGroupIds.forEach((gid) => {
    const groupSets = grouped.filter((s) => s.groupId === gid);
    const minOrder = Math.min(...groupSets.map((s) => s.setOrder ?? 0));
    blocks.push({ minOrder, sets: groupSets });
  });

  // Sort blocks by minOrder
  blocks.sort((a, b) => a.minOrder - b.minOrder);

  for (const block of blocks) {
    if (
      block.sets.length === 1 &&
      (block.sets[0].groupId == null || block.sets[0].groupId === '')
    ) {
      result.push(block.sets[0]);
      continue;
    }
    if (block.sets.length === 1) {
      // Single set in a group (only one exercise in group)
      result.push(block.sets[0]);
      continue;
    }
    // Group: order exercises by min set_order, then round-major
    const byExercise = new Map<string, T[]>();
    block.sets.forEach((s) => {
      const eid = s.exerciseId ?? '';
      if (!byExercise.has(eid)) {
        byExercise.set(eid, []);
      }
      byExercise.get(eid)!.push(s);
    });
    byExercise.forEach((exerciseSets) => {
      exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));
    });
    const exerciseOrder = [...byExercise.keys()].sort(
      (a, b) =>
        Math.min(...(byExercise.get(a) ?? []).map((s) => s.setOrder ?? 0)) -
        Math.min(...(byExercise.get(b) ?? []).map((s) => s.setOrder ?? 0))
    );
    const maxRound =
      Math.max(...exerciseOrder.map((eid) => (byExercise.get(eid) ?? []).length)) - 1;
    for (let r = 0; r <= maxRound; r++) {
      for (const eid of exerciseOrder) {
        const exerciseSets = byExercise.get(eid) ?? [];
        if (r < exerciseSets.length) {
          result.push(exerciseSets[r]);
        }
      }
    }
  }

  return result;
}

/**
 * Returns the first set in effective order that is unlogged and not skipped.
 */
export function getFirstUnloggedInEffectiveOrder<T extends SetLike>(sets: T[]): T | null {
  const ordered = getEffectiveOrder(sets);
  return ordered.find(isUnlogged) ?? null;
}

/**
 * Returns the next set in effective order after the set with the given set_order
 * that is unlogged and not skipped. If completedSetOrder is the last set, returns null.
 */
export function getNextSetInEffectiveOrder<T extends SetLike>(
  sets: T[],
  completedSetOrder: number
): T | null {
  const ordered = getEffectiveOrder(sets);
  const idx = ordered.findIndex((s) => (s.setOrder ?? 0) === completedSetOrder);
  if (idx < 0) {
    return null;
  }
  for (let i = idx + 1; i < ordered.length; i++) {
    if (isUnlogged(ordered[i])) {
      return ordered[i];
    }
  }
  return null;
}

/**
 * Round index of a set within its group (0 = first set of that exercise in the group).
 * For ungrouped sets, returns 0.
 */
export function getRoundIndexWithinGroup<T extends SetLike>(set: T, sets: T[]): number {
  const gid = set.groupId;
  if (gid == null || gid === '') {
    return 0;
  }
  const groupSets = sets.filter((s) => s.groupId === gid);
  const byExercise = new Map<string, T[]>();
  groupSets.forEach((s) => {
    const eid = s.exerciseId ?? '';
    if (!byExercise.has(eid)) {
      byExercise.set(eid, []);
    }
    byExercise.get(eid)!.push(s);
  });
  byExercise.forEach((exerciseSets) => {
    exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));
  });
  const exerciseSets = byExercise.get(set.exerciseId ?? '') ?? [];
  const pos = exerciseSets.findIndex((s) => (s.setOrder ?? 0) === (set.setOrder ?? 0));
  return pos >= 0 ? pos : 0;
}

/**
 * True if the next set (in effective order) after completedSet is in the same superset round:
 * same group_id and same round index. Used to decide whether to show rest or go straight to next exercise.
 */
export function isNextInSameSupersetRound<T extends SetLike>(
  completedSet: T,
  nextSet: T | null,
  sets: T[]
): boolean {
  if (nextSet == null) {
    return false;
  }
  const gid = completedSet.groupId;
  if (gid == null || gid === '' || nextSet.groupId !== gid) {
    return false;
  }
  const roundCompleted = getRoundIndexWithinGroup(completedSet, sets);
  const roundNext = getRoundIndexWithinGroup(nextSet, sets);
  return roundCompleted === roundNext;
}
