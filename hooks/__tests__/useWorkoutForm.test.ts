/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';

import { database } from '@/database';
import Exercise from '@/database/models/Exercise';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { type AddExerciseData, useWorkoutForm } from '@/hooks/useWorkoutForm';
import { handleError } from '@/utils/handleError';
import * as workoutUtils from '@/utils/workout';
import { ExerciseMetadata } from '@/utils/workout';

// Mock dependencies
// Only `Alert` is stubbed: the rest of the module has to stay real because NativeWind's
// JSX runtime (pulled in through ConfettiInteractionsContext) reads `Appearance` at import.
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: jest.fn(),
  },
}));

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
  }),
}));

jest.mock('react-i18next', () => ({
  // `lang/lang.ts` loads for real further down the graph and calls
  // `i18n.use(initReactI18next)`, which throws on an undefined module.
  initReactI18next: jest.requireActual('react-i18next').initReactI18next,
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

jest.mock('../../database', () => ({
  database: {
    get: jest.fn(() => ({
      find: jest.fn().mockResolvedValue(null), // Default immediate resolution
      query: jest.fn(() => ({
        fetch: jest.fn().mockResolvedValue([]),
      })),
      prepareCreate: jest.fn(),
      create: jest.fn(),
      fetch: jest.fn().mockResolvedValue([]),
    })),
    write: jest.fn((callback) => {
      // Execute callback immediately and return resolved promise
      const result = callback();
      return Promise.resolve(result);
    }),
    batch: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../database/services/WorkoutTemplateService', () => ({
  WorkoutTemplateService: {
    getTemplateWithDetails: jest.fn(),
    convertTemplateExercisesToUI: jest.fn(),
    saveTemplate: jest.fn(),
  },
}));

jest.mock('../../database/repositories/WorkoutPlanRepository', () => ({
  WorkoutPlanRepository: {
    getMembershipsForTemplate: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
  },
}));

// The hook reads three contexts. Stub them so it can be rendered without a provider tree.
const mockShowSnackbar = jest.fn();
jest.mock('../../context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

// Errors are reported through `handleError` (Sentry + snackbar) rather than `Alert.alert`.
jest.mock('../../utils/handleError', () => ({
  handleError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../useConfettiTrigger', () => ({
  useConfettiTrigger: () => ({ showConfetti: jest.fn(), triggerConfetti: jest.fn() }),
}));

jest.mock('../useSettings', () => ({
  useSettings: () => ({ heightUnit: 'cm', isLoading: false, units: 'metric', weightUnit: 'kg' }),
}));

jest.mock('../useTheme', () => ({
  useTheme: () => ({}),
}));

jest.mock('../../utils/workout', () => ({
  transformExercisesToOptions: jest.fn(),
  transformScheduleDays: jest.fn(),
  createExerciseOption: jest.fn(),
  extractExerciseMetadata: jest.fn(),
  updateMetadataWithGroupIds: jest.fn(),
  exercisesToWorkoutFormat: jest.fn(),
  validateWorkoutTitle: jest.fn(),
}));

const mockWorkoutTemplateService = WorkoutTemplateService as jest.Mocked<
  typeof WorkoutTemplateService
>;
const mockWorkoutPlanRepository = WorkoutPlanRepository as jest.Mocked<
  typeof WorkoutPlanRepository
>;
const mockDatabase = database as jest.Mocked<typeof database>;
const mockWorkoutUtils = workoutUtils as jest.Mocked<typeof workoutUtils>;
const mockAlert = Alert as jest.Mocked<typeof Alert>;
const mockHandleError = handleError as jest.MockedFunction<typeof handleError>;

/** The hook reports a successful save through this callback, not through the router. */
const mockOnSaveSuccess = jest.fn();

describe('hooks/useWorkoutForm', () => {
  const mockExercise: Partial<Exercise> = {
    id: 'ex-1',
    name: 'Bench Press',
    equipmentType: 'barbell',
  };

  const mockExerciseOption = {
    id: 'ex-1',
    label: 'Bench Press',
    description: '3 sets × 10 reps',
    icon: jest.fn(),
    iconBgColor: '#ffffff',
    iconColor: '#131314',
    groupId: undefined,
  };

  const mockTemplate = {
    id: 'template-1',
    name: 'Test Workout',
    description: 'Test Description',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterBack.mockClear();
    // All mocks return immediately for optimal performance
    mockWorkoutUtils.validateWorkoutTitle.mockReturnValue({ valid: true });
    // transformScheduleDays will be mocked per test
    mockWorkoutUtils.transformExercisesToOptions.mockReturnValue([mockExerciseOption]);
    mockWorkoutUtils.createExerciseOption.mockReturnValue(mockExerciseOption);
    mockWorkoutUtils.extractExerciseMetadata.mockReturnValue({
      sets: 3,
      reps: 10,
      weight: 0,
      isBodyweight: false,
      groupId: undefined,
    });
    mockWorkoutUtils.updateMetadataWithGroupIds.mockImplementation((prev, reordered) => prev);
    mockWorkoutUtils.exercisesToWorkoutFormat.mockReturnValue([]);
    // Ensure service mocks resolve immediately
    mockWorkoutTemplateService.getTemplateWithDetails.mockResolvedValue({
      template: {} as any,
      templateExercises: [],
      sets: [],
      schedule: [],
    });
    mockWorkoutTemplateService.convertTemplateExercisesToUI.mockResolvedValue([]);
    mockWorkoutTemplateService.saveTemplate.mockResolvedValue(mockTemplate);
    mockWorkoutPlanRepository.getMembershipsForTemplate.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([]),
    } as any);
  });

  describe('initial state', () => {
    it('should initialize with default values in create mode', () => {
      const { result } = renderHook(() => useWorkoutForm());

      expect(result.current.workoutTitle).toBe('');
      expect(result.current.description).toBe('');
      expect(result.current.workoutInsights).toBe('none');
      expect(result.current.selectedDays).toEqual([]);
      expect(result.current.focusedField).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.selectedExercises).toEqual([]);
      expect(result.current.exercises).toEqual([]);
      expect(result.current.exerciseMetadata.size).toBe(0);
      expect(result.current.isEditMode).toBe(false);
    });

    it('should initialize with loading true in edit mode', () => {
      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      expect(result.current.isEditMode).toBe(true);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('loadTemplate', () => {
    it('should load template data in edit mode', async () => {
      const mockTemplate = {
        name: 'My Workout',
        description: 'Workout description',
      };

      const mockSets = [] as ExerciseMetadata[];
      const mockSchedule = [{ dayOfWeek: 'Monday' }, { dayOfWeek: 'Wednesday' }];
      const mockExercisesInWorkout = [
        {
          id: 'ex-1',
          label: 'Bench Press',
          description: '3 sets × 10 reps',
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: false,
          groupId: undefined,
        },
      ];

      const mockTemplateExercises = [] as any;
      mockWorkoutTemplateService.getTemplateWithDetails.mockResolvedValue({
        template: mockTemplate as any,
        templateExercises: mockTemplateExercises,
        sets: mockSets as any,
        schedule: mockSchedule as any,
      });
      mockWorkoutTemplateService.convertTemplateExercisesToUI.mockResolvedValue(
        mockExercisesInWorkout as any
      );
      // Mock transformScheduleDays to return the correct indices for Monday (0) and Wednesday (2)
      mockWorkoutUtils.transformScheduleDays.mockReturnValue([0, 2]);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.workoutTitle).toBe('My Workout');
      expect(result.current.description).toBe('Workout description');
      expect(result.current.selectedDays).toEqual([0, 2]);
      expect(result.current.selectedPlanIds).toEqual([]);
      expect(mockWorkoutTemplateService.getTemplateWithDetails).toHaveBeenCalledWith('template-1');
      expect(mockWorkoutTemplateService.convertTemplateExercisesToUI).toHaveBeenCalledWith(
        mockTemplateExercises,
        mockSets
      );
    });

    it('should load active plan memberships separately from a standalone schedule', async () => {
      mockWorkoutTemplateService.getTemplateWithDetails.mockResolvedValue({
        template: { name: 'Push', weekDaysJson: [6] } as any,
        templateExercises: [],
        sets: [],
        schedule: [{ dayOfWeek: 'Tuesday' }] as any,
      });
      mockWorkoutPlanRepository.getMembershipsForTemplate.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([{ planId: 'plan-1' }, { planId: 'plan-2' }]),
      } as any);
      mockWorkoutUtils.transformScheduleDays.mockReturnValue([1]);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedDays).toEqual([1]);
      expect(result.current.selectedPlanIds).toEqual(['plan-1', 'plan-2']);
    });

    it('should handle loading error', async () => {
      const error = new Error('Failed to load');
      mockWorkoutTemplateService.getTemplateWithDetails.mockRejectedValue(error);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockHandleError).toHaveBeenCalledWith(
        error,
        'useWorkoutForm.loadTemplate',
        expect.objectContaining({ snackbarMessage: 'createWorkout.loadError' })
      );
    });

    it('should not load template in create mode', () => {
      renderHook(() => useWorkoutForm());

      expect(mockWorkoutTemplateService.getTemplateWithDetails).not.toHaveBeenCalled();
    });

    it('should not load when templateId is empty string', () => {
      renderHook(() => useWorkoutForm({ templateId: '' }));

      expect(mockWorkoutTemplateService.getTemplateWithDetails).not.toHaveBeenCalled();
    });

    it('should not load when templateId is null', () => {
      // TypeScript allows undefined but not null, so we need to cast
      // This tests the runtime behavior when templateId is falsy
      renderHook(() => useWorkoutForm({ templateId: null as unknown as string | undefined }));

      expect(mockWorkoutTemplateService.getTemplateWithDetails).not.toHaveBeenCalled();
    });

    it('should set description to empty string when template.description is null', async () => {
      const mockTemplate = {
        name: 'My Workout',
        description: null,
      };
      const mockTemplateExercises = [] as any;
      const mockSets = [] as ExerciseMetadata[];
      const mockSchedule = [{ dayOfWeek: 'Monday' }];

      mockWorkoutTemplateService.getTemplateWithDetails.mockResolvedValue({
        template: mockTemplate as any,
        templateExercises: mockTemplateExercises,
        sets: mockSets as any,
        schedule: mockSchedule as any,
      });
      mockWorkoutTemplateService.convertTemplateExercisesToUI.mockResolvedValue([]);
      mockWorkoutUtils.transformScheduleDays.mockReturnValue([0]);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.description).toBe('');
    });

    it('should set description to empty string when template.description is undefined', async () => {
      const mockTemplate = {
        name: 'My Workout',
        description: undefined,
      };
      const mockTemplateExercises = [] as any;
      const mockSets = [] as ExerciseMetadata[];
      const mockSchedule = [{ dayOfWeek: 'Monday' }];

      mockWorkoutTemplateService.getTemplateWithDetails.mockResolvedValue({
        template: mockTemplate as any,
        templateExercises: mockTemplateExercises,
        sets: mockSets as any,
        schedule: mockSchedule as any,
      });
      mockWorkoutTemplateService.convertTemplateExercisesToUI.mockResolvedValue([]);
      mockWorkoutUtils.transformScheduleDays.mockReturnValue([0]);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.description).toBe('');
    });
  });

  describe('toggleDay', () => {
    it('should add day when not selected', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.toggleDay(0);
      });

      expect(result.current.selectedDays).toEqual([0]);
    });

    it('should remove day when already selected', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.toggleDay(0);
        result.current.toggleDay(1);
        result.current.toggleDay(0); // Remove day 0
      });

      expect(result.current.selectedDays).toEqual([1]);
    });

    it('should keep days sorted', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.toggleDay(3);
        result.current.toggleDay(1);
        result.current.toggleDay(5);
      });

      expect(result.current.selectedDays).toEqual([1, 3, 5]);
    });
  });

  describe('handleAddExerciseWithMetadata', () => {
    it('should add exercise with metadata', async () => {
      const mockFind = jest.fn().mockResolvedValue(mockExercise);
      mockDatabase.get.mockReturnValue({
        find: mockFind,
      } as any);

      const { result } = renderHook(() => useWorkoutForm());

      const exerciseData: AddExerciseData = {
        exerciseId: 'ex-1',
        sets: 3,
        reps: 10,
        weight: 60,
        isBodyweight: false,
      };

      await act(async () => {
        await result.current.handleAddExerciseWithMetadata(exerciseData);
      });

      expect(mockDatabase.get).toHaveBeenCalledWith('exercises');
      expect(mockFind).toHaveBeenCalledWith('ex-1');
      // `createExerciseOption(theme, params)` — the palette is passed separately, and the
      // params now carry the unit system so the option's description can be localised.
      expect(mockWorkoutUtils.createExerciseOption).toHaveBeenCalledWith(expect.any(Object), {
        exercise: mockExercise,
        sets: 3,
        reps: 10,
        weight: 60,
        isBodyweight: false,
        groupId: undefined,
        units: 'metric',
      });
      expect(result.current.exercises).toHaveLength(1);
      expect(result.current.exerciseMetadata.has('ex-1')).toBe(true);
      const metadata = result.current.exerciseMetadata.get('ex-1');
      expect(metadata).toEqual({
        sets: 3,
        reps: 10,
        weight: 60,
        isBodyweight: false,
        groupId: undefined,
        // Defaulted when the caller does not supply them.
        restTimeAfter: 60,
        setType: 'normal',
        notes: undefined,
      });
    });

    it('should handle error when adding exercise', async () => {
      const error = new Error('Exercise not found');
      mockDatabase.get.mockReturnValue({
        find: jest.fn().mockRejectedValue(error),
      } as any);

      const { result } = renderHook(() => useWorkoutForm());

      const exerciseData: AddExerciseData = {
        exerciseId: 'ex-1',
        sets: 3,
        reps: 10,
        weight: 0,
        isBodyweight: true,
      };

      await act(async () => {
        await result.current.handleAddExerciseWithMetadata(exerciseData);
      });

      expect(mockHandleError).toHaveBeenCalledWith(
        error,
        'useWorkoutForm.addExercise',
        expect.objectContaining({ snackbarMessage: 'createWorkout.addExerciseError' })
      );
    });
  });

  describe('handleSave', () => {
    it('should save workout template in create mode', async () => {
      mockWorkoutTemplateService.saveTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useWorkoutForm({ onSaveSuccess: mockOnSaveSuccess }));

      act(() => {
        result.current.setWorkoutTitle('New Workout');
        result.current.setDescription('Description');
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockWorkoutUtils.validateWorkoutTitle).toHaveBeenCalledWith('New Workout');
      expect(mockWorkoutTemplateService.saveTemplate).toHaveBeenCalledWith({
        templateId: undefined,
        name: 'New Workout',
        description: 'Description',
        workoutInsightsType: 'none',
        type: 'strength',
        icon: undefined,
        exercises: [],
        selectedDays: [],
        planIds: [],
      });
      expect(mockOnSaveSuccess).toHaveBeenCalled();
      expect(result.current.isSaving).toBe(false);
    });

    it('should show error when title is invalid', async () => {
      mockWorkoutUtils.validateWorkoutTitle.mockReturnValue({
        valid: false,
        error: 'titleRequired',
      });

      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setWorkoutTitle('');
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'error',
        'createWorkout.validation.titleRequiredMessage'
      );
      expect(mockWorkoutTemplateService.saveTemplate).not.toHaveBeenCalled();
    });

    it.skip('should save workout template in edit mode', async () => {
      // TODO: Implement edit mode save test
    });

    it('should trim title and description', async () => {
      mockWorkoutTemplateService.saveTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useWorkoutForm({ onSaveSuccess: mockOnSaveSuccess }));

      act(() => {
        result.current.setWorkoutTitle('  Trimmed Title  ');
        result.current.setDescription('  Trimmed Description  ');
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockWorkoutTemplateService.saveTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Title',
          description: 'Trimmed Description',
          workoutInsightsType: 'none',
          planIds: [],
        })
      );
      expect(mockOnSaveSuccess).toHaveBeenCalled();
    });

    it('should convert empty trimmed description to undefined', async () => {
      mockWorkoutTemplateService.saveTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setWorkoutTitle('Test Workout');
        result.current.setDescription('   '); // Whitespace only
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockWorkoutTemplateService.saveTemplate).toHaveBeenCalledWith({
        templateId: undefined,
        name: 'Test Workout',
        description: undefined, // Empty trimmed description becomes undefined
        workoutInsightsType: 'none',
        type: 'strength',
        icon: undefined,
        exercises: [],
        selectedDays: [],
        planIds: [],
      });
    });

    it('should handle save error', async () => {
      const error = new Error('Save failed');
      mockWorkoutTemplateService.saveTemplate.mockRejectedValue(error);

      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setWorkoutTitle('Test Workout');
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockHandleError).toHaveBeenCalledWith(
        error,
        'useWorkoutForm.saveTemplate',
        expect.objectContaining({ snackbarMessage: 'createWorkout.saveError' })
      );
      expect(result.current.isSaving).toBe(false);
    });

    it('should set isSaving state correctly', async () => {
      let resolveSave: (value: any) => void;
      const savePromise = new Promise<any>((resolve) => {
        resolveSave = resolve;
      });
      mockWorkoutTemplateService.saveTemplate.mockReturnValue(savePromise);

      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setWorkoutTitle('Test');
      });

      act(() => {
        result.current.handleSave();
      });

      expect(result.current.isSaving).toBe(true);

      await act(async () => {
        resolveSave!(mockTemplate);
        await savePromise;
      });

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('handleExerciseOrderChange', () => {
    it('should update exercises and metadata when order changes', () => {
      const { result } = renderHook(() => useWorkoutForm());

      // Add initial exercises
      act(() => {
        result.current.setExercises([mockExerciseOption]);
      });

      const reorderedExercises = [
        { ...mockExerciseOption, id: 'ex-2' },
        { ...mockExerciseOption, id: 'ex-1' },
      ];

      act(() => {
        result.current.handleExerciseOrderChange(reorderedExercises);
      });

      expect(result.current.exercises).toEqual(reorderedExercises);
      expect(mockWorkoutUtils.updateMetadataWithGroupIds).toHaveBeenCalled();
    });
  });

  describe('setters', () => {
    it('should update workoutTitle', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setWorkoutTitle('New Title');
      });

      expect(result.current.workoutTitle).toBe('New Title');
    });

    it('should update description', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setDescription('New Description');
      });

      expect(result.current.description).toBe('New Description');
    });

    it('should update workoutInsights', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setWorkoutInsights('algorithm');
      });

      expect(result.current.workoutInsights).toBe('algorithm');
    });

    it('should update focusedField', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setFocusedField('title');
      });

      expect(result.current.focusedField).toBe('title');

      act(() => {
        result.current.setFocusedField(null);
      });

      expect(result.current.focusedField).toBeNull();
    });

    it('should update selectedExercises', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setSelectedExercises(['ex-1', 'ex-2']);
      });

      expect(result.current.selectedExercises).toEqual(['ex-1', 'ex-2']);
    });
  });
});
