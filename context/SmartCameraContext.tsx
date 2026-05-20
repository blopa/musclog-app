import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useCameraPermissions } from '@/components/CameraView';
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
  const [permission, requestPermission] = useCameraPermissions();
  const [isVisible, setIsVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('barcode-scan');
  const [hideCameraModePicker, setHideCameraModePicker] = useState(false);
  const [logDate, setLogDate] = useState<Date | undefined>(undefined);
  const [mealTypeForLog, setMealTypeForLog] = useState<MealType | undefined>(undefined);
  const [showBarcodeTextSearch, setShowBarcodeTextSearch] = useState(false);
  const onBarcodeScannedRef = useRef<((data: string) => void) | undefined>(undefined);

  const openCamera = useCallback((options?: OpenCameraOptions) => {
    setCameraMode(options?.mode ?? 'barcode-scan');
    setHideCameraModePicker(options?.hideCameraModePicker ?? false);
    setLogDate(options?.logDate);
    setMealTypeForLog(options?.mealType);
    setShowBarcodeTextSearch(options?.showBarcodeTextSearch ?? false);
    onBarcodeScannedRef.current = options?.onBarcodeScanned;
    setIsVisible(true);
  }, []);

  const handleCameraModalClose = useCallback(() => {
    setIsVisible(false);
    setMealTypeForLog(undefined);
    setShowBarcodeTextSearch(false);
    onBarcodeScannedRef.current = undefined;
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
      {isVisible ? (
        <SmartCameraModal
          visible={isVisible}
          onClose={handleCameraModalClose}
          permission={permission}
          requestPermission={requestPermission}
          mode={cameraMode}
          hideCameraModePicker={hideCameraModePicker}
          isAiEnabled={onBarcodeScannedRef.current ? false : isAiConfigured}
          isAIVisionEnabled={isAiMealPhotoEnabled}
          useOcrBeforeAi={useOcrBeforeAi}
          showBarcodeTextSearch={showBarcodeTextSearch}
          logDate={logDate}
          mealTypeForLog={mealTypeForLog}
          onBarcodeScanned={onBarcodeScannedRef.current ? handleBarcodeScanned : undefined}
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
