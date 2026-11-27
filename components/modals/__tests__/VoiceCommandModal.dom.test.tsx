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
jest.mock('@/components/theme/ListRow', () => ({
  ListRow: ({
    title,
    subtitle,
    onPress,
  }: {
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <button onClick={onPress}>
      <span>{title}</span>
      <span>{subtitle}</span>
    </button>
  ),
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));

const TRANSCRIPT = 'copy my breakfast from yesterday';

function renderModal(state: Parameters<typeof VoiceCommandModal>[0]['state']) {
  const onCancel = jest.fn();
  const onPickTool = jest.fn();
  const onAskCoach = jest.fn();
  const utils = render(
    <VoiceCommandModal
      state={state}
      onCancel={onCancel}
      onAskCoach={onAskCoach}
      onPickTool={onPickTool}
    />
  );

  return { ...utils, onCancel, onAskCoach, onPickTool };
}

describe('VoiceCommandModal', () => {
  it('renders nothing when there is no state', () => {
    const { container } = renderModal(null);

    expect(container.innerHTML).toBe('');
  });

  it('shows the transcript while working and cancels through onCancel', () => {
    const { onCancel } = renderModal({ kind: 'working', transcript: TRANSCRIPT });

    expect(screen.getByText(TRANSCRIPT)).toBeTruthy();
    expect(screen.getByText('voiceInput.command.workingTitle')).toBeTruthy();
    fireEvent.click(screen.getByText('common.cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('lists every tool and reports the picked one with the transcript', () => {
    const { onPickTool } = renderModal({ kind: 'pick', transcript: TRANSCRIPT });

    expect(screen.getByText(TRANSCRIPT)).toBeTruthy();
    expect(screen.getByText('voiceInput.command.pickTitle')).toBeTruthy();
    expect(screen.getByText('voiceInput.command.tool.searchFood')).toBeTruthy();
    fireEvent.click(screen.getByText('voiceInput.command.tool.copyMeal'));

    expect(onPickTool).toHaveBeenCalledWith(TRANSCRIPT, 'copy_meal');
  });

  it('hands the transcript to the coach on Ask coach, and closes on Cancel', () => {
    const { onAskCoach, onCancel } = renderModal({ kind: 'pick', transcript: TRANSCRIPT });

    fireEvent.click(screen.getByText('voiceInput.command.askCoach'));
    expect(onAskCoach).toHaveBeenCalledWith(TRANSCRIPT);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
