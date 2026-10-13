import { act, renderHook } from '@testing-library/react';

import { useSessionExerciseActions } from '@/hooks/useSessionExerciseActions';
import { ExerciseRestrictionService } from '@/database/services/ExerciseRestrictionService';
import { WorkoutLogExerciseService } from '@/database/services/WorkoutLogExerciseService';

const mockShowSnackbar = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/SnackbarContext', () => ({ useSnackbar: () => ({ showSnackbar: mockShowSnackbar }) }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/WorkoutLogExerciseService', () => ({
  WorkoutLogExerciseService: { replaceLogExercise: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/WorkoutTemplateService', () => ({
  WorkoutTemplateService: {
    getSuggestedWeightAndRepsForExercise: jest.fn(async () => ({ weightKg: 20, reps: 10 })),
  },
}));
jest.mock('@/database/services/ExerciseRestrictionService', () => ({
  MAX_EXERCISE_RESTRICTIONS: 300,
  ExerciseRestrictionService: { set: jest.fn(async () => ({ ok: true })) },
}));
jest.mock('@/database/services/GymService', () => ({ GymService: { removeEquipment: jest.fn() } }));
jest.mock('@/database/services/ExerciseUserSettingsService', () => ({
  ExerciseUserSettingsService: {},
}));
jest.mock('@/database/services/WorkoutProgressionService', () => ({
  WorkoutProgressionService: {},
}));

const target = {
  set: { logExerciseId: 'block-1' },
  exercise: { id: 'bench', name: 'Bench', equipmentType: 'barbell' },
} as never;
const swapTo = { id: 'fly', name: 'Fly', muscleGroup: 'chest' } as never;

function setup() {
  const refresh = jest.fn(async () => {});
  const { result } = renderHook(() =>
    useSessionExerciseActions({
      target,
      gym: null,
      exerciseNote: undefined,
      refresh,
      setIsSaving: jest.fn(),
    })
  );
  return { result, refresh };
}

describe('useSessionExerciseActions.replaceExercise', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports success so the caller may clear the old exercise’s typed values', async () => {
    const { result, refresh } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.replaceExercise(swapTo, { reason: 'just_today' });
    });
    expect(ok).toBe(true);
    expect(refresh).toHaveBeenCalled();
  });

  it('reports failure when the swap itself fails, so nothing the user typed is thrown away', async () => {
    jest
      .mocked(WorkoutLogExerciseService.replaceLogExercise)
      .mockRejectedValueOnce(new Error('disk full'));
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.replaceExercise(swapTo, { reason: 'just_today' });
    });
    expect(ok).toBe(false);
  });

  it('still reports the swap as done when only remembering the choice fails', async () => {
    jest.mocked(ExerciseRestrictionService.set).mockRejectedValueOnce(new Error('nope'));
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.replaceExercise(swapTo, {
        reason: 'dislike',
        restriction: { kind: 'dislike' },
      } as never);
    });
    expect(ok).toBe(true);
  });
});
