import {
  excludedExerciseIds,
  isDisliked,
  activeRestrictionFor,
  exerciseExclusionReason,
  injuryExpiryOptionFor,
  injuryExpiryTimestamp,
  isExerciseSuggestible,
  isSubstitutionReason,
  rankSubstitutes,
  restrictionKindForReason,
  SESSION_ONLY_REASONS,
  SUBSTITUTION_REASONS,
  type SubstitutionContext,
  type SubstitutionExercise,
} from '../exerciseSubstitution';

const ex = (
  id: string,
  muscleGroup: SubstitutionExercise['muscleGroup'],
  equipmentType: SubstitutionExercise['equipmentType'],
  mechanicType: SubstitutionExercise['mechanicType'] = 'compound'
): SubstitutionExercise => ({ id, name: id, muscleGroup, equipmentType, mechanicType });

const bench = ex('Bench Press', 'chest', 'barbell');
const dbBench = ex('Dumbbell Bench', 'chest', 'dumbbell');
const machinePress = ex('Machine Press', 'chest', 'plate_machine');
const cableFly = ex('Cable Fly', 'chest', 'cable', 'isolation');
const pushUp = ex('Push-Up', 'chest', 'bodyweight');
const squat = ex('Squat', 'legs', 'barbell');
const shoulderPress = ex('Shoulder Press', 'shoulders', 'dumbbell');

const NOW = 1_000_000;
const ctx = (overrides: Partial<SubstitutionContext> = {}): SubstitutionContext => ({
  restrictions: [],
  gym: null,
  now: NOW,
  ...overrides,
});
const ids = (ranked: { exercise: { id: string } }[]) => ranked.map((r) => r.exercise.id);

describe('activeRestrictionFor', () => {
  it('ignores an expired restriction and keeps one with no expiry', () => {
    const restrictions = [
      { exerciseId: 'a', kind: 'injury' as const, expiresAt: NOW - 1 },
      { exerciseId: 'b', kind: 'injury' as const, expiresAt: NOW + 1 },
      { exerciseId: 'c', kind: 'never' as const, expiresAt: null },
    ];
    expect(activeRestrictionFor('a', restrictions, NOW)).toBeUndefined();
    expect(activeRestrictionFor('b', restrictions, NOW)?.kind).toBe('injury');
    expect(activeRestrictionFor('c', restrictions, NOW)?.kind).toBe('never');
  });

  it('lets the strictest restriction win', () => {
    const restrictions = [
      { exerciseId: 'a', kind: 'dislike' as const },
      { exerciseId: 'a', kind: 'injury' as const },
      { exerciseId: 'a', kind: 'never' as const },
    ];
    expect(activeRestrictionFor('a', restrictions, NOW)?.kind).toBe('never');
  });
});

describe('exerciseExclusionReason', () => {
  it('excludes never and active injury', () => {
    const restrictions = [
      { exerciseId: 'n', kind: 'never' as const },
      { exerciseId: 'i', kind: 'injury' as const, expiresAt: NOW + 5 },
    ];
    expect(
      exerciseExclusionReason({ id: 'n', equipmentType: 'barbell' }, ctx({ restrictions }))
    ).toBe('never');
    expect(
      exerciseExclusionReason({ id: 'i', equipmentType: 'barbell' }, ctx({ restrictions }))
    ).toBe('injury');
  });

  it('lets a healed injury back in', () => {
    const restrictions = [{ exerciseId: 'i', kind: 'injury' as const, expiresAt: NOW - 5 }];
    expect(
      isExerciseSuggestible({ id: 'i', equipmentType: 'barbell' }, ctx({ restrictions }))
    ).toBe(true);
  });

  it('excludes equipment the gym lacks, but never bodyweight', () => {
    const gym = { equipment: ['barbell' as const] };
    expect(exerciseExclusionReason({ id: 'x', equipmentType: 'cable' }, ctx({ gym }))).toBe(
      'equipment'
    );
    expect(
      exerciseExclusionReason({ id: 'x', equipmentType: 'bodyweight' }, ctx({ gym }))
    ).toBeNull();
  });

  it('ranks an injury above missing equipment', () => {
    const restrictions = [{ exerciseId: 'x', kind: 'injury' as const }];
    const gym = { equipment: [] };
    expect(
      exerciseExclusionReason({ id: 'x', equipmentType: 'cable' }, ctx({ restrictions, gym }))
    ).toBe('injury');
  });

  it('does NOT exclude a disliked exercise', () => {
    const restrictions = [{ exerciseId: 'd', kind: 'dislike' as const }];
    expect(
      isExerciseSuggestible({ id: 'd', equipmentType: 'barbell' }, ctx({ restrictions }))
    ).toBe(true);
  });
});

