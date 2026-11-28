import { fireEvent, render, screen } from '@testing-library/react';
import { Linking } from 'react-native';

import { AiOutputNotice } from '@/components/ai/AiOutputNotice';
import {
  AI_DISCLAIMER_POINT_KEYS,
  AI_OUTPUT_NOTICE_KEYS,
  type AiOutputKind,
} from '@/components/ai/aiOutputNoticeCopy';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/utils/webPhoneFrame', () => ({ useWebModalLayerStyle: () => ({}) }));
jest.mock('@/components/theme/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div>{children}</div> : null,
}));
jest.mock('@/components/theme/TextButton', () => ({
  TextButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

const KINDS = Object.keys(AI_OUTPUT_NOTICE_KEYS) as AiOutputKind[];

describe('AiOutputNotice', () => {
  it.each(KINDS)('renders the %s line', (kind) => {
    render(<AiOutputNotice kind={kind} />);

    expect(screen.getByText(AI_OUTPUT_NOTICE_KEYS[kind])).toBeTruthy();
    expect(screen.queryByText('ai.disclaimer.title')).toBeNull();
  });

  it('opens the sheet with every point when pressed', () => {
    render(<AiOutputNotice kind="chat" testID="notice" />);

    fireEvent.click(screen.getByTestId('notice'));

    expect(screen.getByText('ai.disclaimer.title')).toBeTruthy();
    for (const key of AI_DISCLAIMER_POINT_KEYS) {
      expect(screen.getByText(key)).toBeTruthy();
    }
  });

  it('opens the terms page', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<AiOutputNotice kind="plan" testID="notice" />);

    fireEvent.click(screen.getByTestId('notice'));
    fireEvent.click(screen.getByText('ai.disclaimer.readTerms'));

    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toMatch(/\/terms$/);
    open.mockRestore();
  });
});
