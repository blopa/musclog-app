import * as ImagePicker from 'expo-image-picker';

import {
  pickAndCropImageFromGallery,
  pickImageFromGallery,
  pickImagesFromGallery,
} from '@/utils/galleryImagePicker';

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

  it('returns null when the picker omits its assets collection', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ canceled: false });

    await expect(pickImageFromGallery()).resolves.toBeNull();
  });

  it('returns the first asset when the picker supplies multiple images', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///first.jpg' }, { uri: 'file:///second.jpg' }],
    });

    await expect(pickImageFromGallery()).resolves.toBe('file:///first.jpg');
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

  it('uses the documented default crop quality', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });
    mockOpenCropperAsync.mockResolvedValue({ path: 'file:///cropped.jpg' });

    await pickAndCropImageFromGallery();

    expect(mockOpenCropperAsync).toHaveBeenCalledWith({
      imageUri: 'file:///picked.jpg',
      format: 'jpeg',
      compressImageQuality: 0.8,
    });
  });

  it('propagates picker failures to the caller', async () => {
    const error = new Error('picker failed');
    mockLaunchImageLibrary.mockRejectedValue(error);

    await expect(pickAndCropImageFromGallery()).rejects.toBe(error);
    expect(mockOpenCropperAsync).not.toHaveBeenCalled();
  });

  it('propagates crop failures to the caller', async () => {
    const error = new Error('crop failed');
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });
    mockOpenCropperAsync.mockRejectedValue(error);

    await expect(pickAndCropImageFromGallery()).rejects.toBe(error);
  });
});

describe('pickImagesFromGallery', () => {
  beforeEach(() => {
    mockLaunchImageLibrary.mockReset();
  });

  it('opens the single-pick picker with exactly the single-pick arguments when limit is 1', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    await expect(pickImagesFromGallery(1)).resolves.toEqual(['file:///picked.jpg']);

    expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 1,
      base64: false,
    });
  });

  it('passes the multi-select arguments exactly when limit is above 1', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg' }],
    });

    await pickImagesFromGallery(3);

    expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 1,
      base64: false,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      orderedSelection: true,
    });
  });

  it('returns the picked uris in order', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///first.jpg' }, { uri: 'file:///second.jpg' }],
    });

    await expect(pickImagesFromGallery(5)).resolves.toEqual([
      'file:///first.jpg',
      'file:///second.jpg',
    ]);
  });

  it('cuts extra assets down to the limit', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///1.jpg' }, { uri: 'file:///2.jpg' }, { uri: 'file:///3.jpg' }],
    });

    await expect(pickImagesFromGallery(2)).resolves.toEqual(['file:///1.jpg', 'file:///2.jpg']);
  });

  it('returns an empty list when the picker is cancelled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });

    await expect(pickImagesFromGallery(3)).resolves.toEqual([]);
  });

  it('returns an empty list when no asset is returned', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ canceled: false, assets: [] });

    await expect(pickImagesFromGallery(3)).resolves.toEqual([]);
  });

  it.each([0, NaN])('treats a limit of %p as 1', async (limit) => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    await expect(pickImagesFromGallery(limit)).resolves.toEqual(['file:///picked.jpg']);

    expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 1,
      base64: false,
    });
  });
});
