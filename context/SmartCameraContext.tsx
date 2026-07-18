import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useCameraPermissions } from '@/components/CameraView';
import { BarcodeCameraModal } from '@/components/modals/BarcodeCameraModal';
import SmartCameraModal, { type CameraMode } from '@/components/modals/SmartCameraModal';
import type { MealType } from '@/database/models';
import { useSettings } from '@/hooks/useSettings';

export type { CameraMode };

type OpenCameraOptions = {
  mode?: CameraMode;
  hideCameraModePicker?: boolean;
  logDate?: Date;
  mealType?: MealType;
  showBarcodeTextSearch?: boolean;
  onBarcodeScanned?: (data: string) => void;
};

type SmartCameraContextType = {
  openCamera: (options?: OpenCameraOptions) => void;
  setCurrentDate: (date: Date | undefined) => void;
};

const SmartCameraContext = createContext<SmartCameraContextType | undefined>(undefined);

export function SmartCameraProvider({ children }: { children: ReactNode }) {
  const { isAiConfigured, isAiMealPhotoEnabled, useOcrBeforeAi } = useSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('barcode-scan');
  const [hideCameraModePicker, setHideCameraModePicker] = useState(false);
  const [logDate, setLogDate] = useState<Date | undefined>(undefined);
  const [mealTypeForLog, setMealTypeForLog] = useState<MealType | undefined>(undefined);
  const [showBarcodeTextSearch, setShowBarcodeTextSearch] = useState(false);
  const onBarcodeScannedRef = useRef<((data: string) => void) | undefined>(undefined);
  const [hasBarcodeCallback, setHasBarcodeCallback] = useState(false);

  // Permission lives here so useCameraPermissions() is mounted for the app's lifetime and
  // both camera modals share one request flow. On native the underlying check is synchronous,
  // so `permission` is never null; on web it is null only while a supported browser's
  // Permissions API query resolves (the shell renders its "requesting permission" state for
  // that moment — see utils/webCameraPermissions.ts).
  const [permission, requestPermission] = useCameraPermissions();

  // Request permission when the camera opens and we know it isn't granted.
  // Guard on permission !== null to avoid triggering while the web check is in flight.
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    if (permission !== null && !permission.granted) {
      requestPermission();
    }
  }, [isVisible, permission, requestPermission]);

  const permissionGranted = permission?.granted ?? null;

  const openCamera = useCallback((options?: OpenCameraOptions) => {
    setCameraMode(options?.mode ?? 'barcode-scan');
    setHideCameraModePicker(options?.hideCameraModePicker ?? false);
    setLogDate(options?.logDate);
    setMealTypeForLog(options?.mealType);
    setShowBarcodeTextSearch(options?.showBarcodeTextSearch ?? false);
    onBarcodeScannedRef.current = options?.onBarcodeScanned;
    setHasBarcodeCallback(!!options?.onBarcodeScanned);
    setIsVisible(true);
  }, []);

  const handleCameraModalClose = useCallback(() => {
    setIsVisible(false);
    setMealTypeForLog(undefined);
    setShowBarcodeTextSearch(false);
    onBarcodeScannedRef.current = undefined;
    setHasBarcodeCallback(false);
  }, []);

  const setCurrentDate = useCallback((date: Date | undefined) => {
    setLogDate(date);
  }, []);

  const handleBarcodeScanned = useCallback((data: string) => {
    onBarcodeScannedRef.current?.(data);
  }, []);

  const value = useMemo(() => ({ openCamera, setCurrentDate }), [openCamera, setCurrentDate]);

  return (
    <SmartCameraContext.Provider value={value}>
      {children}
      {isVisible && hasBarcodeCallback ? (
        <BarcodeCameraModal
          visible={isVisible}
          onClose={handleCameraModalClose}
          onBarcodeScanned={handleBarcodeScanned}
          showBarcodeTextSearch={showBarcodeTextSearch}
          logDate={logDate}
          mealTypeForLog={mealTypeForLog}
          permissionGranted={permissionGranted}
          onRequestPermission={requestPermission}
        />
      ) : null}
      {isVisible && !hasBarcodeCallback ? (
        <SmartCameraModal
          visible={isVisible}
          onClose={handleCameraModalClose}
          mode={cameraMode}
          hideCameraModePicker={hideCameraModePicker}
          isAiEnabled={isAiConfigured}
          isAIVisionEnabled={isAiMealPhotoEnabled}
          useOcrBeforeAi={useOcrBeforeAi}
          showBarcodeTextSearch={showBarcodeTextSearch}
          logDate={logDate}
          mealTypeForLog={mealTypeForLog}
          permissionGranted={permissionGranted}
          onRequestPermission={requestPermission}
        />
      ) : null}
    </SmartCameraContext.Provider>
  );
}

export function useSmartCamera() {
  const context = useContext(SmartCameraContext);
  if (context === undefined) {
    throw new Error('useSmartCamera must be used within a SmartCameraProvider');
  }

  return context;
}
