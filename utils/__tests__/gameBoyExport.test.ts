import { validateExportDump } from '@/database/schemaToZod';
import {
  expandGameBoyExportIfNeeded,
  GameBoyExportError,
  gameBoyExportToDatabaseDump,
  parseGameBoyExport,
} from '@/utils/optical/gameBoyExport';

const compactFixture = () => ({
  _exportVersion: 26,
  _gameBoyExport: 1,
  profile: {
    units: 1,
    gender: 2,
    age: 31,
    heightCm: 181,
    weightKgTenths: 814,
    activity: 4,
    experience: 1,
    focus: 0,
    weightGoal: 2,
    calories: 2600,
    protein: 170,
    carbs: 285,
    fat: 80,
    fiber: 32,
    todayDay: 9700,
  },
  foods: [
    [12, 'APPLE', 52, 3, 2, 138, 24],
    [0x8002, 'CART FOOD', 210, 180, 70, 120, 20],
  ],
  foodLogs: [
    [9699, 12, 150],
    [9700, 0x8002, 80],
  ],
  weights: [[9699, 808]],
  exercises: [
    [3, 'BENCH PRESS', 3, 0, 1, 100],
    [9, 'CABLE FLY', 3, 2, 2, 100],
  ],
  workouts: [
    [
      9698,
      4200,
      [
        [3, 8, 800],
        [3, 7, 800],
        [9, 12, 250],
      ],
    ],
  ],
});

describe('Musclog GB compact database export', () => {
  it('expands into a regular import-valid full database dump', () => {
    const dump = gameBoyExportToDatabaseDump(parseGameBoyExport(compactFixture()));
    const validation = validateExportDump(dump);

    expect(validation.success).toBe(true);
    expect(dump).toMatchObject({
      _exportVersion: 26,
      users: [
        expect.objectContaining({
          gender: 'other',
          fitness_goal: 'hypertrophy',
          weight_goal: 'gain',
          activity_level: 4,
          lifting_experience: 'intermediate',
        }),
      ],
      settings: [expect.objectContaining({ type: 'unit_system', value: '1' })],
      nutrition_goals: [
        expect.objectContaining({
          total_calories: 2600,
          protein: 170,
          carbs: 285,
          fats: 80,
          fiber: 32,
        }),
      ],
    });

    expect(dump.foods).toEqual([
      expect.objectContaining({ id: 'gb-f-12', source: 'gameboy', carbs: 13.8, fiber: 2.4 }),
      expect.objectContaining({ id: 'gb-f-32770', source: 'user' }),
    ]);
    expect(dump.nutrition_logs).toEqual([
      expect.objectContaining({ food_id: 'gb-f-12', amount: 150, logged_carbs: 13.8 }),
      expect.objectContaining({ food_id: 'gb-f-32770', amount: 80 }),
    ]);

    expect(dump.workout_log_exercises).toHaveLength(2);
    expect(dump.workout_log_sets).toEqual([
      expect.objectContaining({ log_exercise_id: 'gb-x-0-0', completion_status: 'performed' }),
      expect.objectContaining({ log_exercise_id: 'gb-x-0-0', completion_status: 'performed' }),
      expect.objectContaining({ log_exercise_id: 'gb-x-0-1', completion_status: 'performed' }),
    ]);

    expect(dump.user_metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'height', value: 181, unit: 'cm' }),
        expect.objectContaining({ id: 'gb-m-0', type: 'weight', value: 80.8 }),
        expect.objectContaining({ id: 'gb-m-current', type: 'weight', value: 81.4 }),
      ])
    );
  });

  it('rejects dangling references and duplicate catalogue indexes before restore', () => {
    const missingFood = compactFixture();
    missingFood.foodLogs[0] = [9699, 99, 150];
    expect(() => parseGameBoyExport(missingFood)).toThrow(
      new GameBoyExportError('malformed', 'Food log references missing food 99')
    );

    const duplicateExercise = compactFixture();
    duplicateExercise.exercises[1][0] = 3;
    expect(() => parseGameBoyExport(duplicateExercise)).toThrow(
      new GameBoyExportError('malformed', 'Duplicate exercise index 3')
    );
  });

  it('rejects unknown cartridge schema versions and leaves ordinary backups untouched', () => {
    expect(() => parseGameBoyExport({ ...compactFixture(), _gameBoyExport: 2 })).toThrow(
      expect.objectContaining({ code: 'unsupported-version' })
    );

    const ordinary = { _exportVersion: 26, foods: [] };
    expect(expandGameBoyExportIfNeeded(ordinary)).toBe(ordinary);
  });
});
