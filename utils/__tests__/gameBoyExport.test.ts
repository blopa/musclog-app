import { validateExportDump } from '@/database/schemaToZod';
import {
  expandGameBoyExportIfNeeded,
  GameBoyExportError,
  gameBoyExportToDatabaseDump,
  parseDatabaseExportJson,
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
          full_name: 'Game Boy Player',
          email: '',
          gender: 'other',
          fitness_goal: 'hypertrophy',
          weight_goal: 'gain',
          activity_level: 4,
          lifting_experience: 'intermediate',
          avatar_icon: 'person',
          avatar_color: 'blue',
        }),
      ],
      nutrition_goals: [
        expect.objectContaining({
          total_calories: 2600,
          protein: 170,
          carbs: 285,
          fats: 80,
          fiber: 32,
          target_weight: 81.4,
        }),
      ],
    });

    expect(dump.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'unit_system', value: '1' }),
        expect.objectContaining({ type: 'include_fiber_in_carbs', value: 'true' }),
      ])
    );

    const user = (dump.users as Record<string, unknown>[])[0];
    expect(user.sync_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    const cartridgeToday = new Date(
      Date.UTC(2000, 0, 1) + compactFixture().profile.todayDay * 86_400_000
    );
    const inferredBirthday = new Date(user.date_of_birth as number);
    expect([
      inferredBirthday.getFullYear(),
      inferredBirthday.getMonth(),
      inferredBirthday.getDate(),
      inferredBirthday.getHours(),
    ]).toEqual([
      cartridgeToday.getUTCFullYear() - compactFixture().profile.age,
      cartridgeToday.getUTCMonth(),
      cartridgeToday.getUTCDate(),
      0,
    ]);

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
    expect((dump.user_metrics as { type: string }[]).some(({ type }) => type === 'body_fat')).toBe(
      false
    );
  });

  it('uses the metric manual-entry convention without inventing optional health data', () => {
    const fixture = compactFixture();
    fixture.profile.units = 0;
    const dump = gameBoyExportToDatabaseDump(parseGameBoyExport(fixture));

    expect(dump.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'unit_system', value: '0' }),
        expect.objectContaining({ type: 'include_fiber_in_carbs', value: 'false' }),
      ])
    );
    expect(dump).not.toHaveProperty('menstrual_cycles');
    expect(dump).not.toHaveProperty('cycle_settings');
    expect((dump.users as Record<string, unknown>[])[0]).not.toHaveProperty('external_account_id');
  });

  it('expands the serialized optical payload at the restore parsing boundary', () => {
    const parsed = parseDatabaseExportJson(JSON.stringify(compactFixture()));
    const validation = validateExportDump(parsed);

    expect(validation.success).toBe(true);
    expect(parsed).toMatchObject({ _exportVersion: 26 });
    const foods = (parsed as { foods: unknown[] }).foods;
    expect(foods[0]).toEqual(expect.objectContaining({ id: 'gb-f-12', name: 'APPLE' }));
    expect(Array.isArray(foods[0])).toBe(false);
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
