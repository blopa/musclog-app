import { Search } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CameraView, type CameraViewRef } from '@/components/CameraView';
import type { MealType } from '@/database/models';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { BARCODE_PHOTO_QUALITY, useCameraCaptureFlow } from '@/hooks/useCameraCaptureFlow';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useTheme } from '@/hooks/useTheme';

import { BarcodeTextSearchSheet } from './BarcodeTextSearchSheet';
import { FoodMealTrackingDetailsModal } from './FoodMealTrackingDetailsModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import type { CameraMode } from './SmartCameraModal';
import { SmartCameraShell } from './SmartCameraShell';

type BarcodeCameraModalProps = {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned?: (data: string) => void;
  showBarcodeTextSearch?: boolean;
  logDate?: Date;
  mealTypeForLog?: MealType;
  permissionGranted: boolean | null;
  onRequestPermission: () => void;
};

const CAMERA_MODE: CameraMode = 'barcode-scan';

export function BarcodeCameraModal({
  visible,
  onClose,
  onBarcodeScanned,
  showBarcodeTextSearch = false,
  logDate,
  mealTypeForLog,
  permissionGranted,
  onRequestPermission,
}: BarcodeCameraModalProps) {
  const theme = useTheme();
  const cameraRef = useRef<CameraViewRef>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isBarcodeTextSearchModalVisible, setIsBarcodeTextSearchModalVisible] = useState(false);
  const [barcodeTextSearchValue, setBarcodeTextSearchValue] = useState('');

  const barcode = useBarcodeScanner({ visible, onBarcodeScanned, onClose });
  const { isSearchingBarcodeRef } = barcode;

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setIsBarcodeTextSearchModalVisible(false);
        setBarcodeTextSearchValue('');
      };
      reset();
      isSearchingBarcodeRef.current = false;
    }
  }, [visible, isSearchingBarcodeRef]);

  const isFoodDetailsModalVisible = barcode.detectedBarcode !== null;

  // Every conditionally-rendered child modal in the JSX below MUST have its visibility
  // flag listed here — the camera is active only while none of them covers it.
  const isAnyChildModalVisible = [
    isBarcodeTextSearchModalVisible,
    barcode.isFoodNotFoundModalVisible,
    isFoodDetailsModalVisible,
  ].some(Boolean);

  const isCameraActive = visible && !barcode.isSearchingBarcode && !isAnyChildModalVisible;

  useKeepScreenAwake('barcode-camera-processing', visible && barcode.isSearchingBarcode);

  const handleClose = useCallback(() => {
    isSearchingBarcodeRef.current = false;
    onClose();
  }, [isSearchingBarcodeRef, onClose]);

  const handleFlashToggle = useCallback(() => {
    setFlashEnabled((prev) => !prev);
  }, []);

  const { takePicture, pickFromGallery } = useCameraCaptureFlow({
    cameraRef,
    quality: BARCODE_PHOTO_QUALITY,
    process: barcode.processBarcodeImage,
  });

  const handleBarcodeTextSearchSubmit = useCallback(() => {
    const value = barcodeTextSearchValue.trim();
    setIsBarcodeTextSearchModalVisible(false);
    setBarcodeTextSearchValue('');
    barcode.handleBarcodeTextSearchSubmit(value);
  }, [barcode, barcodeTextSearchValue]);

  const bottomRightControl = showBarcodeTextSearch ? (
    <Pressable
      onPress={() => setIsBarcodeTextSearchModalVisible(true)}
      className="h-12 w-12 items-center justify-center rounded-full"
      style={{
        backgroundColor: theme.colors.background.darkGray50,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.background.white10,
      }}
    >
      <Search size={theme.iconSize.lg} color={theme.colors.text.primary} />
    </Pressable>
  ) : (
    <View className="h-12 w-12" />
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      <SmartCameraShell
        visible={visible}
        onClose={handleClose}
        permissionGranted={permissionGranted}
        onRequestPermission={onRequestPermission}
        cameraSlot={
          isCameraActive ? (
            <CameraView
              key={`barcode-camera-${barcode.cameraResumeKey}`}
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
              enableTorch={flashEnabled}
              active={true}
              onBarcodeScanned={barcode.handleLiveBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                  'code93',
                ],
              }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.colors.background.darkGreenSolid }} />
          )
        }
        isLoading={barcode.isSearchingBarcode}
        cameraMode={CAMERA_MODE}
        flashEnabled={flashEnabled}
        onFlashToggle={handleFlashToggle}
        onGalleryPress={pickFromGallery}
        onShutterPress={takePicture}
        bottomRightControl={bottomRightControl}
        showModePicker={false}
      >
        {/* Barcode Text Search Sheet */}
        {isBarcodeTextSearchModalVisible ? (
          <BarcodeTextSearchSheet
            visible={isBarcodeTextSearchModalVisible}
            value={barcodeTextSearchValue}
            onChangeText={setBarcodeTextSearchValue}
            onClose={() => setIsBarcodeTextSearchModalVisible(false)}
            onSubmit={handleBarcodeTextSearchSubmit}
          />
        ) : null}

        {/* Food Details Modal */}
        {isFoodDetailsModalVisible ? (
          <FoodMealTrackingDetailsModal
            visible={isFoodDetailsModalVisible}
            onClose={barcode.handleFoodDetailsClose}
            barcode={barcode.detectedBarcode}
            onBarcodeLookupComplete={barcode.handleBarcodeLookupComplete}
            onFoodTracked={handleClose}
            isAiEnabled={false}
            canEdit={false}
            initialDate={logDate}
            initialMealType={mealTypeForLog}
          />
        ) : null}

        {/* Food Not Found Modal */}
        {barcode.isFoodNotFoundModalVisible ? (
          <FoodNotFoundModal
            visible={barcode.isFoodNotFoundModalVisible}
            onClose={barcode.handleFoodNotFoundClose}
            onSearchAgain={barcode.handleFoodNotFoundClose}
            isAiEnabled={false}
          />
        ) : null}
      </SmartCameraShell>
    </>
  );
}
