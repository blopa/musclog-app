/**
 * Web stub for the optical-transfer receiving camera.
 *
 * `react-native-vision-camera` throws at module init on web ("VisionCamera currently does not
 * work on web"), and the import chain reaches the web bundle even though the feature is hidden
 * there: DataSettingsModal -> OpticalTransferModal -> OpticalReceiveModal -> this component. Same
 * arrangement as `components/CameraView.web.tsx` and `app/app/test/reps-recording.web.tsx`.
 *
 * Receiving needs a camera pointed at another phone's screen, so there is nothing meaningful to
 * implement here — the entry point in DataSettingsModal is already gated on `Platform.OS !== 'web'`
 * and this message only shows if some other route reaches the component.
 */

import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { Code, CodeScannerFrame } from 'react-native-vision-camera';

interface OpticalScannerCameraProps {
  active: boolean;
  onCodeScanned: (codes: Code[], frame: CodeScannerFrame) => void;
  onError?: (error: Error) => void;
  onStarted?: () => void;
}

export function OpticalScannerCamera(_props: OpticalScannerCameraProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-center text-sm text-text-secondary">
        {t('opticalTransfer.nativeOnly')}
      </Text>
    </View>
  );
}
