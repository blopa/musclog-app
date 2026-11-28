import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { VoiceCommandProvider, useVoiceCommands } from '@/context/VoiceCommandContext';
import { logTrackedMeal } from '@/services/trackedMealLogging';
import { interpretVoiceCommand } from '@/services/voiceCommand';
import { findSpokenWorkout } from '@/services/voiceWorkout';
import { takePendingVoiceAction } from '@/utils/voiceCommand/voiceActionInbox';

const mockNavigate = jest.fn();
const mockShowSnackbar = jest.fn();
const mockOpenCoach = jest.fn();
const mockEstimateMeal = jest.fn();
const mockOpenCamera = jest.fn();
const mockSettings = { isAiConfigured: true, aiProvider: 'gemini', isAiMealPhotoEnabled: true };
const mockLock = { locked: false };
const mockCycle = { isActive: true };

jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/utils/coachAI', () => ({
  AiCreditsError: class AiCreditsErrorMock extends Error {},
  isAiCreditsError: () => false,
  reportAiError: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en-US' } }),
}));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));
jest.mock('@/components/CoachContext', () => ({ useCoach: () => ({ openCoach: mockOpenCoach }) }));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => mockSettings,
}));
jest.mock('@/components/CameraView', () => ({ useHasCamera: () => true }));
jest.mock('@/context/SmartCameraContext', () => ({
  useSmartCamera: () => ({ openCamera: mockOpenCamera }),
}));
jest.mock('@/context/AppLockContext', () => ({
  useAppLock: () => {
    const locked = mockLock.locked;

    return { isLocked: () => locked };
  },
}));
jest.mock('@/services/voiceWorkout', () => ({ findSpokenWorkout: jest.fn() }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/hooks/useOnDeviceStatus', () => ({ useOnDeviceStatus: () => ({ state: 'ready' }) }));
jest.mock('@/hooks/useMenstrualCycle', () => ({ useMenstrualCycle: () => mockCycle }));
jest.mock('@/hooks/useNavigationItems', () => ({
  isNavItemAvailable: (item: string, isCycleActive: boolean) => item !== 'cycle' || isCycleActive,
}));
jest.mock('@/components/navigation/navDestinations', () => ({
  HOME_ROUTE: '/app',
  NAV_DESTINATIONS: {
    food: { route: '/app/nutrition/food' },
    notes: { route: '/app/notes' },
    progress: { route: '/app/progress' },
    cycle: { route: '/app/cycle' },
    workouts: { route: '/app/workout/workouts' },
  },
}));
// Stable across renders, as the real hook's abandon is.
const mockAi = {
  progress: null,
  abandon: jest.fn(),
  run: jest.fn(),
  setProgress: jest.fn(),
};
jest.mock('@/components/camera/useCameraAiProcessing', () => ({
  useCameraAiProcessing: () => mockAi,
}));
jest.mock('@/components/camera/useMealTextEstimate', () => ({
  useMealTextEstimate: () => mockEstimateMeal,
}));
jest.mock('@/services/trackedMealLogging', () => ({ logTrackedMeal: jest.fn() }));
jest.mock('@/services/voiceCommand', () => ({ interpretVoiceCommand: jest.fn() }));
// The modal is covered by its own test: here it only shows which state the provider holds.
jest.mock('@/components/modals/VoiceCommandModal', () => ({
  VoiceCommandModal: ({
    state,
    onCancel,
    onPickTool,
    onWeighInClose,
    onLogMeal,
    onMealReviewClose,
    onPickWorkout,
    onCardioLogged,
    onCardioClose,
  }: {
    state: {
      kind: string;
      transcript: string;
      workouts?: { templateId: string; name: string; planId?: string }[];
      initial?: unknown;
    } | null;
    onCancel: () => void;
    onPickTool: (transcript: string, tool: string) => void;
    onWeighInClose: (saved: boolean) => void;
    onLogMeal: (data: unknown) => Promise<void>;
    onMealReviewClose: () => void;
    onPickWorkout: (workout: { templateId: string; name: string; planId?: string }) => void;
    onCardioLogged: () => void;
    onCardioClose: () => void;
  }) => (
    <div>
      <span data-testid="modal-state">{state?.kind ?? 'closed'}</span>
      {state ? <button onClick={onCancel}>modal-cancel</button> : null}
      {state?.kind === 'workoutChoice'
        ? state.workouts?.map((workout) => (
            <button key={workout.templateId} onClick={() => onPickWorkout(workout)}>
              {workout.name}
            </button>
          ))
        : null}
      {state?.kind === 'cardio' ? (
        <>
          <span data-testid="cardio-initial">{JSON.stringify(state.initial)}</span>
          <button onClick={onCardioLogged}>cardio-logged</button>
          <button onClick={onCardioClose}>cardio-close</button>
        </>
      ) : null}
      {state?.kind === 'pick' ? (
        <button onClick={() => onPickTool(state.transcript, 'copy_meal')}>modal-pick</button>
      ) : null}
      {state?.kind === 'weight' ? (
        <button onClick={() => onWeighInClose(true)}>modal-weigh-saved</button>
      ) : null}
      {state?.kind === 'mealReview' ? (
        <>
          <button
            onClick={() =>
              void onLogMeal({
                date: new Date(2026, 10, 26),
                time: null,
                mealType: 'lunch',
                portionGrams: 150,
              })
            }
          >
            modal-log-meal
          </button>
          <button onClick={onMealReviewClose}>modal-meal-close</button>
        </>
      ) : null}
    </div>
  ),
}));

const mockInterpret = interpretVoiceCommand as jest.Mock;
const mockLogTrackedMeal = logTrackedMeal as jest.Mock;
const mockFindWorkout = findSpokenWorkout as jest.Mock;

const DAY = new Date(2026, 10, 26);
const REVIEW = {
  meal: { name: 'Oats', type: 'Breakfast', kcal: 300 },
  ingredients: [{ name: 'oats', grams: 80 }],
};

function Probe() {
  const { submit } = useVoiceCommands();

  return <button onClick={() => submit('same breakfast as yesterday')}>submit</button>;
}

function renderProvider() {
  return render(
    <VoiceCommandProvider>
      <Probe />
    </VoiceCommandProvider>
  );
}

const SNACKBAR_OPTIONS = { duration: 4000 };

beforeEach(() => {
  jest.clearAllMocks();
  mockCycle.isActive = true;
  mockSettings.isAiMealPhotoEnabled = true;
  mockLock.locked = false;
  mockEstimateMeal.mockReset();
  takePendingVoiceAction(['addNote', 'copyMeal', 'searchFood', 'logWeight', 'previewWorkout']);
});

describe('VoiceCommandProvider', () => {
  it('opens the coach with the spoken text in its composer', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['ask_coach'],
      action: { kind: 'askCoach', text: 'How much protein?' },
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() =>
      expect(mockOpenCoach).toHaveBeenCalledWith({ composerText: 'How much protein?' })
    );
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it.each([
    ['barcode-scan', false, { mode: 'barcode-scan', showBarcodeTextSearch: true }],
    ['ai-meal-photo', true, { mode: 'ai-meal-photo', showBarcodeTextSearch: true }],
    ['ai-meal-photo', false, { showBarcodeTextSearch: true }],
  ])('opens camera mode %s with photo availability %s', async (mode, enabled, options) => {
    mockSettings.isAiMealPhotoEnabled = enabled;
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['open_camera'],
      action: { kind: 'openCamera', mode },
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(mockOpenCamera).toHaveBeenCalledWith(options));
    expect(mockInterpret).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ hasCamera: true })
    );
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('opens the named workout preview through the inbox', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['start_workout'],
      action: { kind: 'startWorkout', said: 'start push' },
    });
    mockFindWorkout.mockResolvedValue({
      kind: 'found',
      workout: { templateId: 'w', name: 'Push', planId: 'p' },
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/workout/workouts'));
    expect(takePendingVoiceAction(['previewWorkout'])).toEqual({
      kind: 'previewWorkout',
      templateId: 'w',
      planId: 'p',
    });
  });

  it('resumes an active workout and explains that it is running', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['start_workout'],
      action: { kind: 'startWorkout', said: 'start workout' },
    });
    mockFindWorkout.mockResolvedValue({ kind: 'active', workoutLogId: 'log1' });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/app/workout/workout-session?workoutLogId=log1')
    );
    expect(mockShowSnackbar).toHaveBeenCalledWith('success', 'voiceInput.command.workoutActive');
  });

  it.each([false, true])('handles workout choices with locked area %s', async (locked) => {
    mockLock.locked = locked;
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['start_workout'],
      action: { kind: 'startWorkout', said: 'start' },
    });
    mockFindWorkout.mockResolvedValue({
      kind: 'choose',
      workouts: [{ templateId: 'w', name: 'Push' }],
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    if (locked) {
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/workout/workouts'));
      expect(screen.queryByText('Push')).toBeNull();
    } else {
      await waitFor(() => expect(screen.getByText('Push')).toBeTruthy());
      fireEvent.click(screen.getByText('Push'));
      expect(takePendingVoiceAction(['previewWorkout'])).toEqual({
        kind: 'previewWorkout',
        templateId: 'w',
        planId: undefined,
      });
    }
  });

  it('shows a wrong-task notice when a workout list is cancelled', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['start_workout'],
      action: { kind: 'startWorkout', said: 'start' },
    });
    mockFindWorkout.mockResolvedValue({
      kind: 'choose',
      workouts: [{ templateId: 'w', name: 'Push' }],
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(screen.getByText('Push')).toBeTruthy());
    fireEvent.click(screen.getByText('modal-cancel'));
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'success',
      'voiceInput.command.wrongTask',
      expect.anything()
    );
  });

  it('does not expose a workout list when the area locks during lookup', async () => {
    let finish: (value: unknown) => void = () => {};
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['start_workout'],
      action: { kind: 'startWorkout', said: 'start' },
    });
    mockFindWorkout.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { rerender } = renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(mockFindWorkout).toHaveBeenCalled());
    mockLock.locked = true;
    rerender(
      <VoiceCommandProvider>
        <Probe />
      </VoiceCommandProvider>
    );
    await act(async () =>
      finish({ kind: 'choose', workouts: [{ templateId: 'w', name: 'Push' }] })
    );
    expect(screen.queryByText('Push')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/app/workout/workouts');
  });

  it('closes a workout list and navigates when the area locks', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['start_workout'],
      action: { kind: 'startWorkout', said: 'start' },
    });
    mockFindWorkout.mockResolvedValue({
      kind: 'choose',
      workouts: [{ templateId: 'w', name: 'Push' }],
    });
    const { rerender } = renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(screen.getByText('Push')).toBeTruthy());
    mockLock.locked = true;
    rerender(
      <VoiceCommandProvider>
        <Probe />
      </VoiceCommandProvider>
    );
    expect(screen.queryByText('Push')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/app/workout/workouts');
  });

  it('ignores a workout lookup that finishes after cancellation', async () => {
    let finish: (value: unknown) => void = () => {};
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['start_workout'],
      action: { kind: 'startWorkout', said: 'start' },
    });
    mockFindWorkout.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(mockFindWorkout).toHaveBeenCalled());
    fireEvent.click(screen.getByText('modal-cancel'));
    await act(async () => finish({ kind: 'found', workout: { templateId: 'w', name: 'Push' } }));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it.each([false, true])('prefills cardio and handles close with saved %s', async (saved) => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['log_cardio'],
      action: { kind: 'logCardio', day: DAY, activity: 'walk', distanceM: 5000, durationS: null },
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('cardio'));
    const initial = JSON.parse(screen.getByTestId('cardio-initial').textContent ?? '{}');
    expect(initial).toEqual(
      expect.objectContaining({
        activity: 'walk',
        distanceM: 5000,
        durationS: null,
        endedAt: expect.any(String),
      })
    );
    const endedAt = new Date(initial.endedAt);
    expect([endedAt.getFullYear(), endedAt.getMonth(), endedAt.getDate()]).toEqual([
      DAY.getFullYear(),
      DAY.getMonth(),
      DAY.getDate(),
    ]);
    if (saved) fireEvent.click(screen.getByText('cardio-logged'));
    fireEvent.click(screen.getByText('cardio-close'));
    if (saved) expect(mockShowSnackbar).not.toHaveBeenCalled();
    else
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'success',
        'voiceInput.command.wrongTask',
        expect.anything()
      );
  });
  it('stores the action, opens the food diary and closes the modal on an action outcome', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['search_food'],
      action: { kind: 'searchFood', day: DAY, mealType: 'lunch', query: 'egg' },
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/nutrition/food'));
    expect(takePendingVoiceAction(['searchFood'])).toEqual(
      expect.objectContaining({ kind: 'searchFood', query: 'egg' })
    );
    expect(screen.getByTestId('modal-state').textContent).toBe('closed');
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('leaves a note pending for the notes screen and navigates there', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['add_note'],
      action: { kind: 'addNote', body: 'bought oats' },
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/notes'));
    expect(takePendingVoiceAction(['addNote'])).toEqual({
      kind: 'addNote',
      body: 'bought oats',
    });
    expect(takePendingVoiceAction(['searchFood'])).toBeNull();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('navigates to a screen at once and shows the wrong-task snackbar', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['go_to'],
      action: { kind: 'goTo', screen: 'progress' },
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/progress'));
    expect(screen.getByTestId('modal-state').textContent).toBe('closed');
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'success',
      'voiceInput.command.wrongTask',
      expect.objectContaining({ action: 'voiceInput.command.openAiSettings' })
    );
  });

  it('goes home through the home route', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['go_to'],
      action: { kind: 'goTo', screen: 'home' },
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app'));
  });

  it('opens the picker, and navigates nowhere, for cycle while cycle tracking is off', async () => {
    mockCycle.isActive = false;
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['go_to'],
      action: { kind: 'goTo', screen: 'cycle' },
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('pick'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('shows the weigh-in state for a logWeight action and writes nothing itself', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['log_weight'],
      action: { kind: 'logWeight', day: DAY, weightKg: 81.5 },
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('weight'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockLogTrackedMeal).not.toHaveBeenCalled();
  });

  it('starts the meal estimate for logMeal and then shows the review', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['log_meal'],
      action: { kind: 'logMeal', day: DAY, mealType: 'lunch', description: 'chicken and rice' },
    });
    mockEstimateMeal.mockImplementation(async ({ onEstimate }) => {
      onEstimate(REVIEW);
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('mealReview'));
    expect(mockEstimateMeal).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: 'chicken and rice' })
    );
    expect(mockLogTrackedMeal).not.toHaveBeenCalled();
  });

  it('closes the meal review without logging when the estimate fails', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['log_meal'],
      action: { kind: 'logMeal', day: DAY, mealType: 'lunch', description: 'soup' },
    });
    mockEstimateMeal.mockImplementation(async ({ onFailure }) => {
      onFailure();
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('closed'));
    expect(mockLogTrackedMeal).not.toHaveBeenCalled();
  });

  it('logs the reviewed meal through logTrackedMeal and opens the diary on its day', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['log_meal'],
      action: { kind: 'logMeal', day: DAY, mealType: 'lunch', description: 'oats' },
    });
    mockEstimateMeal.mockImplementation(async ({ onEstimate }) => {
      onEstimate(REVIEW);
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('mealReview'));

    await act(async () => {
      fireEvent.click(screen.getByText('modal-log-meal'));
    });

    expect(mockLogTrackedMeal).toHaveBeenCalledTimes(1);
    expect(mockLogTrackedMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: REVIEW.ingredients,
        mealType: 'lunch',
        portionGrams: 150,
        mealName: 'Oats',
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/app/nutrition/food',
      params: { date: '2026-11-26' },
    });
  });

  it('closes a meal review without logging and shows the wrong-task snackbar', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['log_meal'],
      action: { kind: 'logMeal', day: DAY, mealType: 'lunch', description: 'oats' },
    });
    mockEstimateMeal.mockImplementation(async ({ onEstimate }) => {
      onEstimate(REVIEW);
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('mealReview'));

    fireEvent.click(screen.getByText('modal-meal-close'));

    expect(mockLogTrackedMeal).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'success',
      'voiceInput.command.wrongTask',
      expect.anything()
    );
  });

  it('closes the weigh-in with saved and shows no wrong-task notice', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      offered: ['log_weight'],
      action: { kind: 'logWeight', day: DAY, weightKg: 80 },
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('weight'));

    fireEvent.click(screen.getByText('modal-weigh-saved'));

    expect(screen.getByTestId('modal-state').textContent).toBe('closed');
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it.each(['noAction', 'cantDetermine', 'missingFood', 'sourceNotEarlier', 'unreadable'])(
    'asks which tool was meant for %s',
    async (reason) => {
      mockInterpret.mockResolvedValue({ kind: 'rejected', reason, offered: ['copy_meal'] });
      renderProvider();

      fireEvent.click(screen.getByText('submit'));

      await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('pick'));
      expect(mockShowSnackbar).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(takePendingVoiceAction(['copyMeal'])).toBeNull();
    }
  );

  it('sends the same sentence again with the picked tool', async () => {
    mockInterpret.mockResolvedValueOnce({
      kind: 'rejected',
      reason: 'cantDetermine',
      offered: ['copy_meal'],
    });
    mockInterpret.mockResolvedValueOnce({
      kind: 'action',
      offered: ['copy_meal'],
      action: { kind: 'copyMeal', targetDay: DAY, sourceDay: null, meals: null },
    });
    renderProvider();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(screen.getByText('modal-pick')).toBeTruthy());

    fireEvent.click(screen.getByText('modal-pick'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockInterpret).toHaveBeenLastCalledWith(
      'same breakfast as yesterday',
      expect.objectContaining({ tool: 'copy_meal' })
    );
  });

  it('shows the generic failure snackbar when no provider can answer', async () => {
    mockInterpret.mockResolvedValue({ kind: 'unavailable' });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'error',
        'voiceInput.command.failed',
        SNACKBAR_OPTIONS
      )
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows an error snackbar when the request throws', async () => {
    mockInterpret.mockRejectedValue(new Error('boom'));
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'error',
        'voiceInput.command.failed',
        SNACKBAR_OPTIONS
      )
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('neither navigates nor shows a snackbar when the person cancels a pending request', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    mockInterpret.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    renderProvider();

    fireEvent.click(screen.getByText('submit'));
    expect(screen.getByTestId('modal-state').textContent).toBe('working');

    fireEvent.click(screen.getByText('modal-cancel'));
    expect(screen.getByTestId('modal-state').textContent).toBe('closed');

    await act(async () => {
      resolveRequest({
        kind: 'action',
        offered: ['search_food'],
        action: {
          kind: 'searchFood',
          day: DAY,
          mealType: 'lunch',
          query: 'egg',
        },
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(takePendingVoiceAction(['searchFood'])).toBeNull();
  });
});
