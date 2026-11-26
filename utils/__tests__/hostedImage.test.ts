import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { SettingsService } from '@/database/services/SettingsService';
import { fetchPremiumConfig } from '@/services/premium/premiumService';
import {
  HOSTED_BODY_OVERHEAD_BYTES,
  HOSTED_REQUEST_BODY_CAP_BYTES,
} from '@/utils/premium/hostedImagePlan';
import { loadHostedMaxImages, prepareHostedImage } from '@/utils/hostedImage';

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

// The real service loads the native database; only the one read this module makes is needed.
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

const getSize = Image.getSize as unknown as jest.Mock;
const manipulate = ImageManipulator.manipulateAsync as unknown as jest.Mock;
const fetchConfig = fetchPremiumConfig as unknown as jest.Mock;
const getSetting = SettingsService.get as unknown as jest.Mock;

const CONFIG_OK = {
  ok: true,
  value: {
    enabled: true,
    acceptingNew: true,
    visionEnabled: true,
    reasoningEffort: true,
    image: { maxPx: 1568, maxBytes: 900 * 1024, quality: 0.85, maxImages: 5, bodyMaxBytes: null },
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
    fetchConfig.mockResolvedValue(CONFIG_OK);
    getSetting.mockResolvedValue('medium');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a photo already inside the chosen tier untouched, without calling the manipulator', async () => {
    setSize(600, 450);

    const result = await prepareHostedImage('AAAA', 'image/png');

    expect(result).toEqual({ base64: 'AAAA', mimeType: 'image/png' });
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('resizes to the default tier (medium) and re-encodes as JPEG', async () => {
    setSize(4000, 3000);
    manipulate.mockImplementation(encoderAt(1_000_000));

    const input = 'A'.repeat(4_000_000);
    await prepareHostedImage(input, 'image/jpeg');

    expect(manipulate).toHaveBeenCalledWith(
      expect.stringContaining('data:image/jpeg;base64,'),
      [{ resize: { width: 768, height: 576 } }],
      expect.objectContaining({ compress: 0.75, format: 'jpeg', base64: true })
    );
  });

  it.each([
    ['low', { width: 512, height: 384 }, 0.7],
    ['medium', { width: 768, height: 576 }, 0.75],
    ['high', { width: 1024, height: 768 }, 0.8],
    ['max', { width: 1568, height: 1176 }, 0.85],
  ])('prepares a photo at the %s tier', async (tier, size, quality) => {
    getSetting.mockResolvedValue(tier);
    setSize(4000, 3000);
    manipulate.mockImplementation(encoderAt(1_000_000));

    await prepareHostedImage('A'.repeat(4_000_000), 'image/jpeg');

    expect(manipulate).toHaveBeenCalledWith(
      expect.anything(),
      [{ resize: size }],
      expect.objectContaining({ compress: quality })
    );
  });

  it("holds the chosen tier to the Worker's limits", async () => {
    getSetting.mockResolvedValue('max');
    fetchConfig.mockResolvedValue({
      ok: true,
      value: { ...CONFIG_OK.value, image: { maxPx: 1024, maxBytes: 900 * 1024, quality: 0.7 } },
    });
    setSize(4000, 3000);
    manipulate.mockImplementation(encoderAt(1_000_000));

    await prepareHostedImage('A'.repeat(4_000_000), 'image/jpeg');

    expect(manipulate).toHaveBeenCalledWith(
      expect.anything(),
      [{ resize: { width: 1024, height: 768 } }],
      expect.objectContaining({ compress: 0.7 })
    );
  });

  it('uses the default tier when the setting cannot be read', async () => {
    getSetting.mockRejectedValue(new Error('db'));
    setSize(4000, 3000);
    manipulate.mockImplementation(encoderAt(1_000_000));

    await prepareHostedImage('A'.repeat(4_000_000), 'image/jpeg');

    expect(manipulate).toHaveBeenCalledWith(
      expect.anything(),
      [{ resize: { width: 768, height: 576 } }],
      expect.anything()
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
      [{ resize: { width: 768, height: 576 } }],
      expect.objectContaining({ compress: 0.7 })
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

  it('throws a hosted unavailable error when the Worker has photos switched off', async () => {
    fetchConfig.mockResolvedValue({
      ok: true,
      value: { ...CONFIG_OK.value, visionEnabled: false },
    });
    setSize(800, 600);

    await expect(prepareHostedImage('AAAA', 'image/jpeg')).rejects.toMatchObject({
      hostedKind: 'unavailable',
    });
    expect(manipulate).not.toHaveBeenCalled();
  });
});

describe('prepareHostedImage with several photos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchConfig.mockResolvedValue(CONFIG_OK);
    getSetting.mockResolvedValue('max');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gives each photo a share of the body, so five photos are squeezed harder than one', async () => {
    setSize(4000, 3000);
    // Output is always 200 KB decoded: over the five-photo share (~97 KB), so every quality step runs.
    manipulate.mockImplementation(encoderAt(1_000_000));

    await prepareHostedImage('A'.repeat(4_000_000), 'image/jpeg', 1);
    const singleCalls = manipulate.mock.calls.length;
    manipulate.mockClear();

    await prepareHostedImage('A'.repeat(4_000_000), 'image/jpeg', 5);

    expect(manipulate.mock.calls.length).toBeGreaterThan(singleCalls);
  });

  it('uses the Worker body cap when it is advertised', async () => {
    fetchConfig.mockResolvedValue({
      ok: true,
      value: {
        ...CONFIG_OK.value,
        image: { ...CONFIG_OK.value.image, bodyMaxBytes: 4 * 1024 * 1024 },
      },
    });
    setSize(1000, 800);
    // 300 KB decoded fits a 4 MiB body shared by five, but not the default 512 KB one.
    const input = 'A'.repeat(400_000);

    await prepareHostedImage(input, 'image/jpeg', 5);

    expect(manipulate).not.toHaveBeenCalled();
  });
});

describe('loadHostedMaxImages', () => {
  it('reads maxImages when photos are on', async () => {
    fetchConfig.mockResolvedValue(CONFIG_OK);

    await expect(loadHostedMaxImages()).resolves.toBe(5);
  });

  it('is 1 when photos are off, the config is unreadable or it throws', async () => {
    fetchConfig.mockResolvedValue({
      ok: true,
      value: { ...CONFIG_OK.value, visionEnabled: false },
    });
    await expect(loadHostedMaxImages()).resolves.toBe(1);

    fetchConfig.mockResolvedValue({ ok: false });
    await expect(loadHostedMaxImages()).resolves.toBe(1);

    fetchConfig.mockRejectedValue(new Error('x'));
    await expect(loadHostedMaxImages()).resolves.toBe(1);
  });
});
