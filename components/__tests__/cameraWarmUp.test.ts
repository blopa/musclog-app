import { runCameraWarmUp } from '@/components/cameraWarmUp';

const mockFileDelete = jest.fn();
let mockFileExists = true;
let mockFileConstructorError: Error | null = null;

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => {
    if (mockFileConstructorError) {
      throw mockFileConstructorError;
    }
    return {
      uri,
      get exists() {
        return mockFileExists;
      },
      delete: mockFileDelete,
    };
  }),
}));

describe('runCameraWarmUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileExists = true;
    mockFileConstructorError = null;
  });

  it('fires a single silent capture and deletes the throwaway photo', async () => {
    const takePhoto = jest.fn().mockResolvedValue({ uri: 'file:///warmup.jpg' });

    await runCameraWarmUp(takePhoto);

    expect(takePhoto).toHaveBeenCalledTimes(1);
    expect(takePhoto).toHaveBeenCalledWith({ shutterSound: false });
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
  });

  it('skips deletion when the throwaway photo no longer exists', async () => {
    mockFileExists = false;
    const takePhoto = jest.fn().mockResolvedValue({ uri: 'file:///warmup.jpg' });

    await runCameraWarmUp(takePhoto);

    expect(mockFileDelete).not.toHaveBeenCalled();
  });

  // The shutter path (takeSnapshot) never awaits this promise; a rejection here would only
  // produce a pointless unhandled-rejection warning.
  it('resolves instead of rejecting when the capture fails', async () => {
    const takePhoto = jest.fn().mockRejectedValue(new Error('camera not ready'));

    await expect(runCameraWarmUp(takePhoto)).resolves.toBeUndefined();
  });

  it('resolves instead of rejecting when file cleanup throws', async () => {
    mockFileConstructorError = new Error('filesystem unavailable');
    const takePhoto = jest.fn().mockResolvedValue({ uri: 'file:///warmup.jpg' });

    await expect(runCameraWarmUp(takePhoto)).resolves.toBeUndefined();
  });
});
