import { StatusBar } from 'expo-status-bar';
import { ReactNode, useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { useCoach } from './CoachContext';
import { NavigationMenu } from './NavigationMenu';
import { useSmartCamera } from './SmartCameraContext';

type MasterLayoutProps = {
  children: ReactNode;
  showNavigationMenu?: boolean;
};

export function MasterLayout({ children, showNavigationMenu = true }: MasterLayoutProps) {
  const theme = useTheme();
  const { openCamera } = useSmartCamera();
  const { openCoach } = useCoach();

  // Stable reference so NavigationMenu (wrapped in memo) does not re-render
  // when this layout re-renders due to screen state changes.
  const handleCameraPress = useCallback(() => openCamera(), [openCamera]);

  return (
    <SafeAreaView
      className="flex-1 bg-bg-primary"
      edges={showNavigationMenu ? ['top'] : ['top', 'bottom']}
    >
      <StatusBar style="light" />
      <View className="relative flex-1 overflow-hidden">{children}</View>
      {showNavigationMenu ? (
        <>
          <NavigationMenu onCoachPress={openCoach} onCameraPress={handleCameraPress} />
          <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
        </>
      ) : null}
    </SafeAreaView>
  );
}
