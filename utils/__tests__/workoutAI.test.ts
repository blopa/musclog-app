import { ExerciseService } from '@/database/services/ExerciseService';
import { ExerciseSuggestionService } from '@/database/services/ExerciseSuggestionService';
import { isExerciseSuggestible, type SubstitutionContext } from '@/utils/exerciseSubstitution';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import {
  buildWorkoutCompletedSummaryForLLM,
  prepareWorkoutDataForAI,
  processParsedWorkouts,
  processWorkoutPlanResponse,
} from '@/utils/workoutAI';

jest.mock('lucide-react-native', () => ({ Dumbbell: jest.fn() }));

jest.mock('@/database/services/ChatService', () => ({
  ChatService: { saveMessage: jest.fn() },
}));

jest.mock('@/database/services/ExerciseService', () => ({
  ExerciseService: { getAllExercises: jest.fn() },
}));

jest.mock('@/database/services/ExerciseSuggestionService', () => ({
  ExerciseSuggestionService: {
    getSuggestibleExercises: jest.fn(),
  },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getUnits: jest.fn() },
}));

jest.mock('@/database/services/WorkoutAnalytics', () => ({
  WorkoutAnalytics: { getProgressiveOverloadData: jest.fn() },
}));

jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: {
    completeWorkout: jest.fn(),
    getWorkoutWithDetails: jest.fn(),
    startFreeWorkout: jest.fn(),
    updateWorkoutSets: jest.fn(),
  },
}));

jest.mock('@/database/services/WorkoutTemplateService', () => ({
  WorkoutTemplateService: { createPlanWithTemplates: jest.fn() },
}));

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: jest.fn(() => 'My Workout Plan') },
}));

const mockExerciseService = ExerciseService as jest.Mocked<typeof ExerciseService>;
const mockSuggestionService = ExerciseSuggestionService as jest.Mocked<
  typeof ExerciseSuggestionService
>;

// The real filtering rules over a context each test can change: what is under test here is how
// `processWorkoutPlanResponse` applies them, not how they are stored.
let suggestionContext: SubstitutionContext = { restrictions: [], gym: null };
const exercise = (
  id: string,
  muscleGroup: string,
  equipmentType: string,
  mechanicType = 'compound'
) => ({ id, name: id, muscleGroup, equipmentType, mechanicType }) as any;
const mockWorkoutAnalytics = WorkoutAnalytics as jest.Mocked<typeof WorkoutAnalytics>;
const mockWorkoutService = WorkoutService as jest.Mocked<typeof WorkoutService>;
const mockWorkoutTemplateService = WorkoutTemplateService as jest.Mocked<
  typeof WorkoutTemplateService
>;

