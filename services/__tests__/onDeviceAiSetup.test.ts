const mockSetUse = jest.fn();
const mockSet = jest.fn();
const mockEnable = jest.fn();
const mockStart = jest.fn();
const mockRefresh = jest.fn();
const mockHandleError = jest.fn();

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    setUseOnDeviceAi: (...a: unknown[]) => mockSetUse(...a),
    set: (...a: unknown[]) => mockSet(...a),
    enableOnDeviceAi: (...a: unknown[]) => mockEnable(...a),
  },
}));
jest.mock('@/services/localModels/modelStore', () => ({
  localModelStore: { start: (...a: unknown[]) => mockStart(...a) },
}));
jest.mock('@/services/localModels/onDeviceStatusStore', () => ({
  refreshOnDeviceStatus: (...a: unknown[]) => mockRefresh(...a),
}));
jest.mock('@/utils/handleError', () => ({
  handleError: (...a: unknown[]) => mockHandleError(...a),
}));

import { SETTINGS } from '@/constants/settingDefinitions';

import { disableOnDeviceAi, enableOnDeviceAi, setOnDeviceEngine } from '../onDeviceAiSetup';

beforeEach(() => jest.clearAllMocks());

describe('enableOnDeviceAi', () => {
  it('switches the provider on, stores the engine and starts the chosen download', async () => {
    await enableOnDeviceAi('gguf', { download: { withProjector: false } });

    expect(mockEnable).toHaveBeenCalledWith('gguf');
    expect(mockSetUse).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalledWith({ withProjector: false });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('starts no download for Apple Intelligence', async () => {
    await enableOnDeviceAi('apple');

    expect(mockEnable).toHaveBeenCalledWith('apple');
    expect(mockSetUse).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not wait for the download to finish', async () => {
    mockStart.mockReturnValue(new Promise(() => undefined));
    await expect(enableOnDeviceAi('gguf', { download: { withProjector: true } })).resolves.toBe(
      true
    );
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

describe('a failed settings write', () => {
  // Every caller is a tap handler or a `void` call: a rejection would be unhandled and unreported.
  it.each([
    ['enable', () => enableOnDeviceAi('apple'), mockEnable, 'onDeviceAi.enable'],
    ['disable', () => disableOnDeviceAi(), mockSetUse, 'onDeviceAi.disable'],
    ['engine', () => setOnDeviceEngine('gguf'), mockSet, 'onDeviceAi.engine'],
  ])(
    '%s resolves false and reports once instead of rejecting',
    async (_name, run, write, context) => {
      const failure = new Error('database locked');
      write.mockRejectedValueOnce(failure);

      await expect(run()).resolves.toBe(false);
      expect(mockHandleError).toHaveBeenCalledTimes(1);
      expect(mockHandleError).toHaveBeenCalledWith(failure, context, { showSnackbar: false });
    }
  );

  it('starts no download when the choice could not be saved', async () => {
    mockEnable.mockRejectedValueOnce(new Error('database locked'));

    await enableOnDeviceAi('gguf', { download: { withProjector: true } });
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('resolves true when everything was saved', async () => {
    await expect(disableOnDeviceAi()).resolves.toBe(true);
    await expect(setOnDeviceEngine('apple')).resolves.toBe(true);
    expect(mockHandleError).not.toHaveBeenCalled();
  });
});
