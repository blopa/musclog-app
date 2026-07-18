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

  // Permission lives here so useCameraPermissions() is mounted for the app's lifetime
  // rather than only while the camera is open. react-native-vision-camera's permission
  // check (Camera.getCameraPermissionStatus()) is synchronous, so `permission` is never
  // actually null in practice — the null branches below are kept as a defensive fallback
  // (and to preserve the optimistic-cache layer in utils/cameraPermissionCache.ts) rather
  // than because a native cold-start delay is expected here today.
  const [permission, requestPermission] = useCameraPermissions();

  // Cached permission for optimistic rendering on the rare chance `permission` is still
  // null on first read. Once permission resolves, the live value always wins.
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

  // Live native value wins over the cache. Fall back to cache only on the rare chance
  // `permission` is still null (see comment above) so we never show a placeholder UI
  // when we already know the answer from a previous session.
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
