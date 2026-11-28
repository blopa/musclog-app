import { render, screen } from '@testing-library/react';

import { OnDeviceAiSection } from '@/components/settings/OnDeviceAiSection';

let mockMemory: number | null = 8e9;
let mockStatus: Record<string, unknown> = {};
let mockMain: Record<string, unknown> = {};
let mockText: Record<string, unknown> = {};

jest.mock('expo-device', () => ({
  get totalMemory() {
    return mockMemory;
  },
  supportedCpuArchitectures: ['arm64-v8a'],
}));
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');

  return Object.assign({}, rn, { Platform: { ...rn.Platform, OS: 'android' } });
});
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ useOnDeviceAi: true }) }));
jest.mock('@/hooks/useOnDeviceStatus', () => ({ useOnDeviceStatus: () => mockStatus }));
jest.mock('@/hooks/useLocalModel', () => ({
  useLocalModel: (store?: { isText?: boolean }) => (store?.isText ? mockText : mockMain),
}));
jest.mock('@/services/localModels/modelStore', () => ({
  localModelStore: { isText: false },
  localTextModelStore: { isText: true },
}));
jest.mock('@/services/onDeviceAiSetup', () => ({
  disableOnDeviceAi: jest.fn(),
  enableOnDeviceAi: jest.fn(),
  setOnDeviceEngine: jest.fn(),
}));
jest.mock('@/components/localModels/AppleIntelligenceStatus', () => ({
  AppleIntelligenceStatus: () => <div>apple-status</div>,
}));
jest.mock('@/components/localModels/LocalModelCard', () => ({
  LocalModelCard: ({ variant = 'main' }: { variant?: string }) => <div>{`card-${variant}`}</div>,
}));
jest.mock('@/components/theme/SegmentedControl', () => ({ SegmentedControl: () => null }));
jest.mock('@/components/theme/ToggleInput', () => ({ ToggleInput: () => null }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

const snapshot = (kind: string, supported = true) => ({
  supported,
  state: { kind },
  projectorInstalled: false,
  updateAvailable: false,
});

describe('OnDeviceAiSection text model card', () => {
  beforeEach(() => {
    mockMemory = 8e9;
    mockStatus = { engine: 'gguf', options: { apple: false, model: true }, appleState: 'x' };
    mockMain = snapshot('ready');
    mockText = snapshot('notInstalled');
  });

  it('offers the chat model once the main one is ready on a phone with enough RAM', () => {
    render(<OnDeviceAiSection hostedProviderActive={false} />);
    expect(screen.getByText('card-main')).toBeTruthy();
    expect(screen.getByText('card-text')).toBeTruthy();
  });

  it('hides it on a 6 GB phone', () => {
    mockMemory = 5.6e9;
    render(<OnDeviceAiSection hostedProviderActive={false} />);
    expect(screen.queryByText('card-text')).toBeNull();
  });

  it('keeps an installed one reachable on a 6 GB phone', () => {
    mockMemory = 5.6e9;
    mockText = snapshot('ready');
    render(<OnDeviceAiSection hostedProviderActive={false} />);
    expect(screen.getByText('card-text')).toBeTruthy();
  });

  it('hides it until the main model is ready', () => {
    mockMain = snapshot('notInstalled');
    render(<OnDeviceAiSection hostedProviderActive={false} />);
    expect(screen.queryByText('card-text')).toBeNull();
  });

  it('hides it when the text store is unsupported', () => {
    mockText = snapshot('notInstalled', false);
    render(<OnDeviceAiSection hostedProviderActive={false} />);
    expect(screen.queryByText('card-text')).toBeNull();
  });

  it('hides it for the Apple engine', () => {
    mockStatus = { engine: 'apple', options: { apple: true, model: true }, appleState: 'x' };
    render(<OnDeviceAiSection hostedProviderActive={false} />);
    expect(screen.queryByText('card-text')).toBeNull();
  });
});
