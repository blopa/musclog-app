/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useCameraCaptureFlow } from '@/hooks/useCameraCaptureFlow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

const mockShowSnackbar = jest.fn();
jest.mock('@/utils/snackbarService', () => ({
  showSnackbar: (...args: unknown[]) => mockShowSnackbar(...args),
}));

const mockOpenCropperAsync = jest.fn();
jest.mock('@/utils/file', () => ({
  openCropperAsync: (...args: unknown[]) => mockOpenCropperAsync(...args),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockFileDelete = jest.fn();
const fileInstances: Array<{ uri: string; exists: boolean; delete: jest.Mock }> = [];
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => {
    const instance = { uri, exists: true, delete: mockFileDelete };
    fileInstances.push(instance);
    return instance;
  }),
}));

describe('useCameraCaptureFlow warm-up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileInstances.length = 0;
    mockOpenCropperAsync.mockReset();
  });

  const makeCameraRef = (takePictureAsync: jest.Mock) => ({
    current: { takePictureAsync },
  });

  it('fires a silent warm-up capture once the camera reports ready, then deletes the file', async () => {
    const takePictureAsync = jest.fn().mockResolvedValue({ uri: 'file:///warmup.jpg' });
    const cameraRef = makeCameraRef(takePictureAsync);

    const { rerender } = renderHook(
      ({ cameraReady }) =>
        useCameraCaptureFlow({
          cameraRef: cameraRef as never,
          quality: 0.85,
          process: jest.fn(),
          cameraReady,
        }),
      { initialProps: { cameraReady: false } }
    );

    expect(takePictureAsync).not.toHaveBeenCalled();

    rerender({ cameraReady: true });

    await waitFor(() => {
      expect(takePictureAsync).toHaveBeenCalledTimes(1);
    });
    expect(takePictureAsync).toHaveBeenCalledWith(expect.objectContaining({ shutterSound: false }));

    await waitFor(() => {
      expect(mockFileDelete).toHaveBeenCalledTimes(1);
    });

    // Re-rendering with cameraReady still true must not fire a second warm-up.
    rerender({ cameraReady: true });
    expect(takePictureAsync).toHaveBeenCalledTimes(1);
  });

  it('re-arms the warm-up when the camera session resets (ready -> not ready -> ready)', async () => {
    const takePictureAsync = jest.fn().mockResolvedValue({ uri: 'file:///warmup.jpg' });
    const cameraRef = makeCameraRef(takePictureAsync);

    const { rerender } = renderHook(
      ({ cameraReady }) =>
        useCameraCaptureFlow({
          cameraRef: cameraRef as never,
          quality: 0.85,
          process: jest.fn(),
          cameraReady,
        }),
      { initialProps: { cameraReady: true } }
    );

    await waitFor(() => expect(takePictureAsync).toHaveBeenCalledTimes(1));

    rerender({ cameraReady: false });
    rerender({ cameraReady: true });

    await waitFor(() => expect(takePictureAsync).toHaveBeenCalledTimes(2));
  });

  it('does not throw or show a snackbar when the warm-up capture itself fails', async () => {
    const takePictureAsync = jest.fn().mockRejectedValue(new Error('camera not ready'));
    const cameraRef = makeCameraRef(takePictureAsync);

    renderHook(() =>
      useCameraCaptureFlow({
        cameraRef: cameraRef as never,
        quality: 0.85,
        process: jest.fn(),
        cameraReady: true,
      })
    );

    await waitFor(() => expect(takePictureAsync).toHaveBeenCalledTimes(1));
    // Give the rejected warm-up promise's .catch() a tick to run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('takePicture waits for an in-flight warm-up instead of firing a concurrent capture', async () => {
    let resolveWarmUp!: (value: { uri: string }) => void;
    const warmUpPromise = new Promise<{ uri: string }>((resolve) => {
      resolveWarmUp = resolve;
    });

    const takePictureAsync = jest
      .fn()
      .mockImplementationOnce(() => warmUpPromise) // the warm-up call
      .mockResolvedValueOnce({ uri: 'file:///real-shot.jpg' }); // the real shutter call

    const cameraRef = makeCameraRef(takePictureAsync);
    const process = jest.fn().mockResolvedValue(undefined);
    mockOpenCropperAsync.mockResolvedValue({ path: 'file:///cropped.jpg' });

    const { result } = renderHook(() =>
      useCameraCaptureFlow({
        cameraRef: cameraRef as never,
        quality: 0.85,
        process,
        cameraReady: true,
      })
    );

    await waitFor(() => expect(takePictureAsync).toHaveBeenCalledTimes(1));

    // User taps the shutter while the warm-up capture is still in flight.
    let takePictureResolved = false;
    const takePicturePromise = result.current.takePicture().then(() => {
      takePictureResolved = true;
    });

    // The real capture must not fire a second concurrent takePictureAsync call yet.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(takePictureAsync).toHaveBeenCalledTimes(1);
    expect(takePictureResolved).toBe(false);

    await act(async () => {
      resolveWarmUp({ uri: 'file:///warmup.jpg' });
      await takePicturePromise;
    });

    expect(takePictureAsync).toHaveBeenCalledTimes(2);
    expect(process).toHaveBeenCalledWith('file:///cropped.jpg');
  });
});
