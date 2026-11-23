import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { SettingsService } from '@/database/services/SettingsService';
import { loadAiImageTier, prepareOwnKeyImage } from '@/utils/aiImage';

jest.mock('react-native', () => ({
  Image: { getSize: jest.fn() },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

// The real service loads the native database; only the one read this module makes is needed.
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

const getSize = Image.getSize as unknown as jest.Mock;
const manipulate = ImageManipulator.manipulateAsync as unknown as jest.Mock;
const getSetting = SettingsService.get as unknown as jest.Mock;

function setSize(width: number, height: number): void {
  getSize.mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
    success(width, height)
  );
}

// A mock encoder: the output is small, so one pass always fits.
function smallEncoder() {
  return async () => ({ uri: 'file:///out.jpg', width: 1, height: 1, base64: 'A'.repeat(1000) });
}

describe('prepareOwnKeyImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSetting.mockResolvedValue('medium');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['low', { width: 512, height: 384 }, 0.7],
    ['medium', { width: 768, height: 576 }, 0.75],
    ['high', { width: 1024, height: 768 }, 0.8],
    ['max', { width: 1568, height: 1176 }, 0.85],
  ])(
    'shrinks a camera photo to the %s tier, with no provider limit above it',
    async (tier, size, quality) => {
      getSetting.mockResolvedValue(tier);
      setSize(4000, 3000);
      manipulate.mockImplementation(smallEncoder());

      const result = await prepareOwnKeyImage('A'.repeat(4_000_000), 'image/png');

      expect(manipulate).toHaveBeenCalledWith(
        expect.stringContaining('data:image/png;base64,'),
        [{ resize: size }],
        expect.objectContaining({ compress: quality, format: 'jpeg', base64: true })
      );
      expect(result.mimeType).toBe('image/jpeg');
    }
  );

  it('never enlarges a photo that is already inside the tier', async () => {
    setSize(600, 450);

    const result = await prepareOwnKeyImage('AAAA', 'image/png');

    expect(result).toEqual({ base64: 'AAAA', mimeType: 'image/png' });
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('steps the quality down until the result fits the byte limit', async () => {
    getSetting.mockResolvedValue('max');
    setSize(4000, 3000);
    // Bigger than the 4 MB own-key limit at 0.85 and 0.75, small enough at 0.65.
    manipulate.mockImplementation(async (_u: string, _a: unknown, o: { compress: number }) => ({
      uri: 'x',
      width: 1,
      height: 1,
      base64: 'A'.repeat(o.compress > 0.7 ? 6_000_000 : 1000),
    }));

    const result = await prepareOwnKeyImage('A'.repeat(8_000_000), 'image/jpeg');

    expect(manipulate.mock.calls.map((c) => c[2].compress)).toEqual([0.85, 0.8, 0.7]);
    expect(result.base64.length).toBe(1000);
  });

  it('uses the default tier when the setting cannot be read', async () => {
    getSetting.mockRejectedValue(new Error('db'));

    await expect(loadAiImageTier()).resolves.toBe('medium');
  });

  it('sends the original photo when the resize fails', async () => {
    setSize(4000, 3000);
    manipulate.mockRejectedValue(new Error('boom'));

    const input = 'A'.repeat(4_000_000);

    await expect(prepareOwnKeyImage(input, 'image/jpeg')).resolves.toEqual({
      base64: input,
      mimeType: 'image/jpeg',
    });
    expect(console.warn).toHaveBeenCalled();
  });
});
