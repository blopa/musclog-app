/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import * as ImagePicker from 'expo-image-picker';

import { useCameraCaptureFlow } from '@/hooks/useCameraCaptureFlow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
  launchImageLibraryAsync: jest.fn(),
}));

const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

describe('useCameraCaptureFlow', () => {
  const renderFlow = ({
    takePictureAsync = jest.fn().mockResolvedValue({ uri: 'file:///shot.jpg' }),
    process = jest.fn().mockResolvedValue(undefined),
    quality = 0.8,
    cameraRef = { current: { takePictureAsync } },
  }: {
    takePictureAsync?: jest.Mock;
    process?: jest.Mock;
    quality?: number;
    cameraRef?: { current: { takePictureAsync: jest.Mock } | null };
  } = {}) => {
    const { result } = renderHook(() =>
      useCameraCaptureFlow({ cameraRef: cameraRef as never, quality, process })
    );
    return { result, takePictureAsync, process };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenCropperAsync.mockResolvedValue({ path: 'file:///cropped.jpg' });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('takePicture', () => {
    it('captures and processes the raw photo without opening the crop tool', async () => {
      const { result, takePictureAsync, process } = renderFlow({ quality: 0.85 });

      await result.current.takePicture();

      expect(takePictureAsync).toHaveBeenCalledTimes(1);
      expect(mockOpenCropperAsync).not.toHaveBeenCalled();
      expect(process).toHaveBeenCalledWith('file:///shot.jpg');
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('shows the camera-error snackbar when the capture fails', async () => {
      const takePictureAsync = jest.fn().mockRejectedValue(new Error('capture failed'));
      const { result, process } = renderFlow({ takePictureAsync });

      await result.current.takePicture();

      expect(process).not.toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.aiCamera.cameraError');
    });

    it('is a no-op while the camera ref is unset', async () => {
      const { result, process } = renderFlow({ cameraRef: { current: null } });

      await result.current.takePicture();

      expect(mockOpenCropperAsync).not.toHaveBeenCalled();
      expect(process).not.toHaveBeenCalled();
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });
  });

  describe('pickFromGallery', () => {
    it('crops the picked image at the configured quality and processes it', async () => {
      const { result, process } = renderFlow({ quality: 0.85 });

      await result.current.pickFromGallery();

      expect(mockLaunchImageLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ quality: 0.85 })
      );
      expect(mockOpenCropperAsync).toHaveBeenCalledWith({
        imageUri: 'file:///picked.jpg',
        format: 'jpeg',
        compressImageQuality: 0.85,
      });
      expect(process).toHaveBeenCalledWith('file:///cropped.jpg');
    });

    it('launches the system photo picker with no permission request and no legacy override', async () => {
      const { result, process } = renderFlow();

      await result.current.pickFromGallery();

      expect(mockLaunchImageLibrary).toHaveBeenCalledWith(
        expect.not.objectContaining({ legacy: expect.anything() })
      );
      expect(process).toHaveBeenCalledWith('file:///cropped.jpg');
    });

    it('ends silently when the picker is cancelled', async () => {
      mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });
      const { result, process } = renderFlow();

      await result.current.pickFromGallery();

      expect(process).not.toHaveBeenCalled();
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('shows the camera-error snackbar when processing the picked image fails', async () => {
      const process = jest.fn().mockRejectedValue(new Error('processing failed'));
      const { result } = renderFlow({ process });

      await result.current.pickFromGallery();

      expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.aiCamera.cameraError');
    });

    it('shows the gallery-error snackbar when the picker itself fails', async () => {
      mockLaunchImageLibrary.mockRejectedValue(new Error('picker crashed'));
      const { result, process } = renderFlow();

      await result.current.pickFromGallery();

      expect(process).not.toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.aiCamera.galleryError');
    });
  });
});
