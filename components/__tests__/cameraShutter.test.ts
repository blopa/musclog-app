import * as Sentry from '@sentry/react-native';

import { captureWithSnapshotLadder } from '@/components/cameraShutter';

jest.mock('@sentry/react-native', () => ({
  captureMessage: jest.fn(),
}));

const mockCaptureMessage = Sentry.captureMessage as jest.Mock;

describe('captureWithSnapshotLadder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('returns the snapshot and never touches the fallback when the snapshot succeeds', async () => {
    const takeSnapshot = jest.fn().mockResolvedValue({ uri: 'file:///snap.jpg' });
    const takePhotoFallback = jest.fn().mockResolvedValue({ uri: 'file:///photo.jpg' });

    const result = await captureWithSnapshotLadder({
      previewReady: Promise.resolve(),
      takeSnapshot,
      takePhotoFallback,
    });

    expect(result).toEqual({ uri: 'file:///snap.jpg' });
    expect(takePhotoFallback).not.toHaveBeenCalled();
    // A fast snapshot is the happy path — no Sentry event.
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('falls back to takePhoto and reports when the snapshot fails', async () => {
    const takeSnapshot = jest.fn().mockRejectedValue(new Error('getBitmap returned null'));
    const takePhotoFallback = jest.fn().mockResolvedValue({ uri: 'file:///photo.jpg' });

    const result = await captureWithSnapshotLadder({
      previewReady: Promise.resolve(),
      takeSnapshot,
      takePhotoFallback,
    });

    expect(result).toEqual({ uri: 'file:///photo.jpg' });
    expect(takePhotoFallback).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'camera-shutter-slow-or-fallback',
      expect.objectContaining({
        level: 'warning',
        extra: expect.objectContaining({
          path: 'takePhoto-fallback',
          snapshotError: 'getBitmap returned null',
        }),
      })
    );
  });

  it('rethrows and reports fallback-failed when both paths fail', async () => {
    const takeSnapshot = jest.fn().mockRejectedValue(new Error('snapshot boom'));
    const takePhotoFallback = jest.fn().mockRejectedValue(new Error('capture boom'));

    await expect(
      captureWithSnapshotLadder({
        previewReady: Promise.resolve(),
        takeSnapshot,
        takePhotoFallback,
      })
    ).rejects.toThrow('capture boom');

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'camera-shutter-slow-or-fallback',
      expect.objectContaining({
        extra: expect.objectContaining({
          path: 'fallback-failed',
          snapshotError: 'snapshot boom',
          fallbackError: 'capture boom',
        }),
      })
    );
  });

  it('waits for the preview-ready signal before taking the snapshot', async () => {
    let resolvePreview = () => {};
    const previewReady = new Promise<void>((resolve) => {
      resolvePreview = resolve;
    });
    const takeSnapshot = jest.fn().mockResolvedValue({ uri: 'file:///snap.jpg' });

    const pending = captureWithSnapshotLadder({
      previewReady,
      takeSnapshot,
      takePhotoFallback: jest.fn(),
    });

    // Let any already-scheduled microtasks flush; the snapshot must still be blocked.
    await Promise.resolve();
    expect(takeSnapshot).not.toHaveBeenCalled();

    resolvePreview();
    await pending;
    expect(takeSnapshot).toHaveBeenCalledTimes(1);
  });
});
