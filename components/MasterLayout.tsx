import { StatusBar } from 'expo-status-bar';
import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { CoachModal } from './modals/CoachModal';
import SmartCameraModal from './modals/SmartCameraModal';
import { NavigationMenu } from './NavigationMenu';

type MasterLayoutProps = {
  children: ReactNode;
  showNavigationMenu?: boolean;
};

export function MasterLayout({ children, showNavigationMenu = true }: MasterLayoutProps) {
  const theme = useTheme();
  const { isAiFeaturesEnabled, useOcrBeforeAi } = useSettings();
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);
  const [isCameraModalVisible, setIsCameraModalVisible] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 bg-bg-primary"
      edges={showNavigationMenu ? ['top'] : ['top', 'bottom']}
    >
      <StatusBar style="light" />
      {isCoachModalVisible ? (
        <CoachModal visible={isCoachModalVisible} onClose={() => setIsCoachModalVisible(false)} />
      ) : null}
      {isCameraModalVisible ? (
        <SmartCameraModal
          visible={isCameraModalVisible}
          onClose={() => setIsCameraModalVisible(false)}
          isAiEnabled={isAiFeaturesEnabled}
          useOcrBeforeAi={useOcrBeforeAi}
        />
      ) : null}
      <View className="relative flex-1 overflow-hidden">{children}</View>
      {showNavigationMenu ? (
        <>
          <NavigationMenu
            onCoachPress={() => setIsCoachModalVisible(true)}
            onCameraPress={() => setIsCameraModalVisible(true)}
          />
          <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
        </>
      ) : null}
    </SafeAreaView>
  );
}
