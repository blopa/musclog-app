import { Dumbbell, User } from 'lucide-react-native';

import type { SelectorOption } from '../../components/theme/OptionsMultiSelector/utils';
import Exercise from '../../database/models/Exercise';
import Schedule, { type DayOfWeek } from '../../database/models/Schedule';
import type { ExerciseInWorkout } from '../../database/services/WorkoutTemplateService';
import { darkTheme as theme } from '../../theme';
import {
  createExerciseOption,
  type CreateExerciseOptionParams,
  dayNameToIndex,
  type ExerciseMetadata,
  exercisesToWorkoutFormat,
  extractExerciseMetadata,
  formatExerciseDescription,
  getExerciseIconConfig,
  getWeekdayLabels,
  indexToDayName,
  isBodyweightExercise,
  transformExercisesToOptions,
  transformScheduleDays,
  updateMetadataWithGroupIds,
  validateWorkoutTitle,
  WEEKDAY_NAMES,
} from '../workout';

// Mock Exercise model
const createMockExercise = (overrides: Partial<Exercise> = {}): Partial<Exercise> => ({
  id: 'ex-1',
  name: 'Push Up',
  equipmentType: 'bodyweight',
  ...overrides,
});

// Mock Schedule model
const createMockSchedule = (dayOfWeek: string): Partial<Schedule> => ({
  dayOfWeek: dayOfWeek as DayOfWeek,
});

// Mock ExerciseInWorkout
const createMockExerciseInWorkout = (
  overrides: Partial<ExerciseInWorkout> = {}
): ExerciseInWorkout => ({
  id: 'ex-1',
  label: 'Push Up',
  description: '3 sets × 10 reps',
  icon: User,
  iconBgColor: theme.colors.background.white5,
  iconColor: theme.colors.text.secondary,
  groupId: 'group-1',
  sets: 3,
  reps: 10,
  weight: 0,
  isBodyweight: true,
  ...overrides,
});

// Mock SelectorOption
const createMockSelectorOption = (
  overrides: Partial<SelectorOption<string>> = {}
): SelectorOption<string> => ({
  id: 'ex-1',
  label: 'Push Up',
  description: '3 sets × 10 reps',
  icon: User,
  iconBgColor: theme.colors.background.white5,
  iconColor: theme.colors.text.secondary,
  groupId: 'group-1',
  ...overrides,
});

jest.mock('lucide-react-native', () => ({
  User: jest.fn(() => 'User'),
  Dumbbell: jest.fn(() => 'Dumbbell'),
}));

