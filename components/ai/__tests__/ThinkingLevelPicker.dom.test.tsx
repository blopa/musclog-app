import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ThinkingLevelPicker } from '@/components/ai/ThinkingLevelPicker';
import { authenticateForDangerousAction } from '@/utils/dangerousActionAuth';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/components/theme/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
jest.mock('@/utils/dangerousActionAuth', () => ({ authenticateForDangerousAction: jest.fn() }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

const auth = authenticateForDangerousAction as jest.Mock;
const P = 'settings.aiSettings.thinkingLevel';

describe('ThinkingLevelPicker', () => {
  beforeEach(() => auth.mockReset());

  it('shows the current level name', () => {
    render(<ThinkingLevelPicker value="medium" onChange={jest.fn()} provider="openai" />);

    expect(screen.getByText(`${P}.levels.medium.name`)).toBeTruthy();
  });

  it('is disabled with the free tier note on the free tier', () => {
    const onChange = jest.fn();
    render(<ThinkingLevelPicker value="off" onChange={onChange} provider="gateway" />);

    expect(screen.getByText(`${P}.freeTierNote`)).toBeTruthy();
    fireEvent.click(screen.getByTestId('thinking-level-row'));
    expect(screen.queryByTestId('thinking-level-high')).toBeNull();
  });

  it('shows the on-device note', () => {
    render(<ThinkingLevelPicker value="off" onChange={jest.fn()} provider="on-device" />);

    expect(screen.getByText(new RegExp(`${P}.onDeviceNote`))).toBeTruthy();
  });

  it('writes a pick at once on a own-key provider', () => {
    const onChange = jest.fn();
    render(<ThinkingLevelPicker value="off" onChange={onChange} provider="openai" />);

    fireEvent.click(screen.getByTestId('thinking-level-row'));
    fireEvent.click(screen.getByTestId('thinking-level-tokenmaxxing'));

    expect(onChange).toHaveBeenCalledWith('tokenmaxxing');
    expect(auth).not.toHaveBeenCalled();
  });

  it('asks for a note, without authentication, before High on Musclog Iron', async () => {
    const onChange = jest.fn();
    render(<ThinkingLevelPicker value="medium" onChange={onChange} provider="hosted" />);

    fireEvent.click(screen.getByTestId('thinking-level-row'));
    fireEvent.click(screen.getByTestId('thinking-level-high'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(`${P}.confirmHigh.confirm`));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('high'));
    expect(auth).not.toHaveBeenCalled();
  });

  it('asks for authentication before Tokenmaxxing on Musclog Iron and stops when it fails', async () => {
    auth.mockResolvedValue(false);
    const onChange = jest.fn();
    render(<ThinkingLevelPicker value="high" onChange={onChange} provider="hosted" />);

    fireEvent.click(screen.getByTestId('thinking-level-row'));
    fireEvent.click(screen.getByTestId('thinking-level-tokenmaxxing'));
    fireEvent.click(screen.getByText(`${P}.confirmTokenmaxxing.confirm`));

    await waitFor(() => expect(auth).toHaveBeenCalledWith(`${P}.confirmTokenmaxxing.authPrompt`));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('writes Tokenmaxxing once authentication passes', async () => {
    auth.mockResolvedValue(true);
    const onChange = jest.fn();
    render(<ThinkingLevelPicker value="high" onChange={onChange} provider="hosted" />);

    fireEvent.click(screen.getByTestId('thinking-level-row'));
    fireEvent.click(screen.getByTestId('thinking-level-tokenmaxxing'));
    fireEvent.click(screen.getByText(`${P}.confirmTokenmaxxing.confirm`));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('tokenmaxxing'));
  });
});