describe('rankSubstitutes', () => {
  const pool = [dbBench, machinePress, cableFly, pushUp, squat, shoulderPress, bench];

  it('never offers the exercise being replaced', () => {
    expect(ids(rankSubstitutes(bench, pool, ctx()))).not.toContain('Bench Press');
  });

  it('prefers the same body region, then the same mechanic and equipment', () => {
    const ranked = rankSubstitutes(bench, pool, ctx());
    // Chest compounds first; the leg exercise last; shoulders share the torso family with chest.
    expect(ids(ranked).indexOf('Squat')).toBe(ranked.length - 1);
    expect(ranked.find((r) => r.exercise.id === 'Squat')?.sameFamily).toBe(false);
    expect(ranked.find((r) => r.exercise.id === 'Shoulder Press')?.sameFamily).toBe(true);
    expect(ids(ranked)[0]).toBe('Dumbbell Bench'); // same group + mechanic, dumbbell vs. barbell
    expect(ids(ranked).indexOf('Cable Fly')).toBeGreaterThan(ids(ranked).indexOf('Machine Press'));
  });

  it('drops equipment the gym does not have', () => {
    const gym = { equipment: ['barbell' as const, 'dumbbell' as const] };
    expect(ids(rankSubstitutes(bench, pool, ctx({ gym })))).toEqual(
      expect.not.arrayContaining(['Machine Press', 'Cable Fly'])
    );
    expect(ids(rankSubstitutes(bench, pool, ctx({ gym })))).toContain('Push-Up');
  });

  it('drops never and active-injury exercises entirely', () => {
    const restrictions = [
      { exerciseId: 'Dumbbell Bench', kind: 'never' as const },
      { exerciseId: 'Push-Up', kind: 'injury' as const },
    ];
    const ranked = ids(rankSubstitutes(bench, pool, ctx({ restrictions })));
    expect(ranked).not.toContain('Dumbbell Bench');
    expect(ranked).not.toContain('Push-Up');
  });

  it('demotes a disliked exercise and flags it instead of removing it', () => {
    const restrictions = [{ exerciseId: 'Dumbbell Bench', kind: 'dislike' as const }];
    const ranked = rankSubstitutes(bench, pool, ctx({ restrictions }));
    const disliked = ranked.find((r) => r.exercise.id === 'Dumbbell Bench');

    expect(disliked?.disliked).toBe(true);
    expect(ids(ranked)[0]).not.toBe('Dumbbell Bench');
    expect(ranked.filter((r) => r.disliked)).toHaveLength(1);
  });

  it('gives a recently used exercise a small edge', () => {
    const a = ex('A Curl', 'biceps', 'dumbbell');
    const b = ex('B Curl', 'biceps', 'dumbbell');
    const ranked = rankSubstitutes(
      ex('Hammer Curl', 'biceps', 'dumbbell'),
      [a, b],
      ctx({ recentExerciseIds: new Set(['B Curl']) })
    );
    expect(ids(ranked)).toEqual(['B Curl', 'A Curl']);
  });

  it('is stable for equal scores', () => {
    const ranked = rankSubstitutes(
      bench,
      [ex('Zeta', 'chest', 'barbell'), ex('Alpha', 'chest', 'barbell')],
      ctx()
    );
    expect(ids(ranked)).toEqual(['Alpha', 'Zeta']);
  });

  it('understands both muscle-group vocabularies', () => {
    // 'quads' (legacy, fine-grained) and 'legs' (catalogue, coarse) are the same region.
    const ranked = rankSubstitutes(ex('Leg Extension', 'quads', 'plate_machine'), [squat], ctx());
    expect(ranked[0].sameFamily).toBe(true);
  });
});

