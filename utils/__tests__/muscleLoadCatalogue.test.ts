import catalogue from '@/data/exercisesData.json';
import type { MuscleSlug } from '@/utils/muscleGroupMapping';
import {
  computeMuscleLoad,
  countedSetsForSlug,
  muscleLoadSlugIntensity,
  pushPullComparison,
  quadHamstringComparison,
  type MuscleLoadSet,
} from '@/utils/muscleLoad';

/** The same role rule `AppExerciseCatalogueService` writes: secondary only when named as secondary. */
interface CatalogueEntry {
  __freeExerciseDbId: string;
  targetMuscles: string[];
  secondaryMuscles?: string[];
  mechanicType: string;
}

function entry(id: string): CatalogueEntry {
  const found = (catalogue as CatalogueEntry[]).find((item) => item.__freeExerciseDbId === id);
  if (!found) {
    throw new Error(`catalogue entry ${id} is missing`);
  }

  return found;
}

function setFor(
  id: string,
  performedAt: number,
  sessionId: string,
  extra: Partial<MuscleLoadSet> = {}
): MuscleLoadSet {
  const exercise = entry(id);
  const secondary = new Set(exercise.secondaryMuscles ?? []);

  return {
    performedAt,
    sessionId,
    isWorkingSet: true,
    mechanicType: exercise.mechanicType,
    muscles: exercise.targetMuscles.map((name) => ({
      name,
      role: secondary.has(name) ? 'secondary' : 'primary',
    })),
    ...extra,
  };
}

const NOW = Date.UTC(2026, 10, 5, 12);
const DAY = 24 * 60 * 60 * 1000;

/** A push / pull / legs week, each session a few days apart. */
function pushPullLegsWeek(): MuscleLoadSet[] {
  return [
    setFor('Barbell_Bench_Press_-_Medium_Grip', NOW - 1 * DAY, 'push'),
    setFor('Barbell_Bench_Press_-_Medium_Grip', NOW - 1 * DAY, 'push'),
    setFor('Bent_Over_Barbell_Row', NOW - 3 * DAY, 'pull'),
    setFor('Bent_Over_Barbell_Row', NOW - 3 * DAY, 'pull'),
    setFor('Barbell_Squat', NOW - 5 * DAY, 'legs'),
  ];
}

describe('muscle load through the real bundled catalogue', () => {
  it('colours chest and triceps from a bench press, deltoids too', () => {
    const shading = muscleLoadSlugIntensity(
      computeMuscleLoad([setFor('Barbell_Bench_Press_-_Medium_Grip', NOW, 's1')], NOW)
    );

    expect([...shading.keys()].sort()).toEqual<MuscleSlug[]>(['chest', 'deltoids', 'triceps']);
  });

  it('colours upper back from a barbell row', () => {
    const shading = muscleLoadSlugIntensity(
      computeMuscleLoad([setFor('Bent_Over_Barbell_Row', NOW, 's1')], NOW)
    );

    expect(shading.has('upper-back')).toBe(true);
    expect(shading.has('chest')).toBe(false);
  });

  it('colours quadriceps from a squat', () => {
    const shading = muscleLoadSlugIntensity(
      computeMuscleLoad([setFor('Barbell_Squat', NOW, 's1')], NOW)
    );

    expect(shading.has('quadriceps')).toBe(true);
  });

  it('ranks a primary mover above a secondary one in the same set', () => {
    const load = computeMuscleLoad([setFor('Barbell_Bench_Press_-_Medium_Grip', NOW, 's1')], NOW);

    expect(load.get('chest')?.recentLoad ?? 0).toBeGreaterThan(
      load.get('triceps')?.recentLoad ?? 0
    );
    expect(load.get('triceps')?.weeklySets).toBe(0.5);
    expect(load.get('chest')?.weeklySets).toBe(1);
  });

  it('adds nothing for warm-ups, however many there are', () => {
    const working = [setFor('Barbell_Bench_Press_-_Medium_Grip', NOW, 's1')];
    const withWarmups = [
      ...working,
      setFor('Barbell_Bench_Press_-_Medium_Grip', NOW, 's1', { isWorkingSet: false }),
      setFor('Barbell_Bench_Press_-_Medium_Grip', NOW, 's1', { isWorkingSet: false }),
    ];

    expect([...computeMuscleLoad(withWarmups, NOW).entries()]).toEqual([
      ...computeMuscleLoad(working, NOW).entries(),
    ]);
  });

  it('reads a push, pull and legs week into both comparisons', () => {
    const load = computeMuscleLoad(pushPullLegsWeek(), NOW);

    // Push counts chest, triceps and shoulders. The row's secondary shoulder work (0.5 a set)
    // lands on the push side, because shoulders are a push muscle in the comparison.
    expect(pushPullComparison(load)).toEqual({ first: 5, second: 3 });
    expect(quadHamstringComparison(load)).toEqual({ first: 1, second: 0.5 });
  });

  it('lists the sets behind one muscle, newest first', () => {
    const sets = pushPullLegsWeek();

    const chest = countedSetsForSlug(sets, 'chest', NOW);

    expect(chest.map((set) => set.sessionId)).toEqual(['push', 'push']);
    expect(countedSetsForSlug(sets, 'upper-back', NOW).map((set) => set.performedAt)).toEqual([
      NOW - 3 * DAY,
      NOW - 3 * DAY,
    ]);
  });
});
