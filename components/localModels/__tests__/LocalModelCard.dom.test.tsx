import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LocalModelCard } from '@/components/localModels/LocalModelCard';

let mockModel: Record<string, unknown> = {};
const mockStart = jest.fn();
const mockPause = jest.fn();
const mockFreeBytes = jest.fn();

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: () => Promise.resolve({ type: 'wifi' }) },
}));
jest.mock('@/hooks/useLocalModel', () => ({ useLocalModel: () => mockModel }));
jest.mock('@/hooks/useStorageSizeFormatter', () => ({
  useStorageSizeFormatter: () => (bytes: number) => `${bytes}B`,
}));
jest.mock('@/services/localModels/modelStore', () => ({
  cancelLocalModelDownload: jest.fn(),
  deleteLocalModel: jest.fn(),
  getFreeDiskBytes: () => mockFreeBytes(),
  getLocalModelSpaceCheck: async (selection: unknown) => {
    const { checkSpace } = require('@/utils/localModels/install');
    const { DEFAULT_LOCAL_MODEL } = require('@/constants/localModels');
    return checkSpace(await mockFreeBytes(), DEFAULT_LOCAL_MODEL, selection);
  },
  pauseLocalModelDownload: () => mockPause(),
  resumeLocalModelDownload: jest.fn(),
  startLocalModelDownload: (selection: unknown) => mockStart(selection),
}));
jest.mock('@/components/modals/ConfirmationModal', () => ({ ConfirmationModal: () => null }));
jest.mock('@/components/theme/ToggleInput', () => ({ ToggleInput: () => null }));
jest.mock('@/components/theme/TextButton', () => ({
  TextButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
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

const selection = { withProjector: true };

describe('LocalModelCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFreeBytes.mockResolvedValue(50 * 1024 ** 3);
    mockModel = {
      state: { kind: 'notInstalled' },
      projectorInstalled: false,
      updateAvailable: false,
    };
  });

  it('offers the download and starts it with the chosen selection', async () => {
    render(<LocalModelCard selection={selection} />);
    fireEvent.click(await screen.findByText('onDeviceAi.model.actions.download'));
    expect(mockStart).toHaveBeenCalledWith(selection);
  });

  it('disables the download when the phone has no room', async () => {
    mockFreeBytes.mockResolvedValue(1024);
    render(<LocalModelCard selection={selection} />);
    await screen.findByText('onDeviceAi.model.notEnoughSpace');
    expect(
      (screen.getByText('onDeviceAi.model.actions.download') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('shows no download button when the screen owns it', async () => {
    render(<LocalModelCard selection={selection} hideDownloadButton />);
    await waitFor(() => expect(mockFreeBytes).toHaveBeenCalled());
    expect(screen.queryByText('onDeviceAi.model.actions.download')).toBeNull();
  });

  it('shows progress with pause and cancel while downloading', () => {
    mockModel = {
      state: { kind: 'downloading', receivedBytes: 50, totalBytes: 100 },
      projectorInstalled: false,
      updateAvailable: false,
    };
    render(<LocalModelCard selection={selection} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    fireEvent.click(screen.getByText('onDeviceAi.model.actions.pause'));
    expect(mockPause).toHaveBeenCalled();
    expect(screen.getByText('onDeviceAi.model.actions.cancel')).toBeTruthy();
  });

  it('says why a download failed and offers a retry', async () => {
    mockModel = {
      state: { kind: 'failed', reason: 'checksum' },
      projectorInstalled: false,
      updateAvailable: false,
    };
    render(<LocalModelCard selection={selection} />);
    expect(screen.getByRole('alert').textContent).toBe('onDeviceAi.model.failure.checksum');
    expect(await screen.findByText('onDeviceAi.model.actions.retry')).toBeTruthy();
  });

  it('offers delete only where the screen allows it', () => {
    mockModel = { state: { kind: 'ready' }, projectorInstalled: true, updateAvailable: false };
    const { rerender } = render(<LocalModelCard selection={selection} />);
    expect(screen.queryByText('onDeviceAi.model.actions.delete')).toBeNull();
    rerender(<LocalModelCard selection={selection} allowDelete />);
    expect(screen.getByText('onDeviceAi.model.actions.delete')).toBeTruthy();
    expect(screen.getByText('onDeviceAi.model.state.readyWithPhotos')).toBeTruthy();
  });
});
