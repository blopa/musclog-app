/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import { renderHook, act, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { useWorkoutForm, type AddExerciseData } from '../useWorkoutForm';
import { WorkoutTemplateService } from '../../database/services/WorkoutTemplateService';
import Exercise from '../../database/models/Exercise';
import { database } from '../../database';
import * as workoutUtils from '../../utils/workout';
import { ExerciseMetadata } from '../../utils/workout';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

jest.mock('../../database', () => ({
  database: {
    get: jest.fn(() => ({
      find: jest.fn(),
    })),
  },
}));

jest.mock('../../database/services/WorkoutTemplateService', () => ({
  WorkoutTemplateService: {
    getTemplateWithDetails: jest.fn(),
    convertSetsToExercises: jest.fn(),
    saveTemplate: jest.fn(),
  },
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

const mockWorkoutTemplateService = WorkoutTemplateService as jest.Mocked<typeof WorkoutTemplateService>;
const mockDatabase = database as jest.Mocked<typeof database>;
const mockWorkoutUtils = workoutUtils as jest.Mocked<typeof workoutUtils>;
const mockAlert = Alert as jest.Mocked<typeof Alert>;

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
    iconBgColor: '#fff',
    iconColor: '#000',
    groupId: undefined,
  };

  const mockTemplate = {
    id: 'template-1',
    name: 'Test Workout',
    description: 'Test Description',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkoutUtils.validateWorkoutTitle.mockReturnValue({ valid: true });
    mockWorkoutUtils.transformScheduleDays.mockReturnValue([0, 2, 4]);
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
  });

  describe('initial state', () => {
    it('should initialize with default values in create mode', () => {
      const { result } = renderHook(() => useWorkoutForm());

      expect(result.current.workoutTitle).toBe('');
      expect(result.current.description).toBe('');
      expect(result.current.volumeCalc).toBe('none');
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

      mockWorkoutTemplateService.getTemplateWithDetails.mockResolvedValue({
        template: mockTemplate as any,
        sets: mockSets as any,
        schedule: mockSchedule as any,
      });
      mockWorkoutTemplateService.convertSetsToExercises.mockResolvedValue(mockExercisesInWorkout as any);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.workoutTitle).toBe('My Workout');
      expect(result.current.description).toBe('Workout description');
      expect(result.current.selectedDays).toEqual([0, 2]);
      expect(mockWorkoutTemplateService.getTemplateWithDetails).toHaveBeenCalledWith('template-1');
      expect(mockWorkoutTemplateService.convertSetsToExercises).toHaveBeenCalledWith(mockSets);
    });

    it('should handle loading error', async () => {
      const error = new Error('Failed to load');
      mockWorkoutTemplateService.getTemplateWithDetails.mockRejectedValue(error);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Failed to load workout template');
    });

    it('should not load template in create mode', () => {
      renderHook(() => useWorkoutForm());

      expect(mockWorkoutTemplateService.getTemplateWithDetails).not.toHaveBeenCalled();
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
      expect(mockWorkoutUtils.createExerciseOption).toHaveBeenCalledWith({
        exercise: mockExercise,
        sets: 3,
        reps: 10,
        weight: 60,
        isBodyweight: false,
        groupId: undefined,
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

      expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Failed to add exercise');
    });
  });

  describe('handleSave', () => {
    it('should save workout template in create mode', async () => {
      const mockRouter = require('expo-router').useRouter();
      mockWorkoutTemplateService.saveTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useWorkoutForm());

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
        exercises: [],
        selectedDays: [],
      });
      expect(mockRouter().back).toHaveBeenCalled();
      expect(result.current.isSaving).toBe(false);
    });

    it('should save workout template in edit mode', async () => {
      const mockRouter = require('expo-router').useRouter();
      mockWorkoutTemplateService.saveTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useWorkoutForm({ templateId: 'template-1' }));

      act(() => {
        result.current.setWorkoutTitle('Updated Workout');
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockWorkoutTemplateService.saveTemplate).toHaveBeenCalledWith({
        templateId: 'template-1',
        name: 'Updated Workout',
        description: undefined,
        exercises: [],
        selectedDays: [],
      });
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

      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Title Required',
        'Please enter a workout title'
      );
      expect(mockWorkoutTemplateService.saveTemplate).not.toHaveBeenCalled();
    });

    it('should trim title and description', async () => {
      const mockRouter = require('expo-router').useRouter();
      mockWorkoutTemplateService.saveTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useWorkoutForm());

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
        })
      );
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

      expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Failed to save workout template');
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

    it('should update volumeCalc', () => {
      const { result } = renderHook(() => useWorkoutForm());

      act(() => {
        result.current.setVolumeCalc('total');
      });

      expect(result.current.volumeCalc).toBe('total');
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
