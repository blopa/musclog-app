import type { SetLike } from '../workoutSupersetOrder';
import {
  getEffectiveOrder,
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
  getRoundIndexWithinGroup,
  isNextInSameSupersetRound,
} from '../workoutSupersetOrder';

function set(
  setOrder: number,
  exerciseId: string,
  groupId?: string | null,
  overrides: Partial<SetLike> = {}
): SetLike {
  return {
    setOrder,
    exerciseId,
    groupId: groupId ?? undefined,
    difficultyLevel: 0,
    isSkipped: false,
    ...overrides,
  };
}

describe('workoutSupersetOrder', () => {
  describe('getEffectiveOrder', () => {
    it('returns empty array for empty input', () => {
      expect(getEffectiveOrder([])).toEqual([]);
    });

    it('returns single set as-is', () => {
      const sets = [set(1, 'exA')];
      expect(getEffectiveOrder(sets).map((s) => s.setOrder)).toEqual([1]);
    });

    it('orders ungrouped sets by set_order', () => {
      const sets = [set(2, 'exA'), set(1, 'exB'), set(3, 'exA')];
      expect(getEffectiveOrder(sets).map((s) => s.setOrder)).toEqual([1, 2, 3]);
    });

    it('orders superset by rounds: ExA(1,2,3) + ExB(4,5) same group', () => {
      const sets = [
        set(1, 'exA', 'g1'),
        set(2, 'exA', 'g1'),
        set(3, 'exA', 'g1'),
        set(4, 'exB', 'g1'),
        set(5, 'exB', 'g1'),
      ];
      expect(getEffectiveOrder(sets).map((s) => s.setOrder)).toEqual([1, 4, 2, 5, 3]);
    });

    it('handles uneven sets in group: ExA 3 sets, ExB 2 sets', () => {
      const sets = [
        set(1, 'exA', 'g1'),
        set(2, 'exA', 'g1'),
        set(3, 'exA', 'g1'),
        set(4, 'exB', 'g1'),
        set(5, 'exB', 'g1'),
      ];
      const ordered = getEffectiveOrder(sets);
      expect(ordered.map((s) => s.setOrder)).toEqual([1, 4, 2, 5, 3]);
    });

    it('single exercise in group: order by set_order', () => {
      const sets = [set(1, 'exA', 'g1'), set(2, 'exA', 'g1')];
      expect(getEffectiveOrder(sets).map((s) => s.setOrder)).toEqual([1, 2]);
    });

    it('mixed: ungrouped then grouped', () => {
      const sets = [
        set(1, 'exA'), // ungrouped
        set(2, 'exA'), // ungrouped
        set(3, 'exB', 'g1'),
        set(4, 'exB', 'g1'),
        set(5, 'exC', 'g1'),
        set(6, 'exC', 'g1'),
      ];
      const ordered = getEffectiveOrder(sets);
      expect(ordered.map((s) => s.setOrder)).toEqual([1, 2, 3, 5, 4, 6]); // group g1: exB min 3, exC min 5 → round0: 3,5 round1: 4,6
    });
  });

  describe('getFirstUnloggedInEffectiveOrder', () => {
    it('returns null for empty sets', () => {
      expect(getFirstUnloggedInEffectiveOrder([])).toBeNull();
    });

    it('returns first set when all unlogged', () => {
      const sets = [set(2, 'exA'), set(1, 'exB')];
      const first = getFirstUnloggedInEffectiveOrder(sets);
      expect(first?.setOrder).toBe(1); // effective order: 1, 2 → first unlogged is 1
    });

    it('skips completed and skipped sets', () => {
      const sets = [
        set(1, 'exA', undefined, { difficultyLevel: 8 }),
        set(2, 'exA'),
        set(3, 'exA', undefined, { isSkipped: true }),
        set(4, 'exB'),
      ];
      const first = getFirstUnloggedInEffectiveOrder(sets);
      expect(first?.setOrder).toBe(2); // effective order 1,2,3,4; 1 completed, 2 unlogged
    });

    it('returns first unlogged in superset order', () => {
      const sets = [
        set(1, 'exA', 'g1', { difficultyLevel: 8 }),
        set(2, 'exA', 'g1'),
        set(3, 'exA', 'g1'),
        set(4, 'exB', 'g1'),
        set(5, 'exB', 'g1'),
      ];
      // Effective order: 1,4,2,5,3. First unlogged = 4
      const first = getFirstUnloggedInEffectiveOrder(sets);
      expect(first?.setOrder).toBe(4);
    });
  });

  describe('getNextSetInEffectiveOrder', () => {
    it('returns null when no set has given order', () => {
      const sets = [set(1, 'exA'), set(2, 'exA')];
      expect(getNextSetInEffectiveOrder(sets, 99)).toBeNull();
    });

    it('returns null when completed set is last', () => {
      const sets = [set(1, 'exA'), set(2, 'exA')];
      expect(getNextSetInEffectiveOrder(sets, 2)).toBeNull();
    });

    it('returns next unlogged in effective order', () => {
      const sets = [
        set(1, 'exA', 'g1'),
        set(2, 'exA', 'g1'),
        set(3, 'exB', 'g1'),
        set(4, 'exB', 'g1'),
      ];
      // Effective: 1, 3, 2, 4. After 1 → next unlogged is 3
      expect(getNextSetInEffectiveOrder(sets, 1)?.setOrder).toBe(3);
      expect(getNextSetInEffectiveOrder(sets, 3)?.setOrder).toBe(2);
      expect(getNextSetInEffectiveOrder(sets, 2)?.setOrder).toBe(4);
      expect(getNextSetInEffectiveOrder(sets, 4)).toBeNull();
    });
  });

  describe('getRoundIndexWithinGroup', () => {
    it('returns 0 for ungrouped set', () => {
      const sets = [set(1, 'exA')];
      expect(getRoundIndexWithinGroup(sets[0], sets)).toBe(0);
    });

    it('returns set index within exercise in group', () => {
      const sets = [
        set(1, 'exA', 'g1'),
        set(2, 'exA', 'g1'),
        set(3, 'exB', 'g1'),
        set(4, 'exB', 'g1'),
      ];
      expect(getRoundIndexWithinGroup(sets[0], sets)).toBe(0); // exA first set
      expect(getRoundIndexWithinGroup(sets[1], sets)).toBe(1); // exA second set
      expect(getRoundIndexWithinGroup(sets[2], sets)).toBe(0); // exB first set
      expect(getRoundIndexWithinGroup(sets[3], sets)).toBe(1); // exB second set
    });
  });

  describe('isNextInSameSupersetRound', () => {
    it('returns false when nextSet is null', () => {
      const sets = [set(1, 'exA', 'g1'), set(2, 'exB', 'g1')];
      expect(isNextInSameSupersetRound(sets[0], null, sets)).toBe(false);
    });

    it('returns false when sets are in different groups', () => {
      const sets = [set(1, 'exA', 'g1'), set(2, 'exB', 'g2')];
      expect(isNextInSameSupersetRound(sets[0], sets[1], sets)).toBe(false);
    });

    it('returns false when completed set is ungrouped', () => {
      const sets = [set(1, 'exA'), set(2, 'exB')];
      expect(isNextInSameSupersetRound(sets[0], sets[1], sets)).toBe(false);
    });

    it('returns true when next set is same round in superset', () => {
      const sets = [
        set(1, 'exA', 'g1'),
        set(2, 'exA', 'g1'),
        set(3, 'exB', 'g1'),
        set(4, 'exB', 'g1'),
      ];
      // Effective order: 1, 3, 2, 4. Completed 1 (exA set1), next 3 (exB set1) → same round
      expect(isNextInSameSupersetRound(sets[0], sets[2], sets)).toBe(true);
    });

    it('returns false when next set is next round in superset', () => {
      const sets = [
        set(1, 'exA', 'g1'),
        set(2, 'exA', 'g1'),
        set(3, 'exB', 'g1'),
        set(4, 'exB', 'g1'),
      ];
      // Completed 3 (exB set1), next 2 (exA set2) → different round
      expect(isNextInSameSupersetRound(sets[2], sets[1], sets)).toBe(false);
    });
  });
});
