import { ExerciseService, WorkoutAnalytics } from '@/database/services';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { processWorkoutPlanResponse } from '@/utils/workoutAI';

jest.mock('lucide-react-native', () => ({ Dumbbell: jest.fn() }));

jest.mock('@/database/services', () => ({
  ChatService: { saveMessage: jest.fn() },
  ExerciseService: { getAllExercises: jest.fn() },
  WorkoutAnalytics: { getProgressiveOverloadData: jest.fn() },
  WorkoutService: { updateWorkoutSets: jest.fn() },
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
