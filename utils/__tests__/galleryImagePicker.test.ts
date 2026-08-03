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

  it('launches the system photo picker with no permission flag and no legacy override', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    await pickImageFromGallery(0.85);

    expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 0.85,
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

  it('defaults quality to 0.8', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    await pickImageFromGallery();

    expect(mockLaunchImageLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 0.8 })
    );
  });
});

describe('pickAndCropImageFromGallery', () => {
  beforeEach(() => {
    mockLaunchImageLibrary.mockReset();
    mockOpenCropperAsync.mockReset();
  });

  it('crops the picked image at the configured quality and returns the cropped path', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });
    mockOpenCropperAsync.mockResolvedValue({ path: 'file:///cropped.jpg' });

    await expect(pickAndCropImageFromGallery(0.85)).resolves.toBe('file:///cropped.jpg');

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
