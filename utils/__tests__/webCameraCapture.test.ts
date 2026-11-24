/**
 * @jest-environment jsdom
 */

import { captureFrameFromVideo } from '@/utils/webCameraCapture';

const video = (videoWidth: number, videoHeight: number) =>
  ({ videoWidth, videoHeight }) as unknown as HTMLVideoElement;

describe('captureFrameFromVideo', () => {
  const drawImage = jest.fn();
  let toBlob: jest.Mock;
  let canvas: { width: number; height: number; getContext: jest.Mock; toBlob: jest.Mock };

  beforeEach(() => {
    drawImage.mockReset();
    toBlob = jest.fn((callback: (blob: Blob | null) => void) =>
      callback(new Blob(['x'], { type: 'image/jpeg' }))
    );
    canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({ drawImage })),
      toBlob,
    };
    jest.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement);
    URL.createObjectURL = jest.fn(() => 'blob:frame');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws the frame at the video resolution and returns an object URL for the JPEG', async () => {
    const source = video(1280, 720);

    await expect(captureFrameFromVideo(source)).resolves.toEqual({ uri: 'blob:frame' });

    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 1280, 720);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
  });

  it.each([
    ['no element', null],
    ['a stream with no frame yet', video(0, 0)],
  ])('throws for %s instead of doing nothing', async (_label, source) => {
    await expect(captureFrameFromVideo(source)).rejects.toThrow('not ready');
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('throws when the canvas has no 2d context', async () => {
    canvas.getContext.mockReturnValue(null);

    await expect(captureFrameFromVideo(video(640, 480))).rejects.toThrow('camera frame');
  });

  it('throws when the frame cannot be encoded', async () => {
    toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(null));

    await expect(captureFrameFromVideo(video(640, 480))).rejects.toThrow('encode');
  });
});
