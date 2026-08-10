import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { detectBarcodes } from '@/utils/file';
import { OpticalFrameProbe } from '@/utils/optical/frameProbe';
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
  // These scanners list `qr` among their code types, so a phone streaming an optical transfer
  // reads as a barcode here. See `utils/optical/frameProbe.ts` for why that must be caught before
  // the lookup rather than after it.
  const opticalProbeRef = useRef(new OpticalFrameProbe());
  const [isOpticalStreamDetected, setIsOpticalStreamDetected] = useState(false);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setIsSearchingBarcode(false);
        setDetectedBarcode(null);
        setIsFoodNotFoundModalVisible(false);
        setIsOpticalStreamDetected(false);
      };
      reset();
      isSearchingBarcodeRef.current = false;
      opticalProbeRef.current.reset();
    }
  }, [visible]);

  const dismissOpticalStreamHint = useCallback(() => {
    opticalProbeRef.current.dismiss();
    setIsOpticalStreamDetected(false);
  }, []);

  const handleLiveBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (isSearchingBarcodeRef.current) {
        return;
      }

      // Before the search latch, so a stream the user is pointed at keeps feeding the probe
      // instead of being swallowed by the first frame's own lookup. `'detected'` fires at most
      // once per stream, which is what keeps a 15–30/s callback from thrashing React state.
      const probed = opticalProbeRef.current.observe(data);
      if (probed !== 'ignored') {
        if (probed === 'detected') {
          setIsOpticalStreamDetected(true);
        }
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
    isOpticalStreamDetected,
    dismissOpticalStreamHint,
    cameraResumeKey,
    handleLiveBarcodeScanned,
    handleBarcodeTextSearchSubmit,
    processBarcodeImage,
    handleBarcodeLookupComplete,
    handleFoodDetailsClose,
    handleFoodNotFoundClose,
  };
}
