import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import SmartCameraModal, { type CameraMode } from '@/components/modals/SmartCameraModal';
import type { MealType } from '@/database/models';
import { useSettings } from '@/hooks/useSettings';

export type { CameraMode };

type OpenCameraOptions = {
  mode?: CameraMode;
  hideCameraModePicker?: boolean;
  logDate?: Date;
  mealType?: MealType;
};

type SmartCameraContextType = {
  openCamera: (options?: OpenCameraOptions) => void;
  setCurrentDate: (date: Date | undefined) => void;
};

const SmartCameraContext = createContext<SmartCameraContextType | undefined>(undefined);

export function SmartCameraProvider({ children }: { children: ReactNode }) {
  const { isAiConfigured, useOcrBeforeAi } = useSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('barcode-scan');
  const [hideCameraModePicker, setHideCameraModePicker] = useState(false);
  const [logDate, setLogDate] = useState<Date | undefined>(undefined);
  const [mealTypeForLog, setMealTypeForLog] = useState<MealType | undefined>(undefined);

  const openCamera = useCallback((options?: OpenCameraOptions) => {
    setCameraMode(options?.mode ?? 'barcode-scan');
    setHideCameraModePicker(options?.hideCameraModePicker ?? false);
    setLogDate(options?.logDate);
    setMealTypeForLog(options?.mealType);
    setIsVisible(true);
  }, []);

  const handleCameraModalClose = useCallback(() => {
    setIsVisible(false);
    setMealTypeForLog(undefined);
  }, []);

  const setCurrentDate = useCallback((date: Date | undefined) => {
    setLogDate(date);
  }, []);

  return (
    <SmartCameraContext.Provider value={{ openCamera, setCurrentDate }}>
      {children}
      {isVisible ? (
        <SmartCameraModal
          visible={isVisible}
          onClose={handleCameraModalClose}
          mode={cameraMode}
          hideCameraModePicker={hideCameraModePicker}
          isAiEnabled={isAiConfigured}
          useOcrBeforeAi={useOcrBeforeAi}
          logDate={logDate}
          mealTypeForLog={mealTypeForLog}
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
