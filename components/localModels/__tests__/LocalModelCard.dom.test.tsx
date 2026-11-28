import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LocalModelCard } from '@/components/localModels/LocalModelCard';
import { localTextModelStore } from '@/services/localModels/modelStore';

let mockModel: Record<string, unknown> = {};
const mockStart = jest.fn();
const mockPause = jest.fn();
const mockFreeBytes = jest.fn();

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: () => Promise.resolve({ type: 'wifi' }) },
}));
let mockTextModel: Record<string, unknown> = {};
const mockRemove = jest.fn();
const mockDeleteBoth = jest.fn();
jest.mock('@/hooks/useLocalModel', () => ({
  useLocalModel: (store?: { isText?: boolean }) => (store?.isText ? mockTextModel : mockModel),
}));
jest.mock('@/hooks/useStorageSizeFormatter', () => ({
  useStorageSizeFormatter: () => (bytes: number) => `${bytes}B`,
}));
jest.mock('@/services/localModels/modelStore', () => {
  const { DEFAULT_LOCAL_MODEL, LOCAL_TEXT_MODEL } = require('@/constants/localModels');
  const { checkSpace } = require('@/utils/localModels/install');
  const makeStore = (manifest: unknown, isText: boolean) => ({
    isText,
    manifest,
    getSpaceCheck: async (selection: unknown) =>
      checkSpace(await mockFreeBytes(), manifest, selection),
    start: (selection: unknown) => mockStart(selection),
    pause: () => mockPause(),
    resume: jest.fn(),
    cancel: jest.fn(),
    remove: () => mockRemove(),
  });

  return {
    getFreeDiskBytes: () => mockFreeBytes(),
    deleteLocalModel: () => mockDeleteBoth(),
    localModelStore: makeStore(DEFAULT_LOCAL_MODEL, false),
    localTextModelStore: makeStore(LOCAL_TEXT_MODEL, true),
  };
});
jest.mock('@/components/modals/ConfirmationModal', () => ({
  ConfirmationModal: ({
    visible,
    message,
    title,
    onConfirm,
  }: {
    visible: boolean;
    message: string;
    title: string;
    onConfirm: () => void;
  }) =>
    visible ? (
      <div>
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={onConfirm}>confirm-delete</button>
      </div>
    ) : null,
}));
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
    mockTextModel = {
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

  it('shows the text variant with its heading, description and no photos toggle', async () => {
    mockTextModel = {
      state: { kind: 'ready' },
      projectorInstalled: false,
      updateAvailable: false,
    };
    render(
      <LocalModelCard
        store={localTextModelStore}
        variant="text"
        selection={{ withProjector: false }}
        onSelectionChange={jest.fn()}
        allowDelete
      />
    );
    expect(screen.getByText('onDeviceAi.textModel.heading')).toBeTruthy();
    expect(screen.getByText('onDeviceAi.textModel.description')).toBeTruthy();
    expect(screen.getByText('onDeviceAi.textModel.state.ready')).toBeTruthy();
    expect(screen.queryByText('onDeviceAi.model.state.readyText')).toBeNull();
    fireEvent.click(screen.getByText('onDeviceAi.textModel.actions.delete'));
    expect(screen.getByText('onDeviceAi.textModel.delete.title')).toBeTruthy();
    expect(screen.getByText('onDeviceAi.textModel.delete.message')).toBeTruthy();
    fireEvent.click(screen.getByText('confirm-delete'));
    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    expect(mockDeleteBoth).not.toHaveBeenCalled();
  });

  it('downloads the text model through its own store', async () => {
    render(
      <LocalModelCard
        store={localTextModelStore}
        variant="text"
        selection={{ withProjector: false }}
      />
    );
    fireEvent.click(await screen.findByText('onDeviceAi.model.actions.download'));
    expect(mockStart).toHaveBeenCalledWith({ withProjector: false });
  });

  it('warns that the chat model goes too when the main model is deleted', () => {
    mockModel = { state: { kind: 'ready' }, projectorInstalled: true, updateAvailable: false };
    mockTextModel = { state: { kind: 'ready' }, projectorInstalled: false, updateAvailable: false };
    render(<LocalModelCard selection={selection} allowDelete />);
    fireEvent.click(screen.getByText('onDeviceAi.model.actions.delete'));
    expect(screen.getByText('onDeviceAi.model.delete.messageWithTextModel')).toBeTruthy();
  });

  it('keeps the plain delete message without the text model', () => {
    mockModel = { state: { kind: 'ready' }, projectorInstalled: true, updateAvailable: false };
    render(<LocalModelCard selection={selection} allowDelete />);
    fireEvent.click(screen.getByText('onDeviceAi.model.actions.delete'));
    expect(screen.getByText('onDeviceAi.model.delete.message')).toBeTruthy();
  });
});
