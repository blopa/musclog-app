import { ExerciseService, WorkoutAnalytics, WorkoutService } from '@/database/services';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import {
  buildWorkoutCompletedSummaryForLLM,
  prepareWorkoutDataForAI,
  processParsedWorkouts,
  processWorkoutPlanResponse,
} from '@/utils/workoutAI';
import { DEFAULT_LOGGED_DIFFICULTY_LEVEL } from '@/utils/workoutSetCompletion';

jest.mock('lucide-react-native', () => ({ Dumbbell: jest.fn() }));

jest.mock('@/database/services', () => ({
  ChatService: { saveMessage: jest.fn() },
  ExerciseService: { getAllExercises: jest.fn() },
  WorkoutAnalytics: { getProgressiveOverloadData: jest.fn() },
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
const mockWorkoutAnalytics = WorkoutAnalytics as jest.Mocked<typeof WorkoutAnalytics>;
const mockWorkoutService = WorkoutService as jest.Mocked<typeof WorkoutService>;
const mockWorkoutTemplateService = WorkoutTemplateService as jest.Mocked<
  typeof WorkoutTemplateService
>;

describe('processWorkoutPlanResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        difficultyLevel: DEFAULT_LOGGED_DIFFICULTY_LEVEL,
        isNew: true,
      }),
    ]);
    expect(mockWorkoutService.completeWorkout).toHaveBeenCalledWith('imported-workout');
  });
});

describe('completed workout AI summaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
          difficultyLevel: 7,
          isSkipped: false,
        },
        {
          exerciseId: 'fly',
          reps: 12,
          weight: 30,
          difficultyLevel: 0,
          isSkipped: true,
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
});
