import { Image, Text, View } from 'react-native';

import { SmartCameraRoundButton } from '@/components/SmartCameraActions';
import { useTheme } from '@/hooks/useTheme';

type MealDraftButtonProps = {
  /** The first photo of the meal being collected. */
  uri: string;
  count: number;
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * Sits beside the shutter while a meal has photos: the first photo with the count, a tap reopens
 * the details sheet. A thumbnail rather than an icon, so it reads as "your photos" and not as one
 * more camera control.
 */
export function MealDraftButton({ uri, count, accessibilityLabel, onPress }: MealDraftButtonProps) {
  const theme = useTheme();

  return (
    <View accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <SmartCameraRoundButton size="md" onPress={onPress}>
        <Image
          source={{ uri }}
          resizeMode="cover"
          style={{ width: 44, height: 44, borderRadius: 22 }}
        />
      </SmartCameraRoundButton>
      <View
        className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full px-1"
        style={{ backgroundColor: theme.colors.accent.primary }}
      >
        <Text
          className="text-xs font-semibold tabular-nums"
          style={{ color: theme.colors.text.onAccent }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}
