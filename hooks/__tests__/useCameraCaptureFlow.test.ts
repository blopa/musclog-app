/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

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

const mockPickImageFromGallery = jest.fn();
jest.mock('@/utils/galleryImagePicker', () => ({
  pickImageFromGallery: (...args: unknown[]) => mockPickImageFromGallery(...args),
}));

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
    mockPickImageFromGallery.mockResolvedValue('file:///picked.jpg');
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('takePicture', () => {
    // Same crop step as a gallery pick: the user gets to trim the shot before it is analysed,
    // and `process` only ever sees a cropped image.
    it('routes the shutter photo through the crop tool at the configured quality', async () => {
      const { result, takePictureAsync, process } = renderFlow({ quality: 0.85 });

      await result.current.takePicture();

      expect(takePictureAsync).toHaveBeenCalledTimes(1);
      expect(mockOpenCropperAsync).toHaveBeenCalledWith({
        imageUri: 'file:///shot.jpg',
        format: 'jpeg',
        compressImageQuality: 0.85,
      });
      expect(process).toHaveBeenCalledWith('file:///cropped.jpg');
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('ends silently without processing when the crop is cancelled', async () => {
      mockOpenCropperAsync.mockResolvedValue(null);
      const { result, process } = renderFlow();

      await result.current.takePicture();

      expect(process).not.toHaveBeenCalled();
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
    // The crop is the only lossy step: the picker is asked for the image uncompressed, so the
    // requested quality is applied once rather than compounding into ~0.72 and costing the AI /
    // barcode paths the label legibility they depend on.
    it('applies the configured quality at the crop step only, then processes it', async () => {
      const { result, process } = renderFlow({ quality: 0.85 });

      await result.current.pickFromGallery();

      expect(mockPickImageFromGallery).toHaveBeenCalledWith();
      expect(mockOpenCropperAsync).toHaveBeenCalledWith({
        imageUri: 'file:///picked.jpg',
        format: 'jpeg',
        compressImageQuality: 0.85,
      });
      expect(process).toHaveBeenCalledWith('file:///cropped.jpg');
    });

    it('ends silently when the picker is cancelled', async () => {
      mockPickImageFromGallery.mockResolvedValue(null);
      const { result, process } = renderFlow();

      await result.current.pickFromGallery();

      expect(mockOpenCropperAsync).not.toHaveBeenCalled();
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
      mockPickImageFromGallery.mockRejectedValue(new Error('picker crashed'));
      const { result, process } = renderFlow();

      await result.current.pickFromGallery();

      expect(process).not.toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.aiCamera.galleryError');
    });
  });
});
