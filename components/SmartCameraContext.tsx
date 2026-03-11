import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { useSettings } from '../hooks/useSettings';
import SmartCameraModal, { type CameraMode } from './modals/SmartCameraModal';

export type { CameraMode };

type OpenCameraOptions = {
  mode?: CameraMode;
  hideCameraModePicker?: boolean;
};

type SmartCameraContextType = {
  openCamera: (options?: OpenCameraOptions) => void;
};

const SmartCameraContext = createContext<SmartCameraContextType | undefined>(undefined);

export function SmartCameraProvider({ children }: { children: ReactNode }) {
  const { isAiFeaturesEnabled, useOcrBeforeAi } = useSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('ai-meal-photo');
  const [hideCameraModePicker, setHideCameraModePicker] = useState(false);

  const openCamera = useCallback((options?: OpenCameraOptions) => {
    setCameraMode(options?.mode ?? 'ai-meal-photo');
    setHideCameraModePicker(options?.hideCameraModePicker ?? false);
    setIsVisible(true);
  }, []);

  return (
    <SmartCameraContext.Provider value={{ openCamera }}>
      {children}
      {isVisible ? (
        <SmartCameraModal
          visible={isVisible}
          onClose={() => setIsVisible(false)}
          mode={cameraMode}
          hideCameraModePicker={hideCameraModePicker}
          isAiEnabled={isAiFeaturesEnabled}
          useOcrBeforeAi={useOcrBeforeAi}
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
