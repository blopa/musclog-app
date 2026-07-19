import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { detectBarcodes } from '@/utils/file';
import { showSnackbar } from '@/utils/snackbarService';

type UseBarcodeScanner = {
  visible: boolean;
  onBarcodeScanned?: (data: string) => void;
  onClose: () => void;
};

export function useBarcodeScanner({ visible, onBarcodeScanned, onClose }: UseBarcodeScanner) {
  const { t } = useTranslation();
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const isSearchingBarcodeRef = useRef(false);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [isFoodNotFoundModalVisible, setIsFoodNotFoundModalVisible] = useState(false);
  const [cameraResumeKey, setCameraResumeKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setIsSearchingBarcode(false);
        setDetectedBarcode(null);
        setIsFoodNotFoundModalVisible(false);
      };
      reset();
      isSearchingBarcodeRef.current = false;
    }
  }, [visible]);

  const handleLiveBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (isSearchingBarcodeRef.current) {
        return;
      }

      isSearchingBarcodeRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (onBarcodeScanned) {
        onBarcodeScanned(data);
        onClose();
        return;
      }

      setIsSearchingBarcode(true);
      setDetectedBarcode(data);
    },
    [onBarcodeScanned, onClose]
  );

  const handleBarcodeTextSearchSubmit = useCallback(
    (barcode: string) => {
      if (!barcode) {
        showSnackbar('error', t('food.aiCamera.barcodeTextSearchRequired'));
        return;
      }

      isSearchingBarcodeRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (onBarcodeScanned) {
        onBarcodeScanned(barcode);
        onClose();
        return;
      }

      setIsSearchingBarcode(true);
      setDetectedBarcode(barcode);
    },
    [onBarcodeScanned, onClose, t]
  );

  const processBarcodeImage = useCallback(
    async (fileUri: string) => {
      setIsSearchingBarcode(true);
      try {
        const barcode = await detectBarcodes(fileUri);
        if (barcode) {
          if (onBarcodeScanned) {
            onBarcodeScanned(barcode);
            onClose();
            return;
          }

          setDetectedBarcode(barcode);
        } else {
          showSnackbar('error', t('food.aiCamera.noBarcodeFound'));
          isSearchingBarcodeRef.current = false;
          setIsSearchingBarcode(false);
          if (!onBarcodeScanned) {
            setIsFoodNotFoundModalVisible(true);
          }
        }
      } catch (error) {
        console.error('Error detecting barcode:', error);
        showSnackbar('error', t('food.aiCamera.cameraError'));
        isSearchingBarcodeRef.current = false;
        setIsSearchingBarcode(false);
      }
    },
    [t, onBarcodeScanned, onClose]
  );

  // Runs a shutter capture with the live scanner suppressed for its whole duration. The shutter
  // path sends the photo straight into `processBarcodeImage` (no crop tool), and the preview
  // keeps feeding frames the whole time it runs — without this guard, a barcode detected in that
  // window races the shutter's own `processBarcodeImage` and pops a second "Analyzing barcode..."
  // overlay. `capture` reports whether it actually processed anything; release the guard only
  // when it didn't (a camera error) — otherwise `processBarcodeImage`'s own
  // success/error/not-found paths own the ref.
  const captureWithLiveScanSuppressed = useCallback(async (capture: () => Promise<boolean>) => {
    isSearchingBarcodeRef.current = true;
    if (!(await capture())) {
      isSearchingBarcodeRef.current = false;
    }
  }, []);

  const handleBarcodeLookupComplete = useCallback(() => {
    setIsSearchingBarcode(false);
  }, []);

  const handleFoodDetailsClose = useCallback(() => {
    setDetectedBarcode(null);
    isSearchingBarcodeRef.current = false;
    setIsSearchingBarcode(false);
    setCameraResumeKey((k) => k + 1);
  }, []);

  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    setDetectedBarcode(null);
    isSearchingBarcodeRef.current = false;
    setIsSearchingBarcode(false);
    setCameraResumeKey((k) => k + 1);
  }, []);

  return {
    isSearchingBarcode,
    isSearchingBarcodeRef,
    detectedBarcode,
    isFoodNotFoundModalVisible,
    cameraResumeKey,
    handleLiveBarcodeScanned,
    handleBarcodeTextSearchSubmit,
    processBarcodeImage,
    captureWithLiveScanSuppressed,
    handleBarcodeLookupComplete,
    handleFoodDetailsClose,
    handleFoodNotFoundClose,
  };
}
