import { fireEvent, render, screen } from '@testing-library/react';
import { Linking, Platform } from 'react-native';

import { VoiceTranscriptModal } from '@/components/modals/VoiceTranscriptModal';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/utils/webPhoneFrame', () => ({ useWebModalLayerStyle: () => ({}) }));
jest.mock('@/components/theme/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div>{children}</div> : null,
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

const originalOS = Platform.OS;

function setOS(os: string) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

function renderModal(outcome: React.ComponentProps<typeof VoiceTranscriptModal>['outcome']) {
  const onClose = jest.fn();
  const onDownloadLanguage = jest.fn();
  const onAllowBrowser = jest.fn();

  render(
    <VoiceTranscriptModal
      outcome={outcome}
      onClose={onClose}
      onDownloadLanguage={onDownloadLanguage}
      onAllowBrowser={onAllowBrowser}
    />
  );

  return { onClose, onDownloadLanguage, onAllowBrowser };
}

describe('VoiceTranscriptModal', () => {
  afterEach(() => {
    setOS(originalOS);
    jest.restoreAllMocks();
  });

  it('shows the transcript and closes with OK', () => {
    const { onClose } = renderModal({ kind: 'text', text: 'two eggs and toast' });

    expect(screen.getByText('voiceInput.resultTitle')).toBeTruthy();
    expect(screen.getByText('two eggs and toast')).toBeTruthy();

    fireEvent.click(screen.getByText('common.ok'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers Open settings for a denied microphone and opens the system settings', () => {
    setOS('ios');
    const openSettings = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(Linking, 'openSettings', { configurable: true, value: openSettings });
    const { onClose } = renderModal({ kind: 'failure', failure: 'permission' });

    expect(screen.getByText('voiceInput.failure.permission.title')).toBeTruthy();

    fireEvent.click(screen.getByText('voiceInput.openSettings'));

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers Download language for a missing language on Android only', () => {
    setOS('android');
    const { onDownloadLanguage } = renderModal({ kind: 'failure', failure: 'languageMissing' });

    expect(screen.getByText('voiceInput.failure.languageMissing.messageAndroid')).toBeTruthy();
    fireEvent.click(screen.getByText('voiceInput.downloadLanguage'));

    expect(onDownloadLanguage).toHaveBeenCalledTimes(1);
  });

  it('shows no download action for a missing language on iOS', () => {
    setOS('ios');
    renderModal({ kind: 'failure', failure: 'languageMissing' });

    expect(screen.getByText('voiceInput.failure.languageMissing.messageIos')).toBeTruthy();
    expect(screen.queryByText('voiceInput.downloadLanguage')).toBeNull();
    expect(screen.getByText('common.ok')).toBeTruthy();
  });

  it('offers Not now and Allow for the browser notice, and no OK', () => {
    const { onClose, onAllowBrowser } = renderModal({
      kind: 'failure',
      failure: 'browserNotice',
    });

    expect(screen.getByText('voiceInput.failure.browserNotice.title')).toBeTruthy();
    expect(screen.queryByText('common.ok')).toBeNull();

    fireEvent.click(screen.getByText('voiceInput.notNow'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('voiceInput.allow'));
    expect(onAllowBrowser).toHaveBeenCalledTimes(1);
  });

  it('shows the web permission message and no Open settings button on web', () => {
    setOS('web');
    renderModal({ kind: 'failure', failure: 'permission' });

    expect(screen.getByText('voiceInput.failure.permission.messageWeb')).toBeTruthy();
    expect(screen.queryByText('voiceInput.openSettings')).toBeNull();
  });

  it('uses the web titles and messages for unavailable and language failures on web', () => {
    setOS('web');
    const { unmount } = render(
      <VoiceTranscriptModal
        outcome={{ kind: 'failure', failure: 'unavailable' }}
        onClose={jest.fn()}
        onDownloadLanguage={jest.fn()}
        onAllowBrowser={jest.fn()}
      />
    );
    expect(screen.getByText('voiceInput.failure.unavailable.titleWeb')).toBeTruthy();
    expect(screen.getByText('voiceInput.failure.unavailable.messageWeb')).toBeTruthy();
    unmount();

    renderModal({ kind: 'failure', failure: 'languageMissing' });
    expect(screen.getByText('voiceInput.failure.languageMissing.titleWeb')).toBeTruthy();
    expect(screen.getByText('voiceInput.failure.languageMissing.messageWeb')).toBeTruthy();
  });

  it('renders nothing while there is no outcome', () => {
    renderModal(null);

    expect(screen.queryByText('common.ok')).toBeNull();
  });
});
