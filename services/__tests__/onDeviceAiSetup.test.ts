const mockSetUse = jest.fn();
const mockSet = jest.fn();
const mockStart = jest.fn();
const mockRefresh = jest.fn();

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    setUseOnDeviceAi: (...a: unknown[]) => mockSetUse(...a),
    set: (...a: unknown[]) => mockSet(...a),
  },
}));
jest.mock('@/services/localModels/modelStore', () => ({
  startLocalModelDownload: (...a: unknown[]) => mockStart(...a),
}));
jest.mock('@/services/localModels/onDeviceStatusStore', () => ({
  refreshOnDeviceStatus: (...a: unknown[]) => mockRefresh(...a),
}));

import { SETTINGS } from '@/constants/settingDefinitions';

import { disableOnDeviceAi, enableOnDeviceAi, setOnDeviceEngine } from '../onDeviceAiSetup';

beforeEach(() => jest.clearAllMocks());

describe('enableOnDeviceAi', () => {
  it('switches the provider on, stores the engine and starts the chosen download', async () => {
    await enableOnDeviceAi('gguf', { download: { withProjector: false } });

    expect(mockSetUse).toHaveBeenCalledWith(true);
    expect(mockSet).toHaveBeenCalledWith(SETTINGS.onDeviceEngine, 'gguf');
    expect(mockStart).toHaveBeenCalledWith({ withProjector: false });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('starts no download for Apple Intelligence', async () => {
    await enableOnDeviceAi('apple');

    expect(mockSet).toHaveBeenCalledWith(SETTINGS.onDeviceEngine, 'apple');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not wait for the download to finish', async () => {
    mockStart.mockReturnValue(new Promise(() => undefined));
    await expect(
      enableOnDeviceAi('gguf', { download: { withProjector: true } })
    ).resolves.toBeUndefined();
  });
});

describe('disableOnDeviceAi and setOnDeviceEngine', () => {
  it('turns the provider off', async () => {
    await disableOnDeviceAi();
    expect(mockSetUse).toHaveBeenCalledWith(false);
  });

  it('changes only the engine', async () => {
    await setOnDeviceEngine('apple');
    expect(mockSet).toHaveBeenCalledWith(SETTINGS.onDeviceEngine, 'apple');
    expect(mockSetUse).not.toHaveBeenCalled();
  });
});
