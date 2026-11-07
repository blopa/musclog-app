import exercisesData from '@/data/exercisesData.json';
import { isStrengthGraded, STRENGTH_GRADED_EXERCISE_IDS } from '@/utils/strengthGradedLifts';

type CatalogueRow = { __freeExerciseDbId: string; loadMultiplier: number; equipmentType: string };

const catalogue = exercisesData as CatalogueRow[];

describe('strengthGradedLifts', () => {
  it('grades fifteen lifts', () => {
    expect(STRENGTH_GRADED_EXERCISE_IDS.size).toBe(15);
  });

  it('points every graded id at a catalogue row with a positive loadMultiplier', () => {
    const byId = new Map(catalogue.map((row) => [`fx-${row.__freeExerciseDbId}`, row]));
    for (const id of STRENGTH_GRADED_EXERCISE_IDS) {
      const row = byId.get(id);
      expect({ id, found: row !== undefined }).toEqual({ id, found: true });
      expect({ id, loadMultiplier: row?.loadMultiplier ?? 0 }).toEqual({
        id,
        loadMultiplier: expect.any(Number),
      });
      expect(row!.loadMultiplier).toBeGreaterThan(0);
    }
  });

  it('keeps barbell and dumbbell lifts on their own equipment', () => {
    const byId = new Map(catalogue.map((row) => [`fx-${row.__freeExerciseDbId}`, row]));
    for (const id of STRENGTH_GRADED_EXERCISE_IDS) {
      const equipment = byId.get(id)?.equipmentType;
      expect(['barbell', 'dumbbell']).toContain(equipment);
    }
  });

  it('answers membership by id', () => {
    expect(isStrengthGraded('fx-Barbell_Squat')).toBe(true);
    expect(isStrengthGraded('fx-Dumbbell_Bicep_Curl')).toBe(true);
    expect(isStrengthGraded('fx-Plank')).toBe(false);
    expect(isStrengthGraded('')).toBe(false);
    expect(isStrengthGraded(null)).toBe(false);
    expect(isStrengthGraded(undefined)).toBe(false);
  });
});
