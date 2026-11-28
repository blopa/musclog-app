import { act, fireEvent, render, screen } from '@testing-library/react';

import { VoiceListeningOverlay } from '@/components/navigation/VoiceListeningOverlay';
import { VoiceWaveform } from '@/components/navigation/VoiceWaveform';
import { VOICE_CAPTION_MAX_CHARS, voiceCaption } from '@/utils/voiceInput';
import { createVoiceLevelMeter, WAVEFORM_TICK_MS } from '@/utils/voiceLevel';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('lucide-react-native', () => ({
  ChevronDown: () => null,
  ChevronUp: () => null,
  Lock: () => null,
  Trash2: () => null,
}));
jest.mock('@/hooks/useAppSafeAreaInsets', () => ({
  useAppSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const anim = { duration: () => ({}) };
  return {
    __esModule: true,
    default: { View },
    FadeIn: anim,
    FadeOut: anim,
  };
});
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

const baseProps = {
  level: createVoiceLevelMeter(),
  frameHeight: 800,
  bottomOffset: 0,
  buttonTop: 100,
  locked: false,
  drag: { lock: 0, cancel: 0, action: null },
  onCancel: jest.fn(),
};

describe('VoiceListeningOverlay', () => {
  it('prompts while listening with nothing heard yet', () => {
    render(<VoiceListeningOverlay {...baseProps} phase="listening" liveText="" />);

    expect(screen.getByText('voiceInput.listening')).toBeTruthy();
    expect(screen.getByText('voiceInput.overlay.releaseHint')).toBeTruthy();
  });

  it('shows what is being heard instead of the prompt', () => {
    render(
      <VoiceListeningOverlay
        {...baseProps}
        phase="listening"
        liveText="I want to track a banana."
      />
    );

    expect(screen.getByText('I want to track a banana.')).toBeTruthy();
    expect(screen.queryByText('voiceInput.listening')).toBeNull();
  });

  it('says where to slide while held', () => {
    render(<VoiceListeningOverlay {...baseProps} phase="listening" liveText="" />);

    expect(screen.getByText('voiceInput.overlay.slideUpToLock')).toBeTruthy();
    expect(screen.getByText('voiceInput.overlay.slideDownToCancel')).toBeTruthy();
    expect(screen.queryByLabelText('common.cancel')).toBeNull();
  });

  it('offers a cancel button once locked', () => {
    const onCancel = jest.fn();
    render(
      <VoiceListeningOverlay
        {...baseProps}
        phase="listening"
        liveText=""
        locked
        onCancel={onCancel}
      />
    );

    expect(screen.queryByText('voiceInput.overlay.slideUpToLock')).toBeNull();
    expect(screen.getByText('voiceInput.overlay.lockedHint')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('common.cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('says it is finishing once let go', () => {
    render(<VoiceListeningOverlay {...baseProps} phase="finishing" liveText="" />);

    expect(screen.getByText('voiceInput.overlay.finishing')).toBeTruthy();
    expect(screen.queryByText('voiceInput.overlay.releaseHint')).toBeNull();
  });

  it('shows the newest words of a long dictation', () => {
    const long = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
    expect(long.length).toBeGreaterThan(VOICE_CAPTION_MAX_CHARS);
    const caption = voiceCaption(long);

    render(<VoiceListeningOverlay {...baseProps} phase="listening" liveText={long} />);

    expect(caption.startsWith('…')).toBe(true);
    expect(screen.getByText(caption)).toBeTruthy();
  });
});

describe('VoiceWaveform', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const barHeights = (container: HTMLElement) => {
    const bars = Array.from(container.querySelectorAll<HTMLElement>('div[style*="height"]')).filter(
      (el) => el.parentElement?.children.length === 32
    );
    return bars.map((el) => parseFloat(el.style.height));
  };

  it('scrolls the newest level in on the right while running', () => {
    const level = createVoiceLevelMeter();
    const { container } = render(<VoiceWaveform level={level} running color="#fff" />);
    const before = barHeights(container);
    expect(before).toHaveLength(32);

    level.push(1);
    act(() => {
      jest.advanceTimersByTime(WAVEFORM_TICK_MS);
    });

    const after = barHeights(container);
    expect(after[31]).toBeGreaterThan(after[0]);
  });

  it('stands still when not running', () => {
    const level = createVoiceLevelMeter();
    const { container } = render(<VoiceWaveform level={level} running={false} color="#fff" />);
    const before = barHeights(container);

    level.push(1);
    act(() => {
      jest.advanceTimersByTime(WAVEFORM_TICK_MS * 5);
    });

    expect(barHeights(container)).toEqual(before);
  });
});