describe('processWorkoutPlanResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    suggestionContext = { restrictions: [], gym: null };
    mockSuggestionService.getSuggestibleExercises.mockImplementation(async (all) => {
      const context = suggestionContext;
      return {
        exercises: (all ?? []).filter((candidate) => isExerciseSuggestible(candidate, context)),
        disliked: [],
        context,
      };
    });
    mockExerciseService.getAllExercises.mockResolvedValue([
      { id: 'bench', name: 'Bench Press', equipmentType: 'barbell' } as any,
    ]);
    mockWorkoutAnalytics.getProgressiveOverloadData.mockResolvedValue([]);
    mockWorkoutTemplateService.createPlanWithTemplates.mockResolvedValue({
      plan: { id: 'plan-1' },
      templates: [{ id: 'template-1' }],
    } as any);
  });

  it('creates one weekly plan, keeps weekdays on memberships, and falls back for legacy AI output', async () => {
    const result = await processWorkoutPlanResponse({
      description: 'Three focused days',
      workoutPlan: [
        {
          title: 'Push',
          description: 'Chest and shoulders',
          recurringOnWeekDay: 'Wednesday',
          exercises: [
            {
              exerciseId: 'bench',
              sets: 3,
              reps: 8,
              oneRepMaxPercentage: 0,
            },
          ],
        },
      ],
    } as any);

    expect(mockWorkoutTemplateService.createPlanWithTemplates).toHaveBeenCalledWith(
      {
        name: 'My Workout Plan',
        description: 'Three focused days',
        cycleType: 'weekly',
      },
      [
        expect.objectContaining({
          template: expect.objectContaining({ name: 'Push', selectedDays: [] }),
          weekDays: [2],
          position: 0,
        }),
      ]
    );
    expect(result).toEqual({
      templateIds: ['template-1'],
      description: 'Three focused days',
      planId: 'plan-1',
      planName: 'My Workout Plan',
    });
  });

  describe('exercise restrictions', () => {
    const planWith = (...exerciseIds: string[]) =>
      ({
        description: 'plan',
        workoutPlan: [
          {
            title: 'Push',
            description: 'd',
            recurringOnWeekDay: 'Monday',
            exercises: exerciseIds.map((exerciseId) => ({
              exerciseId,
              sets: 3,
              reps: 8,
              oneRepMaxPercentage: 0,
            })),
          },
        ],
      }) as any;

    const exercisesInCreatedPlan = () =>
      (
        mockWorkoutTemplateService.createPlanWithTemplates.mock.calls[0][1][0].template
          .exercises as { id: string }[]
      ).map((chosen) => chosen.id);

    beforeEach(() => {
      mockExerciseService.getAllExercises.mockResolvedValue([
        exercise('bench', 'chest', 'barbell'),
        exercise('db-bench', 'chest', 'dumbbell'),
        exercise('cable-fly', 'chest', 'cable', 'isolation'),
        exercise('squat', 'legs', 'barbell'),
      ]);
    });

    it('passes an unrestricted plan through unchanged', async () => {
      await processWorkoutPlanResponse(planWith('bench', 'squat'));

      expect(exercisesInCreatedPlan()).toEqual(['bench', 'squat']);
    });

    it('swaps an exercise the user cannot do for the closest allowed one in the same region', async () => {
      suggestionContext = {
        restrictions: [{ exerciseId: 'bench', kind: 'injury', expiresAt: null }],
        gym: null,
      };

      await processWorkoutPlanResponse(planWith('bench', 'squat'));

      expect(exercisesInCreatedPlan()).toEqual(['db-bench', 'squat']);
    });

    it('swaps an exercise whose equipment the gym does not have', async () => {
      suggestionContext = {
        restrictions: [],
        gym: { equipment: ['barbell', 'dumbbell'] },
      };

      await processWorkoutPlanResponse(planWith('cable-fly'));

      expect(exercisesInCreatedPlan()).toEqual(['bench']);
    });

    it('never substitutes with an exercise the user dislikes, or one already in the workout', async () => {
      suggestionContext = {
        restrictions: [
          { exerciseId: 'bench', kind: 'never' },
          { exerciseId: 'db-bench', kind: 'dislike' },
        ],
        gym: null,
      };

      await processWorkoutPlanResponse(planWith('bench', 'cable-fly'));

      // db-bench is disliked, and the only other chest candidate (cable-fly) is already planned,
      // so bench is dropped rather than duplicating it.
      expect(exercisesInCreatedPlan()).toEqual(['cable-fly']);
    });

    it('drops an exercise with no allowed substitute rather than keeping it', async () => {
      suggestionContext = {
        restrictions: [
          { exerciseId: 'squat', kind: 'never' },
          { exerciseId: 'bench', kind: 'never' },
        ],
        gym: null,
      };

      await processWorkoutPlanResponse(planWith('squat', 'bench'));

      expect(exercisesInCreatedPlan()).toEqual(['db-bench']);
    });

    it('creates no workout when every exercise in it was ruled out', async () => {
      suggestionContext = {
        restrictions: [{ exerciseId: 'squat', kind: 'never' }],
        gym: { equipment: [] },
      };
      mockExerciseService.getAllExercises.mockResolvedValue([exercise('squat', 'legs', 'barbell')]);

      await processWorkoutPlanResponse(planWith('squat'));

      expect(mockWorkoutTemplateService.createPlanWithTemplates).not.toHaveBeenCalled();
    });
  });
});

