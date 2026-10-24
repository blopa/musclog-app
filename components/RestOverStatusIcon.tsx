import { AlertCircle, Dumbbell } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function RestOverStatusIcon() {
  const theme = useTheme();

  return (
    <View className="relative mb-4 items-center justify-center">
      <View
        className="relative z-10 h-24 w-24 items-center justify-center rounded-full border"
        style={{
          backgroundColor: theme.colors.background.secondaryDark,
          borderColor: theme.colors.status.brandVivid20,
        }}
      >
        <Dumbbell
          size={theme.iconSize['5xl']}
          color={theme.colors.accent.primary}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>
      {/* Red Alert Badge */}
      <View
        className="absolute -right-1 -top-1 z-20 h-8 w-8 items-center justify-center rounded-full border-4"
        style={{
          backgroundColor: theme.colors.status.error,
          borderColor: theme.colors.background.primary,
        }}
      >
        <AlertCircle
          size={theme.iconSize.sm}
          color={theme.colors.text.primary}
          strokeWidth={theme.borderWidth.thick}
        />
      </View>
    </View>
  );
}
