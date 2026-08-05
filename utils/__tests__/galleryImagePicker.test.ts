import * as ImagePicker from 'expo-image-picker';

import { pickAndCropImageFromGallery, pickImageFromGallery } from '@/utils/galleryImagePicker';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const mockOpenCropperAsync = jest.fn();
jest.mock('@/utils/file', () => ({
  openCropperAsync: (...args: unknown[]) => mockOpenCropperAsync(...args),
}));

const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

describe('pickImageFromGallery', () => {
  beforeEach(() => {
    mockLaunchImageLibrary.mockReset();
  });

  // Regression guard: every caller re-encodes the result through openCropperAsync, so compressing
  // here too would stack a second lossy pass (a requested 0.8 landing at ~0.64) and cost the
  // smart-camera path the label legibility OCR/barcode decoding depends on.
  it('picks uncompressed, leaving the crop step as the only lossy pass', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    await pickImageFromGallery();

    expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 1,
      base64: false,
    });
  });

  it('returns the picked asset uri', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    await expect(pickImageFromGallery()).resolves.toBe('file:///picked.jpg');
  });

  it('returns null when the picker is cancelled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });

    await expect(pickImageFromGallery()).resolves.toBeNull();
  });

  it('returns null when no asset is returned', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ canceled: false, assets: [] });

    await expect(pickImageFromGallery()).resolves.toBeNull();
  });
});

describe('pickAndCropImageFromGallery', () => {
  beforeEach(() => {
    mockLaunchImageLibrary.mockReset();
    mockOpenCropperAsync.mockReset();
  });

  it('applies the requested quality at the crop step only, and returns the cropped path', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });
    mockOpenCropperAsync.mockResolvedValue({ path: 'file:///cropped.jpg' });

    await expect(pickAndCropImageFromGallery(0.85)).resolves.toBe('file:///cropped.jpg');

    expect(mockLaunchImageLibrary).toHaveBeenCalledWith(expect.objectContaining({ quality: 1 }));
    expect(mockOpenCropperAsync).toHaveBeenCalledWith({
      imageUri: 'file:///picked.jpg',
      format: 'jpeg',
      compressImageQuality: 0.85,
    });
  });

  it('returns null and never opens the crop tool when the picker is cancelled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });

    await expect(pickAndCropImageFromGallery()).resolves.toBeNull();

    expect(mockOpenCropperAsync).not.toHaveBeenCalled();
  });

  it('returns null when the crop is cancelled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });
    mockOpenCropperAsync.mockResolvedValue(null);

    await expect(pickAndCropImageFromGallery()).resolves.toBeNull();
  });
});
