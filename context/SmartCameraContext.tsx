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
import {
  getCachedCameraPermissionGranted,
  setCachedCameraPermissionGranted,
  waitForCachedCameraPermissionGranted,
} from '@/utils/cameraPermissionCache';

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

  // Permission lives here so useCameraPermissions() runs at app boot (context always
  // mounts) rather than when the user first opens the camera. This pays the ~10s
  // TurboModule cold-start cost during splash/navigation, not mid-session.
  // Note: app/index.tsx also calls useCameraPermissions() even earlier (during splash)
  // to give the TurboModule maximum warm-up time before the user reaches the camera.
  const [permission, requestPermission] = useCameraPermissions();

  // Cached permission for optimistic rendering while the TurboModule is initializing
  // (permission === null). Once permission resolves, the live value always wins.
  const [cachedPermissionGranted, setCachedPermissionGrantedState] = useState<boolean | null>(() =>
    getCachedCameraPermissionGranted()
  );

  // When the native check resolves, persist to AsyncStorage and update state.
  useEffect(() => {
    if (permission === null) {
      return;
    }

    const persist = () => {
      setCachedCameraPermissionGranted(permission.granted);
      setCachedPermissionGrantedState(permission.granted);
    };
    persist();
  }, [permission]);

  // Backfill optimistic state from AsyncStorage if the synchronous read returned null
  // (component mounted before the AsyncStorage promise resolved — rare but possible).
  useEffect(() => {
    if (cachedPermissionGranted !== null) {
      return;
    }

    let cancelled = false;
    waitForCachedCameraPermissionGranted().then((granted) => {
      if (!cancelled && granted !== null) {
        setCachedPermissionGrantedState(granted);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cachedPermissionGranted]);

  // Request permission when the camera opens and we know it isn't granted.
  // Guard on permission !== null to avoid triggering while the native check is in flight.
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    if (permission !== null && !permission.granted) {
      requestPermission();
    }
  }, [isVisible, permission, requestPermission]);

  // Live native value wins over the cache. Fall back to cache only while the
  // TurboModule is still initializing (permission === null) so we can show an
  // optimistic UI instead of always blocking on the cold-start delay.
  const effectivePermissionGranted =
    permission !== null ? permission.granted : cachedPermissionGranted;

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
          permissionGranted={effectivePermissionGranted}
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
          permissionGranted={effectivePermissionGranted}
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
