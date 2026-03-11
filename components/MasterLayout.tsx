import { StatusBar } from 'expo-status-bar';
import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { CoachModal } from './modals/CoachModal';
import { NavigationMenu } from './NavigationMenu';
import { useSmartCamera } from './SmartCameraContext';

type MasterLayoutProps = {
  children: ReactNode;
  showNavigationMenu?: boolean;
};

export function MasterLayout({ children, showNavigationMenu = true }: MasterLayoutProps) {
  const theme = useTheme();
  const { openCamera } = useSmartCamera();
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 bg-bg-primary"
      edges={showNavigationMenu ? ['top'] : ['top', 'bottom']}
    >
      <StatusBar style="light" />
      {isCoachModalVisible ? (
        <CoachModal visible={isCoachModalVisible} onClose={() => setIsCoachModalVisible(false)} />
      ) : null}
      <View className="relative flex-1 overflow-hidden">{children}</View>
      {showNavigationMenu ? (
        <>
          <NavigationMenu
            onCoachPress={() => setIsCoachModalVisible(true)}
            onCameraPress={() => openCamera()}
          />
          <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
        </>
      ) : null}
    </SafeAreaView>
  );
}
