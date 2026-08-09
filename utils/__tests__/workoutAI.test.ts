import { ExerciseService, WorkoutAnalytics, WorkoutPlanService } from '@/database/services';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { processWorkoutPlanResponse } from '@/utils/workoutAI';

jest.mock('lucide-react-native', () => ({ Dumbbell: jest.fn() }));

jest.mock('@/database/services', () => ({
  ChatService: { saveMessage: jest.fn() },
  ExerciseService: { getAllExercises: jest.fn() },
  WorkoutAnalytics: { getProgressiveOverloadData: jest.fn() },
  WorkoutPlanService: { createPlan: jest.fn() },
  WorkoutService: { updateWorkoutSets: jest.fn() },
}));

jest.mock('@/database/services/WorkoutTemplateService', () => ({
  WorkoutTemplateService: { saveTemplate: jest.fn() },
}));

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: jest.fn(() => 'My Workout Plan') },
}));

const mockExerciseService = ExerciseService as jest.Mocked<typeof ExerciseService>;
const mockWorkoutAnalytics = WorkoutAnalytics as jest.Mocked<typeof WorkoutAnalytics>;
const mockWorkoutPlanService = WorkoutPlanService as jest.Mocked<typeof WorkoutPlanService>;
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
    mockWorkoutTemplateService.saveTemplate.mockResolvedValue({ id: 'template-1' } as any);
    mockWorkoutPlanService.createPlan.mockResolvedValue({ id: 'plan-1' } as any);
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

    expect(mockWorkoutTemplateService.saveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Push', selectedDays: [] })
    );
    expect(mockWorkoutPlanService.createPlan).toHaveBeenCalledWith({
      name: 'My Workout Plan',
      description: 'Three focused days',
      cycleType: 'weekly',
      memberships: [{ templateId: 'template-1', weekDays: [2], position: 0 }],
    });
    expect(result).toEqual({
      templateIds: ['template-1'],
      description: 'Three focused days',
      planId: 'plan-1',
      planName: 'My Workout Plan',
    });
  });
});