describe('injury expiry', () => {
  const DAY = 86_400_000;

  it('turns each option into an end date, with "open" meaning none', () => {
    expect(injuryExpiryTimestamp('2w', NOW)).toBe(NOW + 14 * DAY);
    expect(injuryExpiryTimestamp('4w', NOW)).toBe(NOW + 28 * DAY);
    expect(injuryExpiryTimestamp('12w', NOW)).toBe(NOW + 84 * DAY);
    expect(injuryExpiryTimestamp('open', NOW)).toBeNull();
  });

  it('maps a stored expiry back to the closest option', () => {
    expect(injuryExpiryOptionFor(null, NOW)).toBe('open');
    expect(injuryExpiryOptionFor(undefined, NOW)).toBe('open');
    expect(injuryExpiryOptionFor(NOW + 13 * DAY, NOW)).toBe('2w');
    expect(injuryExpiryOptionFor(NOW + 28 * DAY, NOW)).toBe('4w');
    expect(injuryExpiryOptionFor(NOW + 80 * DAY, NOW)).toBe('12w');
  });

  it('round-trips every option', () => {
    for (const option of ['2w', '4w', '12w', 'open'] as const) {
      expect(injuryExpiryOptionFor(injuryExpiryTimestamp(option, NOW), NOW)).toBe(option);
    }
  });
});

describe('substitution reasons', () => {
  it('recognises exactly the declared reasons', () => {
    for (const reason of SUBSTITUTION_REASONS) {
      expect(isSubstitutionReason(reason)).toBe(true);
    }
    expect(isSubstitutionReason('whatever')).toBe(false);
    expect(isSubstitutionReason(undefined)).toBe(false);
  });

  it('treats "just today" and "machine occupied" as session-only: nothing is remembered', () => {
    expect(SESSION_ONLY_REASONS).toEqual(['just_today', 'machine_occupied']);
    expect(restrictionKindForReason('just_today')).toBeNull();
    expect(restrictionKindForReason('machine_occupied')).toBeNull();
  });

  it('offers an injury for pain and a dislike for dislike, and nothing for the rest', () => {
    expect(restrictionKindForReason('pain')).toBe('injury');
    expect(restrictionKindForReason('dislike')).toBe('dislike');
    expect(restrictionKindForReason('too_hard')).toBeNull();
    expect(restrictionKindForReason('too_easy')).toBeNull();
    expect(restrictionKindForReason('equipment_unavailable')).toBeNull();
  });
});

describe('excludedExerciseIds / isDisliked', () => {
  const now = 1_000;
  const restrictions = [
    { exerciseId: 'bench', kind: 'never' as const },
    { exerciseId: 'squat', kind: 'injury' as const, expiresAt: now + 10 },
    { exerciseId: 'healed', kind: 'injury' as const, expiresAt: now - 10 },
    { exerciseId: 'fly', kind: 'dislike' as const },
    // A stricter restriction on the same exercise wins over a dislike.
    { exerciseId: 'dips', kind: 'dislike' as const },
    { exerciseId: 'dips', kind: 'never' as const },
  ];

  it('excludes never and active injuries, not healed injuries or dislikes', () =>
    expect(excludedExerciseIds(restrictions, now).sort()).toEqual(['bench', 'dips', 'squat']));

  it('flags only the exercises whose strictest restriction is a dislike', () => {
    expect(isDisliked('fly', restrictions, now)).toBe(true);
    expect(isDisliked('dips', restrictions, now)).toBe(false);
    expect(isDisliked('healed', restrictions, now)).toBe(false);
  });
});
