import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { VoiceCommandProvider, useVoiceCommands } from '@/context/VoiceCommandContext';
import { interpretVoiceCommand } from '@/services/voiceCommand';
import { takePendingVoiceAction } from '@/utils/voiceCommand/voiceActionInbox';

const mockNavigate = jest.fn();
const mockShowSnackbar = jest.fn();
const mockOpenCoach = jest.fn();

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
  useSettings: () => ({ isAiConfigured: true, aiProvider: 'gemini' }),
}));
jest.mock('@/hooks/useOnDeviceStatus', () => ({ useOnDeviceStatus: () => ({ state: 'ready' }) }));
jest.mock('@/components/navigation/navDestinations', () => ({
  NAV_DESTINATIONS: { food: { route: '/app/nutrition/food' } },
}));
jest.mock('@/services/voiceCommand', () => ({ interpretVoiceCommand: jest.fn() }));
// The modal is covered by its own test: here it only shows which state the provider holds.
jest.mock('@/components/modals/VoiceCommandModal', () => ({
  VoiceCommandModal: ({
    state,
    onCancel,
  }: {
    state: { kind: string } | null;
    onCancel: () => void;
  }) => (
    <div>
      <span data-testid="modal-state">{state?.kind ?? 'closed'}</span>
      {state ? <button onClick={onCancel}>modal-cancel</button> : null}
    </div>
  ),
}));

const mockInterpret = interpretVoiceCommand as jest.Mock;

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
  takePendingVoiceAction();
});

describe('VoiceCommandProvider', () => {
  it('stores the action, opens the food diary and closes the modal on an action outcome', async () => {
    mockInterpret.mockResolvedValue({
      kind: 'action',
      action: { kind: 'searchFood', day: new Date(2026, 10, 26), mealType: 'lunch', query: 'egg' },
    });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/app/nutrition/food'));
    expect(takePendingVoiceAction()).toEqual(
      expect.objectContaining({ kind: 'searchFood', query: 'egg' })
    );
    expect(screen.getByTestId('modal-state').textContent).toBe('closed');
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it.each([
    ['cantDetermine', 'voiceInput.command.rejection.cantDetermine'],
    ['missingFood', 'voiceInput.command.rejection.missingFood'],
    ['sourceNotEarlier', 'voiceInput.command.rejection.sourceNotEarlier'],
    ['unreadable', 'voiceInput.command.rejection.unreadable'],
  ])('shows an error snackbar and does not navigate for %s', async (reason, key) => {
    mockInterpret.mockResolvedValue({ kind: 'rejected', reason });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith('error', key, SNACKBAR_OPTIONS)
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(takePendingVoiceAction()).toBeNull();
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

  it('opens the unmatched modal for noAction without a snackbar', async () => {
    mockInterpret.mockResolvedValue({ kind: 'rejected', reason: 'noAction' });
    renderProvider();

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => expect(screen.getByTestId('modal-state').textContent).toBe('unmatched'));
    expect(mockShowSnackbar).not.toHaveBeenCalled();
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
        action: {
          kind: 'searchFood',
          day: new Date(2026, 10, 26),
          mealType: 'lunch',
          query: 'egg',
        },
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(takePendingVoiceAction()).toBeNull();
  });
});
