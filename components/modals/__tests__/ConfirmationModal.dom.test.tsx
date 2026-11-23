import { fireEvent, render, screen } from '@testing-library/react';

import { ConfirmationModal } from '@/components/modals/ConfirmationModal';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
// jsdom has no layout, so the real hook never sees an overflow: stand in for its cue.
jest.mock('@/hooks/useScrollFade', () => ({
  useScrollFade: () => ({
    scrollProps: {},
    FadeIndicator: <div data-testid="scroll-cue" />,
    scrollRef: { current: null },
  }),
}));
jest.mock('@/utils/webPhoneFrame', () => ({ useWebModalLayerStyle: () => ({}) }));
jest.mock('@/components/theme/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div>{children}</div> : null,
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

const LONG_MESSAGE = 'A long consent message. '.repeat(60);

function renderDialog(scrollable?: boolean) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();

  render(
    <ConfirmationModal
      visible
      onClose={onClose}
      onConfirm={onConfirm}
      title="Dialog title"
      message={LONG_MESSAGE}
      confirmLabel="Agree"
      cancelLabel="Not now"
      scrollable={scrollable}
    />
  );

  return { onConfirm, onClose };
}

describe('ConfirmationModal', () => {
  it('keeps the message in a scroll container, and the title and both buttons outside it, when scrollable', () => {
    renderDialog(true);

    const scroller = screen.getByTestId('confirmation-modal-scroll');

    expect(scroller.textContent).toContain('A long consent message.');
    // The title and the buttons must stay on screen while the message scrolls.
    expect(scroller.contains(screen.getByText('Dialog title'))).toBe(false);
    expect(scroller.contains(screen.getByText('Agree'))).toBe(false);
    expect(scroller.contains(screen.getByText('Not now'))).toBe(false);
  });

  it('shows the scroll cue with the scrolling message, so text under the buttons is not mistaken for cut off', () => {
    renderDialog(true);

    const scroller = screen.getByTestId('confirmation-modal-scroll');
    const cue = screen.getByTestId('scroll-cue');

    // The cue is a sibling of the scroller (drawn over the scroll area), never over the buttons.
    expect(cue.parentElement).toBe(scroller.parentElement);
    expect(cue.contains(screen.getByText('Agree'))).toBe(false);
  });

  it('draws no scroll container or cue by default, so every other dialog keeps its layout', () => {
    renderDialog();

    expect(screen.queryByTestId('confirmation-modal-scroll')).toBeNull();
    expect(screen.queryByTestId('scroll-cue')).toBeNull();
    expect(screen.getByText('Agree')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();
  });

  it('still confirms and cancels in scrollable mode', async () => {
    const { onConfirm, onClose } = renderDialog(true);

    fireEvent.click(screen.getByText('Not now'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Agree'));
    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