describe('processParsedWorkouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExerciseService.getAllExercises.mockResolvedValue([
      { id: 'bench', name: 'Bench Press', equipmentType: 'barbell' } as any,
    ]);
    mockWorkoutService.startFreeWorkout.mockResolvedValue({ id: 'imported-workout' } as any);
    mockWorkoutService.completeWorkout.mockResolvedValue({
      workoutLog: { id: 'imported-workout' },
      personalRecords: [],
    } as any);
  });

  it('marks imported sets as logged so completion does not discard them', async () => {
    await processParsedWorkouts([
      {
        title: 'Imported Push Day',
        date: '2026-08-12',
        exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 80 }] }],
      } as any,
    ]);

    expect(mockWorkoutService.updateWorkoutSets).toHaveBeenCalledWith('imported-workout', [
      expect.objectContaining({
        exerciseId: 'bench',
        reps: 8,
        weight: 80,
        completionStatus: 'performed',
        isNew: true,
      }),
    ]);
    expect(mockWorkoutService.completeWorkout).toHaveBeenCalledWith('imported-workout');
  });

  it('matches a parsed name that differs in case, plural, accents or abbreviation', async () => {
    mockExerciseService.getAllExercises.mockResolvedValue([
      { id: 'fly', name: 'Dumbbell Flyes' } as any,
      { id: 'press', name: 'Barbell Bench Press' } as any,
    ]);

    await processParsedWorkouts([
      {
        title: 'Chest',
        date: '2026-08-12',
        exercises: [
          { name: 'db FLYS', sets: [{ reps: 12, weight: 14 }] },
          { name: 'barbell bench presses', sets: [{ reps: 5, weight: 100 }] },
        ],
      } as any,
    ]);

    expect(mockWorkoutService.updateWorkoutSets).toHaveBeenCalledWith('imported-workout', [
      expect.objectContaining({ exerciseId: 'fly', reps: 12 }),
      expect.objectContaining({ exerciseId: 'press', reps: 5 }),
    ]);
  });

  it('skips an ambiguous name instead of logging the set against a guess', async () => {
    mockExerciseService.getAllExercises.mockResolvedValue([
      { id: 'db-curl', name: 'Dumbbell Curl' } as any,
      { id: 'bb-curl', name: 'Barbell Curl' } as any,
    ]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await processParsedWorkouts([
      {
        title: 'Arms',
        date: '2026-08-12',
        exercises: [{ name: 'curls', sets: [{ reps: 10, weight: 20 }] }],
      } as any,
    ]);

    expect(mockWorkoutService.updateWorkoutSets).not.toHaveBeenCalledWith(
      'imported-workout',
      expect.arrayContaining([expect.objectContaining({ exerciseId: expect.any(String) })])
    );
    warn.mockRestore();
  });
});

describe('completed workout AI summaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SettingsService.getUnits as jest.Mock).mockResolvedValue('metric');
    mockWorkoutService.getWorkoutWithDetails.mockResolvedValue({
      workoutLog: {
        workoutName: 'Push Day',
        startedAt: Date.UTC(2026, 7, 12, 18),
        completedAt: Date.UTC(2026, 7, 12, 19),
      },
      exercises: [
        { id: 'bench', name: 'Bench Press', muscleGroup: 'chest' },
        { id: 'fly', name: 'Cable Fly', muscleGroup: 'chest' },
      ],
      sets: [
        {
          exerciseId: 'bench',
          reps: 8,
          weight: 80,
          completionStatus: 'performed',
          difficultyLevel: 7,
        },
        {
          exerciseId: 'fly',
          reps: 12,
          weight: 30,
          completionStatus: 'skipped',
        },
      ],
    } as any);
  });

  it('omits skipped sets from completion and analysis payloads', async () => {
    const completionSummary = await buildWorkoutCompletedSummaryForLLM('workout-1', {
      volumeStr: '800 kg',
      durationStr: '60 min',
      personalRecords: 0,
    });
    const analysisPayload = await prepareWorkoutDataForAI('workout-1');

    expect(completionSummary).toContain('Bench Press');
    expect(completionSummary).not.toContain('Cable Fly');
    expect(JSON.parse(analysisPayload).exercises).toEqual([
      {
        name: 'Bench Press',
        muscleGroup: 'chest',
        sets: [{ reps: 8, weight: 80, partials: 0, repsInReserve: 0 }],
      },
    ]);
  });

  it('sends set weights in the displayed unit, not the stored kilograms', async () => {
    (SettingsService.getUnits as jest.Mock).mockResolvedValue('imperial');

    const summary = await buildWorkoutCompletedSummaryForLLM('workout-1', {
      volumeStr: '1763.7 lbs',
      durationStr: '60 min',
      personalRecords: 0,
      weightUnit: 'lbs',
      format: 'json',
    });

    // 80 kg is 176.4 lb
    expect(summary).toContain('"weight": 176.4');
    expect(summary).not.toContain('"weight": 80');
  });
});
