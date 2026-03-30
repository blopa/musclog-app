import { ReactNode, useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSmartCamera } from '../context/SmartCameraContext';
import { useTheme } from '../hooks/useTheme';
import { useCoach } from './CoachContext';
import { NavigationMenu } from './NavigationMenu';

type MasterLayoutProps = {
  children: ReactNode;
  showNavigationMenu?: boolean;
};

export function MasterLayout({ children, showNavigationMenu = true }: MasterLayoutProps) {
  const theme = useTheme();
  const { openCamera } = useSmartCamera();
  const { openCoach } = useCoach();
  const insets = useSafeAreaInsets();

  // Stable reference so NavigationMenu (wrapped in memo) does not re-render
  // when this layout re-renders due to screen state changes.
  const handleCameraPress = useCallback(() => openCamera(), [openCamera]);

  return (
    <View className="flex-1 bg-bg-primary" style={{ paddingTop: insets.top }}>
      <View className="relative flex-1 overflow-hidden">{children}</View>
      {showNavigationMenu ? (
        <>
          <NavigationMenu onCoachPress={openCoach} onCameraPress={handleCameraPress} />
          <View pointerEvents="none" style={{ height: theme.spacing.padding['4xl'] }} />
        </>
      ) : null}
    </View>
  );
}