describe('utils/workout', () => {
  describe('Day Mapping Utilities', () => {
    describe('getWeekdayLabels', () => {
      it('should return 7 elements', () => {
        expect(getWeekdayLabels()).toHaveLength(7);
      });

      it('should return correct values for the default en-US locale', () => {
        expect(getWeekdayLabels()).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
      });
    });

    describe('WEEKDAY_NAMES', () => {
      it('should have 7 elements', () => {
        expect(WEEKDAY_NAMES).toHaveLength(7);
      });

      it('should have correct day names', () => {
        expect(WEEKDAY_NAMES).toEqual([
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ]);
      });
    });

    describe('dayNameToIndex', () => {
      it('should return correct index for valid day names', () => {
        expect(dayNameToIndex('Monday')).toBe(0);
        expect(dayNameToIndex('Tuesday')).toBe(1);
        expect(dayNameToIndex('Wednesday')).toBe(2);
        expect(dayNameToIndex('Thursday')).toBe(3);
        expect(dayNameToIndex('Friday')).toBe(4);
        expect(dayNameToIndex('Saturday')).toBe(5);
        expect(dayNameToIndex('Sunday')).toBe(6);
      });

      it('should be case-sensitive', () => {
        expect(dayNameToIndex('monday')).toBe(-1);
        expect(dayNameToIndex('MONDAY')).toBe(-1);
        expect(dayNameToIndex('Monday')).toBe(0);
      });

      it('should return -1 for invalid day name', () => {
        expect(dayNameToIndex('InvalidDay')).toBe(-1);
      });

      it('should return -1 for empty string', () => {
        expect(dayNameToIndex('')).toBe(-1);
      });

      it('should return -1 for partial match', () => {
        expect(dayNameToIndex('Mon')).toBe(-1);
      });
    });

    describe('indexToDayName', () => {
      it('should return correct day name for valid indices', () => {
        expect(indexToDayName(0)).toBe('Monday');
        expect(indexToDayName(1)).toBe('Tuesday');
        expect(indexToDayName(2)).toBe('Wednesday');
        expect(indexToDayName(3)).toBe('Thursday');
        expect(indexToDayName(4)).toBe('Friday');
        expect(indexToDayName(5)).toBe('Saturday');
        expect(indexToDayName(6)).toBe('Sunday');
      });

      it('should return Monday for boundary index 0', () => {
        expect(indexToDayName(0)).toBe('Monday');
      });

      it('should return Sunday for boundary index 6', () => {
        expect(indexToDayName(6)).toBe('Sunday');
      });

      it('should return Monday (fallback) for negative index', () => {
        expect(indexToDayName(-1)).toBe('Monday');
        expect(indexToDayName(-10)).toBe('Monday');
      });

      it('should return Monday (fallback) for index too large', () => {
        expect(indexToDayName(7)).toBe('Monday');
        expect(indexToDayName(10)).toBe('Monday');
        expect(indexToDayName(100)).toBe('Monday');
      });

      it('should handle -0', () => {
        expect(indexToDayName(-0)).toBe('Monday');
      });

      it('should handle decimal indices', () => {
        expect(indexToDayName(0.5)).toBe('Monday');
        expect(indexToDayName(1.9)).toBe('Monday');
      });
    });
  });

  describe('Exercise UI Helpers', () => {
    describe('isBodyweightExercise', () => {
      it('should return true for bodyweight variations', () => {
        expect(isBodyweightExercise('bodyweight')).toBe(true);
        expect(isBodyweightExercise('Bodyweight')).toBe(true);
        expect(isBodyweightExercise('BODYWEIGHT')).toBe(true);
        expect(isBodyweightExercise('BoDyWeIgHt')).toBe(true);
      });

      it('should return true for two-word variations', () => {
        expect(isBodyweightExercise('body weight')).toBe(true);
        expect(isBodyweightExercise('Body Weight')).toBe(true);
        expect(isBodyweightExercise('BODY WEIGHT')).toBe(true);
      });

      it('should return true when bodyweight appears in context', () => {
        expect(isBodyweightExercise('Bodyweight Exercise')).toBe(true);
        expect(isBodyweightExercise('Some bodyweight equipment')).toBe(true);
      });

      it('should return false for non-bodyweight equipment', () => {
        expect(isBodyweightExercise('dumbbell')).toBe(false);
        expect(isBodyweightExercise('barbell')).toBe(false);
        expect(isBodyweightExercise('machine')).toBe(false);
        expect(isBodyweightExercise('cable')).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isBodyweightExercise(undefined)).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isBodyweightExercise('')).toBe(false);
      });
    });

    describe('getExerciseIconConfig', () => {
      it('should return User icon and correct colors for bodyweight exercises', () => {
        const config = getExerciseIconConfig(theme, true);
        expect(config.icon).toBe(User);
        expect(config.iconBgColor).toBe(theme.colors.background.white5);
        expect(config.iconColor).toBe(theme.colors.text.secondary);
      });

      it('should return Dumbbell icon and correct colors for non-bodyweight exercises', () => {
        const config = getExerciseIconConfig(theme, false);
        expect(config.icon).toBe(Dumbbell);
        expect(config.iconBgColor).toBe(theme.colors.accent.primary10);
        expect(config.iconColor).toBe(theme.colors.accent.primary);
      });

      it('should return correct icon types', () => {
        const bodyweightConfig = getExerciseIconConfig(theme, true);
        const nonBodyweightConfig = getExerciseIconConfig(theme, false);
        expect(bodyweightConfig.icon).toBe(User);
        expect(nonBodyweightConfig.icon).toBe(Dumbbell);
      });
    });

    describe('formatExerciseDescription', () => {
      it('should format normal values correctly', () => {
        expect(formatExerciseDescription(3, 10)).toBe('3 sets × 10 reps');
        expect(formatExerciseDescription(5, 20)).toBe('5 sets × 20 reps');
      });

      it('should format single values correctly', () => {
        expect(formatExerciseDescription(1, 1)).toBe('1 sets × 1 reps');
      });

      it('should format zero values correctly', () => {
        expect(formatExerciseDescription(0, 0)).toBe('0 sets × 0 reps');
      });

      it('should format decimal values correctly', () => {
        expect(formatExerciseDescription(3.5, 10.5)).toBe('3.5 sets × 10.5 reps');
      });

      it('should include weight for non-bodyweight exercises', () => {
        expect(formatExerciseDescription(3, 10, 60, false, 'metric', 'en-US')).toBe(
          '3 sets × 10 reps @ 60kg'
        );
        expect(formatExerciseDescription(4, 8, 22.5, false, 'metric', 'en-US')).toBe(
          '4 sets × 8 reps @ 22.5kg'
        );
      });

      it('should not include weight for bodyweight exercises', () => {
        expect(formatExerciseDescription(3, 10, 60, true)).toBe('3 sets × 10 reps');
        expect(formatExerciseDescription(4, 8, 0, false)).toBe('4 sets × 8 reps');
      });

      it('should not include weight when weight is undefined', () => {
        expect(formatExerciseDescription(3, 10, undefined, false)).toBe('3 sets × 10 reps');
      });
    });
  });

  describe('Exercise Option Creation', () => {
    describe('createExerciseOption', () => {
      it('should create option for bodyweight exercise with equipmentType', () => {
        const exercise = createMockExercise({ equipmentType: 'bodyweight' }) as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: false,
        };

        const result = createExerciseOption(theme, params);
        expect(result.icon).toBe(User);
        expect(result.id).toBe('ex-1');
        expect(result.label).toBe('Push Up');
        expect(result.description).toBe('3 sets × 10 reps');
      });

      it('should create option for bodyweight exercise with isBodyweight flag', () => {
        const exercise = createMockExercise({ equipmentType: 'dumbbell' }) as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: true,
        };

        const result = createExerciseOption(theme, params);
        expect(result.icon).toBe(User);
      });

      it('should create option for non-bodyweight exercise', () => {
        const exercise = createMockExercise({ equipmentType: 'dumbbell' }) as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 3,
          reps: 10,
          weight: 60,
          isBodyweight: false,
          units: 'metric',
        };

        const result = createExerciseOption(theme, params);
        expect(result.icon).toBe(Dumbbell);
        expect(result.iconBgColor).toBe(theme.colors.accent.primary10);
        expect(result.iconColor).toBe(theme.colors.accent.primary);
        expect(result.description).toBe('3 sets × 10 reps @');
        expect(result.trailingHighlight).toBe('60kg');
      });

      it('should include groupId when provided', () => {
        const exercise = createMockExercise() as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: true,
          groupId: 'group-1',
        };

        const result = createExerciseOption(theme, params);
        expect(result.groupId).toBe('group-1');
      });

      it('should include undefined groupId when not provided', () => {
        const exercise = createMockExercise() as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: true,
        };

        const result = createExerciseOption(theme, params);
        expect(result.groupId).toBeUndefined();
      });

      it('should include all required fields', () => {
        const exercise = createMockExercise({
          name: 'Bench Press',
          equipmentType: 'barbell',
        }) as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 5,
          reps: 8,
          weight: 100,
          isBodyweight: false,
          groupId: 'group-2',
        };

        const result = createExerciseOption(theme, params);
        expect(result).toMatchObject({
          id: 'ex-1',
          label: 'Bench Press',
          description: '5 sets × 8 reps',
          icon: Dumbbell,
          iconBgColor: theme.colors.accent.primary10,
          iconColor: theme.colors.accent.primary,
          groupId: 'group-2',
        });
      });

      it('should handle empty exercise name', () => {
        const exercise = createMockExercise({ name: '' }) as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: true,
        };

        const result = createExerciseOption(theme, params);
        expect(result.label).toBe('');
      });

      it('should handle special characters in exercise name', () => {
        const exercise = createMockExercise({ name: "O'Brien Press" }) as Exercise;
        const params: CreateExerciseOptionParams = {
          exercise,
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: false,
        };

        const result = createExerciseOption(theme, params);
        expect(result.label).toBe("O'Brien Press");
      });
    });
  });

  describe('Exercise Metadata Management', () => {
    describe('extractExerciseMetadata', () => {
      it('should extract all metadata fields', () => {
        const exercise = createMockExerciseInWorkout({
          sets: 4,
          reps: 12,
          weight: 50,
          isBodyweight: false,
          groupId: 'group-123',
        });

        const result = extractExerciseMetadata(exercise);
        expect(result).toEqual({
          sets: 4,
          reps: 12,
          weight: 50,
          isBodyweight: false,
          groupId: 'group-123',
        });
      });

      it('should handle undefined groupId', () => {
        const exercise = createMockExerciseInWorkout({ groupId: undefined });
        const result = extractExerciseMetadata(exercise);
        expect(result.groupId).toBeUndefined();
      });

      it('should exclude UI fields', () => {
        const exercise = createMockExerciseInWorkout();
        const result = extractExerciseMetadata(exercise);
        expect(result).not.toHaveProperty('id');
        expect(result).not.toHaveProperty('label');
        expect(result).not.toHaveProperty('description');
        expect(result).not.toHaveProperty('icon');
        expect(result).not.toHaveProperty('iconBgColor');
        expect(result).not.toHaveProperty('iconColor');
      });

      it('should extract zero values correctly', () => {
        const exercise = createMockExerciseInWorkout({
          sets: 0,
          reps: 0,
          weight: 0,
        });
        const result = extractExerciseMetadata(exercise);
        expect(result.sets).toBe(0);
        expect(result.reps).toBe(0);
        expect(result.weight).toBe(0);
      });
    });

    describe('updateMetadataWithGroupIds', () => {
      it('should update existing metadata with new groupId', () => {
        const currentMetadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 3,
              reps: 10,
              weight: 50,
              isBodyweight: false,
              groupId: 'group-1',
            },
          ],
        ]);

        const reorderedExercises = [createMockSelectorOption({ id: 'ex-1', groupId: 'group-2' })];

        const result = updateMetadataWithGroupIds(currentMetadata, reorderedExercises);
        expect(result.get('ex-1')).toEqual({
          sets: 3,
          reps: 10,
          weight: 50,
          isBodyweight: false,
          groupId: 'group-2',
        });
      });

      it('should create new metadata for exercise without existing metadata', () => {
        const currentMetadata = new Map<string, ExerciseMetadata>();
        const reorderedExercises = [createMockSelectorOption({ id: 'ex-1', groupId: 'group-1' })];

        const result = updateMetadataWithGroupIds(currentMetadata, reorderedExercises);
        expect(result.get('ex-1')).toEqual({
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: false,
          restTimeAfter: 60,
          groupId: 'group-1',
          isDropSet: false,
        });
      });

      it('should handle multiple exercises', () => {
        const currentMetadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 3,
              reps: 10,
              weight: 50,
              isBodyweight: false,
              groupId: 'group-1',
            },
          ],
        ]);

        const reorderedExercises = [
          createMockSelectorOption({ id: 'ex-1', groupId: 'group-2' }),
          createMockSelectorOption({ id: 'ex-2', groupId: 'group-2' }),
        ];

        const result = updateMetadataWithGroupIds(currentMetadata, reorderedExercises);
        expect(result.get('ex-1')?.groupId).toBe('group-2');
        expect(result.get('ex-2')?.groupId).toBe('group-2');
        expect(result.get('ex-2')?.sets).toBe(3); // Default values
      });

      it('should handle empty map', () => {
        const currentMetadata = new Map<string, ExerciseMetadata>();
        const reorderedExercises = [
          createMockSelectorOption({ id: 'ex-1', groupId: 'group-1' }),
          createMockSelectorOption({ id: 'ex-2', groupId: undefined }),
        ];

        const result = updateMetadataWithGroupIds(currentMetadata, reorderedExercises);
        expect(result.size).toBe(2);
        expect(result.get('ex-1')?.groupId).toBe('group-1');
        expect(result.get('ex-2')?.groupId).toBeUndefined();
      });

      it('should remove groupId when set to undefined', () => {
        const currentMetadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 3,
              reps: 10,
              weight: 50,
              isBodyweight: false,
              groupId: 'group-1',
            },
          ],
        ]);

        const reorderedExercises = [createMockSelectorOption({ id: 'ex-1', groupId: undefined })];

        const result = updateMetadataWithGroupIds(currentMetadata, reorderedExercises);
        expect(result.get('ex-1')?.groupId).toBeUndefined();
        expect(result.get('ex-1')?.sets).toBe(3); // Other fields preserved
      });

      it('should preserve non-groupId fields when updating', () => {
        const currentMetadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 5,
              reps: 8,
              weight: 100,
              isBodyweight: true,
              groupId: 'group-1',
            },
          ],
        ]);

        const reorderedExercises = [createMockSelectorOption({ id: 'ex-1', groupId: 'group-2' })];

        const result = updateMetadataWithGroupIds(currentMetadata, reorderedExercises);
        const metadata = result.get('ex-1');
        expect(metadata?.sets).toBe(5);
        expect(metadata?.reps).toBe(8);
        expect(metadata?.weight).toBe(100);
        expect(metadata?.isBodyweight).toBe(true);
        expect(metadata?.groupId).toBe('group-2');
      });
    });

    describe('exercisesToWorkoutFormat', () => {
      it('should convert exercises with complete metadata', () => {
        const exercises = [createMockSelectorOption({ id: 'ex-1' })];
        const metadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 4,
              reps: 12,
              weight: 50,
              isBodyweight: false,
              groupId: 'group-1',
            },
          ],
        ]);

        const result = exercisesToWorkoutFormat(exercises, metadata);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'ex-1',
          label: 'Push Up',
          description: '3 sets × 10 reps',
          sets: 4,
          reps: 12,
          weight: 50,
          isBodyweight: false,
          groupId: 'group-1',
        });
      });

      it('should use defaults for missing metadata', () => {
        const exercises = [createMockSelectorOption({ id: 'ex-1' })];
        const metadata = new Map<string, ExerciseMetadata>();

        const result = exercisesToWorkoutFormat(exercises, metadata);
        expect(result[0]).toMatchObject({
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: false,
          groupId: 'group-1',
        });
      });

      it('should use SelectorOption groupId when both exist', () => {
        const exercises = [createMockSelectorOption({ id: 'ex-1', groupId: 'group-option' })];
        const metadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 3,
              reps: 10,
              weight: 0,
              isBodyweight: false,
              groupId: 'group-metadata',
            },
          ],
        ]);

        const result = exercisesToWorkoutFormat(exercises, metadata);
        expect(result[0].groupId).toBe('group-option');
      });

      it('should use metadata groupId when SelectorOption groupId is undefined', () => {
        const exercises = [createMockSelectorOption({ id: 'ex-1', groupId: undefined })];
        const metadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 3,
              reps: 10,
              weight: 0,
              isBodyweight: false,
              groupId: 'group-metadata',
            },
          ],
        ]);

        const result = exercisesToWorkoutFormat(exercises, metadata);
        expect(result[0].groupId).toBe('group-metadata');
      });

      it('should return empty array for empty exercises', () => {
        const exercises: SelectorOption<string>[] = [];
        const metadata = new Map<string, ExerciseMetadata>();

        const result = exercisesToWorkoutFormat(exercises, metadata);
        expect(result).toEqual([]);
      });

      it('should handle multiple exercises with varying metadata', () => {
        const exercises = [
          createMockSelectorOption({ id: 'ex-1' }),
          createMockSelectorOption({ id: 'ex-2' }),
          createMockSelectorOption({ id: 'ex-3' }),
        ];
        const metadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 3,
              reps: 10,
              weight: 0,
              isBodyweight: true,
              groupId: 'group-1',
            },
          ],
          [
            'ex-2',
            {
              sets: 5,
              reps: 8,
              weight: 100,
              isBodyweight: false,
              groupId: undefined,
            },
          ],
        ]);

        const result = exercisesToWorkoutFormat(exercises, metadata);
        expect(result).toHaveLength(3);
        expect(result[0].sets).toBe(3);
        expect(result[1].sets).toBe(5);
        expect(result[2].sets).toBe(3); // Default
      });

      it('should include all ExerciseInWorkout fields', () => {
        const exercises = [createMockSelectorOption({ id: 'ex-1' })];
        const metadata = new Map<string, ExerciseMetadata>([
          [
            'ex-1',
            {
              sets: 3,
              reps: 10,
              weight: 0,
              isBodyweight: true,
              groupId: 'group-1',
            },
          ],
        ]);

        const result = exercisesToWorkoutFormat(exercises, metadata);
        const exercise = result[0];
        expect(exercise).toHaveProperty('id');
        expect(exercise).toHaveProperty('label');
        expect(exercise).toHaveProperty('description');
        expect(exercise).toHaveProperty('icon');
        expect(exercise).toHaveProperty('iconBgColor');
        expect(exercise).toHaveProperty('iconColor');
        expect(exercise).toHaveProperty('groupId');
        expect(exercise).toHaveProperty('sets');
        expect(exercise).toHaveProperty('reps');
        expect(exercise).toHaveProperty('weight');
        expect(exercise).toHaveProperty('isBodyweight');
      });
    });
  });

  describe('Template Data Transformation', () => {
    describe('transformExercisesToOptions', () => {
      it('should transform all fields correctly', () => {
        const exercisesInWorkout: ExerciseInWorkout[] = [
          createMockExerciseInWorkout({
            id: 'ex-1',
            label: 'Bench Press',
            description: '4 sets × 8 reps',
            sets: 4,
            reps: 8,
            groupId: 'group-1',
          }),
        ];

        const result = transformExercisesToOptions(exercisesInWorkout, 'metric');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'ex-1',
          label: 'Bench Press',
          description: '4 sets × 8 reps',
          icon: User,
          iconBgColor: theme.colors.background.white5,
          iconColor: theme.colors.text.secondary,
          groupId: 'group-1',
        });
      });

      it('should preserve groupId when present', () => {
        const exercisesInWorkout: ExerciseInWorkout[] = [
          createMockExerciseInWorkout({ groupId: 'group-123' }),
        ];

        const result = transformExercisesToOptions(exercisesInWorkout, 'metric');
        expect(result[0].groupId).toBe('group-123');
      });

      it('should set undefined groupId when not present', () => {
        const exercisesInWorkout: ExerciseInWorkout[] = [
          createMockExerciseInWorkout({ groupId: undefined }),
        ];

        const result = transformExercisesToOptions(exercisesInWorkout, 'metric');
        expect(result[0].groupId).toBeUndefined();
      });

      it('should return empty array for empty input', () => {
        const result = transformExercisesToOptions([], 'metric');
        expect(result).toEqual([]);
      });

      it('should handle multiple exercises', () => {
        const exercisesInWorkout: ExerciseInWorkout[] = [
          createMockExerciseInWorkout({ id: 'ex-1', label: 'Exercise 1' }),
          createMockExerciseInWorkout({ id: 'ex-2', label: 'Exercise 2' }),
          createMockExerciseInWorkout({ id: 'ex-3', label: 'Exercise 3' }),
        ];

        const result = transformExercisesToOptions(exercisesInWorkout, 'metric');
        expect(result).toHaveLength(3);
        expect(result[0].label).toBe('Exercise 1');
        expect(result[1].label).toBe('Exercise 2');
        expect(result[2].label).toBe('Exercise 3');
      });

      it('should exclude metadata fields', () => {
        const exercisesInWorkout: ExerciseInWorkout[] = [createMockExerciseInWorkout()];

        const result = transformExercisesToOptions(exercisesInWorkout, 'metric');
        expect(result[0]).not.toHaveProperty('sets');
        expect(result[0]).not.toHaveProperty('reps');
        expect(result[0]).not.toHaveProperty('weight');
        expect(result[0]).not.toHaveProperty('isBodyweight');
      });

      it('should include all UI fields', () => {
        const exercisesInWorkout: ExerciseInWorkout[] = [createMockExerciseInWorkout()];

        const result = transformExercisesToOptions(exercisesInWorkout, 'metric');
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('description');
        expect(result[0]).toHaveProperty('icon');
        expect(result[0]).toHaveProperty('iconBgColor');
        expect(result[0]).toHaveProperty('iconColor');
        expect(result[0]).toHaveProperty('groupId');
      });
    });

    describe('transformScheduleDays', () => {
      it('should transform valid schedule to indices', () => {
        const schedule: Partial<Schedule>[] = [
          createMockSchedule('Monday'),
          createMockSchedule('Wednesday'),
          createMockSchedule('Friday'),
        ];

        const result = transformScheduleDays(schedule as Schedule[]);
        expect(result).toEqual([0, 2, 4]);
      });

      it('should transform all 7 days', () => {
        const schedule: Partial<Schedule>[] = WEEKDAY_NAMES.map((day) => createMockSchedule(day));

        const result = transformScheduleDays(schedule as Schedule[]);
        expect(result).toEqual([0, 1, 2, 3, 4, 5, 6]);
      });

      it('should return empty array for empty schedule', () => {
        const result = transformScheduleDays([]);
        expect(result).toEqual([]);
      });

      it('should filter out invalid day names', () => {
        const schedule: Partial<Schedule>[] = [
          createMockSchedule('Monday'),
          createMockSchedule('InvalidDay'),
          createMockSchedule('Friday'),
        ];

        const result = transformScheduleDays(schedule as Schedule[]);
        expect(result).toEqual([0, 4]);
      });

      it('should handle mixed valid and invalid day names', () => {
        const schedule: Partial<Schedule>[] = [
          createMockSchedule('Monday'),
          createMockSchedule('NotADay'),
          createMockSchedule('Wednesday'),
          createMockSchedule(''),
          createMockSchedule('Sunday'),
        ];

        const result = transformScheduleDays(schedule as Schedule[]);
        expect(result).toEqual([0, 2, 6]);
      });
    });
  });

  describe('Validation Utilities', () => {
    describe('validateWorkoutTitle', () => {
      it('should return valid for normal title', () => {
        const result = validateWorkoutTitle('My Workout');
        expect(result).toEqual({ valid: true });
      });

      it('should return valid for title with spaces', () => {
        const result = validateWorkoutTitle('  My Workout  ');
        expect(result).toEqual({ valid: true });
      });

      it('should return invalid for empty string', () => {
        const result = validateWorkoutTitle('');
        expect(result).toEqual({ valid: false, error: 'titleRequired' });
      });

      it('should return invalid for whitespace only', () => {
        const result = validateWorkoutTitle('   ');
        expect(result).toEqual({ valid: false, error: 'titleRequired' });
      });

      it('should return invalid for newline and whitespace', () => {
        const result = validateWorkoutTitle('\n\t  \n');
        expect(result).toEqual({ valid: false, error: 'titleRequired' });
      });

      it('should return valid for single character', () => {
        const result = validateWorkoutTitle('A');
        expect(result).toEqual({ valid: true });
      });

      it('should return valid for long title', () => {
        const longTitle = 'A'.repeat(1000);
        const result = validateWorkoutTitle(longTitle);
        expect(result).toEqual({ valid: true });
      });

      it('should return valid for special characters', () => {
        const result = validateWorkoutTitle('Workout #1 @Gym!');
        expect(result).toEqual({ valid: true });
      });

      it('should return valid for unicode characters', () => {
        const result = validateWorkoutTitle('Workout 🏋️');
        expect(result).toEqual({ valid: true });
      });
    });
  });
});
