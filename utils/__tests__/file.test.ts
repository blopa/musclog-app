import ExpoImageCropTool from '@bsky.app/expo-image-crop-tool';

import { openCropperAsync } from '@/utils/file';

jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-file-system', () => ({
  Directory: jest.fn(),
  File: jest.fn(),
  Paths: {},
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  copyAsync: jest.fn(),
  documentDirectory: 'file:///documents/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));
jest.mock('@bsky.app/expo-image-crop-tool', () => ({
  __esModule: true,
  default: { openCropperAsync: jest.fn() },
}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('../../database/exportDb', () => ({ dumpDatabase: jest.fn() }));
jest.mock('../../database/importDb', () => ({ restoreDatabase: jest.fn() }));
jest.mock('../barcodeScanner', () => ({ detectBarcodes: jest.fn() }));

const mockOpenCropper = ExpoImageCropTool.openCropperAsync as jest.Mock;

const CROP_OPTIONS = {
  imageUri: 'file:///photo.jpg',
  format: 'jpeg' as const,
  compressImageQuality: 0.8,
};

describe('openCropperAsync', () => {
  beforeEach(() => {
    mockOpenCropper.mockReset();
  });

  it('passes options through and resolves with the module result', async () => {
    const result = {
      path: 'file:///cropped.jpg',
      mimeType: 'image/jpeg',
      size: 1234,
      width: 100,
      height: 100,
    };
    mockOpenCropper.mockResolvedValue(result);

    await expect(openCropperAsync(CROP_OPTIONS)).resolves.toBe(result);
    expect(mockOpenCropper).toHaveBeenCalledWith(CROP_OPTIONS);
  });

  // The capture flow relies on null (not a rejection) to tell a dismissed crop UI apart from
  // a real failure — a regression here surfaces error snackbars on every cancelled crop.
  it('resolves null when the module rejects with the cancellation error', async () => {
    mockOpenCropper.mockRejectedValue(new Error('Crop cancelled'));

    await expect(openCropperAsync(CROP_OPTIONS)).resolves.toBeNull();
  });

  it('resolves null when the bridge decorates the cancellation message', async () => {
    mockOpenCropper.mockRejectedValue(new Error('[ExpoImageCropTool] Crop Cancelled by user'));

    await expect(openCropperAsync(CROP_OPTIONS)).resolves.toBeNull();
  });

  it('resolves null for non-Error cancellation rejections', async () => {
    mockOpenCropper.mockRejectedValue('crop cancelled');

    await expect(openCropperAsync(CROP_OPTIONS)).resolves.toBeNull();
  });

  it('rethrows non-cancellation errors', async () => {
    const failure = new Error('failed to write output file');
    mockOpenCropper.mockRejectedValue(failure);

    await expect(openCropperAsync(CROP_OPTIONS)).rejects.toBe(failure);
  });
});
