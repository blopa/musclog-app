import { LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type MealTypeButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  span?: number;
};

/** A meal-type tile: one neutral icon, accent on press. Meals are not color-coded. */
export function MealTypeButton({ icon: Icon, label, onPress, span = 1 }: MealTypeButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`${
        span === 2 ? 'flex-row' : 'flex-col'
      } items-center justify-center gap-2 rounded-2xl border border-border-default bg-bg-overlay p-3`}
      style={({ pressed }) => ({
        minHeight: theme.size['22'],
        borderColor: pressed ? theme.colors.accent.primary : theme.colors.border.default,
      })}
      onPress={onPress}
      android_ripple={{ color: theme.colors.background.ink10 }}
      {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
    >
      {({ pressed }) => (
        <>
          <Icon
            size={theme.iconSize.md}
            color={pressed ? theme.colors.accent.primary : theme.colors.text.secondary}
          />
          <Text className="text-xs font-medium text-text-primary">{label}</Text>
        </>
      )}
    </Pressable>
  );
}
