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

const mockPickImagesFromGallery = jest.fn();
jest.mock('@/utils/galleryImagePicker', () => ({
  pickImagesFromGallery: (...args: unknown[]) => mockPickImagesFromGallery(...args),
}));

describe('useCameraCaptureFlow', () => {
  const renderFlow = ({
    takePictureAsync = jest.fn().mockResolvedValue({ uri: 'file:///shot.jpg' }),
    process = jest.fn().mockResolvedValue(undefined),
    quality = 0.8,
    cameraRef = { current: { takePictureAsync } },
    gallerySelectionLimit,
  }: {
    takePictureAsync?: jest.Mock;
    process?: jest.Mock;
    quality?: number;
    cameraRef?: { current: { takePictureAsync: jest.Mock } | null };
    gallerySelectionLimit?: number;
  } = {}) => {
    const { result } = renderHook(() =>
      useCameraCaptureFlow({
        cameraRef: cameraRef as never,
        quality,
        process,
        gallerySelectionLimit,
      })
    );
    return { result, takePictureAsync, process };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenCropperAsync.mockResolvedValue({ path: 'file:///cropped.jpg' });
    mockPickImagesFromGallery.mockResolvedValue(['file:///picked.jpg']);
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

    it('shows the camera-error snackbar when cropping a captured image fails', async () => {
      mockOpenCropperAsync.mockRejectedValue(new Error('crop failed'));
      const { result, process } = renderFlow();

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

      expect(mockPickImagesFromGallery).toHaveBeenCalledWith(1);
      expect(mockOpenCropperAsync).toHaveBeenCalledWith({
        imageUri: 'file:///picked.jpg',
        format: 'jpeg',
        compressImageQuality: 0.85,
      });
      expect(process).toHaveBeenCalledWith('file:///cropped.jpg');
    });

    it('ends silently when the picker is cancelled', async () => {
      mockPickImagesFromGallery.mockResolvedValue([]);
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

    it('shows the camera-error snackbar when cropping the picked image fails', async () => {
      mockOpenCropperAsync.mockRejectedValue(new Error('crop failed'));
      const { result, process } = renderFlow();

      await result.current.pickFromGallery();

      expect(process).not.toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.aiCamera.cameraError');
    });

    it('shows the gallery-error snackbar when the picker itself fails', async () => {
      mockPickImagesFromGallery.mockRejectedValue(new Error('picker crashed'));
      const { result, process } = renderFlow();

      await result.current.pickFromGallery();

      expect(process).not.toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.aiCamera.galleryError');
    });
  });

  describe('multi-image gallery picks', () => {
    const mockCropByUri = (failingUri?: string) => {
      mockOpenCropperAsync.mockImplementation(async ({ imageUri }: { imageUri: string }) => {
        if (imageUri === failingUri) {
          throw new Error('crop failed');
        }
        return { path: imageUri.replace('picked', 'cropped') };
      });
    };

    it('asks the picker for the configured selection limit, defaulting to 1', async () => {
      const { result } = renderFlow({ gallerySelectionLimit: 4 });
      await result.current.pickFromGallery();
      expect(mockPickImagesFromGallery).toHaveBeenLastCalledWith(4);

      const { result: defaultResult } = renderFlow();
      await defaultResult.current.pickFromGallery();
      expect(mockPickImagesFromGallery).toHaveBeenLastCalledWith(1);
    });

    it('crops every picked image in order, then processes each one in order', async () => {
      mockPickImagesFromGallery.mockResolvedValue([
        'file:///picked-1.jpg',
        'file:///picked-2.jpg',
        'file:///picked-3.jpg',
      ]);
      mockCropByUri();
      const events: string[] = [];
      mockOpenCropperAsync.mockImplementation(async ({ imageUri }: { imageUri: string }) => {
        events.push(`crop ${imageUri}`);
        return { path: imageUri.replace('picked', 'cropped') };
      });
      const process = jest.fn(async (path: string) => {
        events.push(`process ${path}`);
      });
      const { result } = renderFlow({ process, gallerySelectionLimit: 3 });

      await result.current.pickFromGallery();

      expect(events).toEqual([
        'crop file:///picked-1.jpg',
        'crop file:///picked-2.jpg',
        'crop file:///picked-3.jpg',
        'process file:///cropped-1.jpg',
        'process file:///cropped-2.jpg',
        'process file:///cropped-3.jpg',
      ]);
      expect(process).toHaveBeenCalledTimes(3);
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('drops only the image whose crop is cancelled', async () => {
      mockPickImagesFromGallery.mockResolvedValue([
        'file:///picked-1.jpg',
        'file:///picked-2.jpg',
        'file:///picked-3.jpg',
      ]);
      mockOpenCropperAsync.mockImplementation(async ({ imageUri }: { imageUri: string }) =>
        imageUri === 'file:///picked-2.jpg' ? null : { path: imageUri.replace('picked', 'cropped') }
      );
      const { result, process } = renderFlow({ gallerySelectionLimit: 3 });

      await result.current.pickFromGallery();

      expect(process.mock.calls).toEqual([['file:///cropped-1.jpg'], ['file:///cropped-3.jpg']]);
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('stops cropping after a failed crop, processes the earlier ones and shows the error', async () => {
      mockPickImagesFromGallery.mockResolvedValue([
        'file:///picked-1.jpg',
        'file:///picked-2.jpg',
        'file:///picked-3.jpg',
      ]);
      mockCropByUri('file:///picked-2.jpg');
      const { result, process } = renderFlow({ gallerySelectionLimit: 3 });

      await result.current.pickFromGallery();

      expect(mockOpenCropperAsync).toHaveBeenCalledTimes(2);
      expect(process.mock.calls).toEqual([['file:///cropped-1.jpg']]);
      expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'food.aiCamera.cameraError');
    });
  });
});
