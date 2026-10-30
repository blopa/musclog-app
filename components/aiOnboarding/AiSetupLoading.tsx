import { ActivityIndicator, View } from 'react-native';

import { MasterLayout } from '@/components/MasterLayout';
import { useTheme } from '@/hooks/useTheme';

/** Shown while a saved AI-setup session is being read. */
export function AiSetupLoading() {
  const theme = useTheme();

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={theme.colors.accent.primary} />
      </View>
    </MasterLayout>
  );
}
