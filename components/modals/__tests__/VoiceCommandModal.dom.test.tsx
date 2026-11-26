import { fireEvent, render, screen } from '@testing-library/react';

import { VoiceCommandModal } from '@/components/modals/VoiceCommandModal';

jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/components/modals/CenteredModal', () => ({
  CenteredModal: ({
    visible,
    title,
    footer,
    children,
  }: {
    visible: boolean;
    title: string;
    footer: React.ReactNode;
    children: React.ReactNode;
  }) =>
    visible ? (
      <div>
        <h2>{title}</h2>
        {children}
        {footer}
      </div>
    ) : null,
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));

const TRANSCRIPT = 'copy my breakfast from yesterday';

function renderModal(state: Parameters<typeof VoiceCommandModal>[0]['state']) {
  const onCancel = jest.fn();
  const onClose = jest.fn();
  const onAskCoach = jest.fn();
  const utils = render(
    <VoiceCommandModal
      state={state}
      onCancel={onCancel}
      onClose={onClose}
      onAskCoach={onAskCoach}
    />
  );

  return { ...utils, onCancel, onClose, onAskCoach };
}

describe('VoiceCommandModal', () => {
  it('renders nothing when there is no state', () => {
    const { container } = renderModal(null);

    expect(container.innerHTML).toBe('');
  });

  it('shows the transcript while working and cancels through onCancel', () => {
    const { onCancel, onClose } = renderModal({ kind: 'working', transcript: TRANSCRIPT });

    expect(screen.getByText(TRANSCRIPT)).toBeTruthy();
    expect(screen.getByText('voiceInput.command.workingTitle')).toBeTruthy();
    fireEvent.click(screen.getByText('common.cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the transcript and what voice can do when the sentence matched nothing', () => {
    renderModal({ kind: 'unmatched', transcript: TRANSCRIPT });

    expect(screen.getByText(TRANSCRIPT)).toBeTruthy();
    expect(screen.getByText('voiceInput.command.unmatchedTitle')).toBeTruthy();
    expect(screen.getByText('voiceInput.command.canSay')).toBeTruthy();
    expect(screen.getByText('voiceInput.command.capability.copyMeal')).toBeTruthy();
    expect(screen.getByText('voiceInput.command.capability.searchFood')).toBeTruthy();
  });

  it('hands the transcript to the coach on Ask coach', () => {
    const { onAskCoach, onClose } = renderModal({ kind: 'unmatched', transcript: TRANSCRIPT });

    fireEvent.click(screen.getByText('voiceInput.command.askCoach'));

    expect(onAskCoach).toHaveBeenCalledWith(TRANSCRIPT);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes through onClose on OK', () => {
    const { onClose, onCancel } = renderModal({ kind: 'unmatched', transcript: TRANSCRIPT });

    fireEvent.click(screen.getByText('common.ok'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
