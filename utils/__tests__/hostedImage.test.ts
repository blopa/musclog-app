import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { fetchPremiumConfig } from '@/services/premium/premiumService';
import {
  HOSTED_BODY_OVERHEAD_BYTES,
  HOSTED_REQUEST_BODY_CAP_BYTES,
} from '@/utils/premium/hostedImagePlan';
import { prepareHostedImage, resetHostedImageConfigCache } from '@/utils/hostedImage';

jest.mock('react-native', () => ({
  Image: { getSize: jest.fn() },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('@/services/premium/premiumService', () => ({
  fetchPremiumConfig: jest.fn(),
}));

const getSize = Image.getSize as unknown as jest.Mock;
const manipulate = ImageManipulator.manipulateAsync as unknown as jest.Mock;
const fetchConfig = fetchPremiumConfig as unknown as jest.Mock;

const CONFIG_OK = {
  ok: true,
  value: {
    enabled: true,
    acceptingNew: true,
    visionEnabled: true,
    image: { maxPx: 1024, maxBytes: 900 * 1024, quality: 0.7 },
    minAppVersion: null,
  },
};

function setSize(width: number, height: number): void {
  getSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
    success(width, height)
  );
}

// A mock encoder: the output length in characters falls as quality falls.
function encoderAt(scale: number) {
  return async (_uri: string, _actions: unknown, options: { compress: number }) => ({
    uri: 'file:///out.jpg',
    width: 1024,
    height: 768,
    base64: 'A'.repeat(Math.floor(options.compress * scale)),
  });
}

describe('prepareHostedImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHostedImageConfigCache();
    fetchConfig.mockResolvedValue(CONFIG_OK);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a small image untouched without calling the manipulator', async () => {
    setSize(800, 600);

    const result = await prepareHostedImage('AAAA', 'image/png');

    expect(result).toEqual({ base64: 'AAAA', mimeType: 'image/png' });
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('resizes to the config maxPx and re-encodes as JPEG', async () => {
    setSize(4000, 3000);
    manipulate.mockImplementation(encoderAt(1_000_000));

    const input = 'A'.repeat(4_000_000);
    await prepareHostedImage(input, 'image/jpeg');

    expect(manipulate).toHaveBeenCalledWith(
      expect.stringContaining('data:image/jpeg;base64,'),
      [{ resize: { width: 1024, height: 768 } }],
      expect.objectContaining({ compress: 0.7, format: 'jpeg', base64: true })
    );
  });

  it('retries at lower quality until the result fits maxBytes, and keeps the body under the Worker cap', async () => {
    setSize(4000, 3000);
    manipulate.mockImplementation(encoderAt(1_000_000));

    const result = await prepareHostedImage('A'.repeat(4_000_000), 'image/jpeg');

    expect(manipulate.mock.calls.length).toBeGreaterThan(1);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.base64.length + HOSTED_BODY_OVERHEAD_BYTES).toBeLessThanOrEqual(
      HOSTED_REQUEST_BODY_CAP_BYTES
    );
  });

  it('falls back to defaults when the config request fails', async () => {
    fetchConfig.mockResolvedValue({ ok: false, failure: 'unknown' });
    setSize(4000, 3000);
    manipulate.mockImplementation(encoderAt(100_000));

    await prepareHostedImage('A'.repeat(4_000_000), 'image/jpeg');

    expect(manipulate).toHaveBeenCalledWith(
      expect.anything(),
      [{ resize: { width: 1024, height: 768 } }],
      expect.anything()
    );
  });

  it('returns the original input when the manipulator throws', async () => {
    setSize(4000, 3000);
    manipulate.mockRejectedValue(new Error('boom'));

    const input = 'A'.repeat(4_000_000);
    const result = await prepareHostedImage(input, 'image/jpeg');

    expect(result).toEqual({ base64: input, mimeType: 'image/jpeg' });
    expect(console.warn).toHaveBeenCalled();
  });

  it('caches the config so a burst of photos makes one request', async () => {
    setSize(800, 600);

    await prepareHostedImage('AAAA', 'image/jpeg');
    await prepareHostedImage('AAAA', 'image/jpeg');

    expect(fetchConfig).toHaveBeenCalledTimes(1);
  });

  it('refetches the config after the cache expires', async () => {
    setSize(800, 600);
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(1_000_000);
    await prepareHostedImage('AAAA', 'image/jpeg');
    now.mockReturnValue(1_000_000 + 5 * 60 * 1000 + 1);
    await prepareHostedImage('AAAA', 'image/jpeg');

    expect(fetchConfig).toHaveBeenCalledTimes(2);
  });
});
