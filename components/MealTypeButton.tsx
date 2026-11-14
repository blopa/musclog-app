import { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type MealTypeButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  span?: number;
  /**
   * Share of the row this tile takes (a `flex` weight). The tile is a direct child of its row, so
   * the row's `alignItems: stretch` makes every tile in it as tall as the tallest one.
   */
  flex?: number;
};

/** A meal-type tile: one neutral icon, accent on press. Meals are not color-coded. */
export function MealTypeButton({
  icon: Icon,
  label,
  onPress,
  span = 1,
  flex = 1,
}: MealTypeButtonProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`${
        span === 2 ? 'flex-row' : 'flex-col'
      } items-center justify-center gap-2 rounded-card border border-border-default bg-bg-overlay p-3`}
      // A static style (not a `({ pressed }) => …` function): on web the function form dropped
      // `minHeight`, so the tiles ignored their minimum height. Never give the tile a `flexGrow`
      // inside a wrapper: on native, Yoga then grows it to the whole available height (the Add food
      // sheet's tiles filled the sheet and overlapped the list below).
      style={{
        flex,
        minHeight: theme.size['22'],
        borderColor: pressed ? theme.colors.accent.primary : theme.colors.border.default,
      }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      android_ripple={{ color: theme.colors.background.ink10 }}
      {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
    >
      <Icon
        size={theme.iconSize.md}
        color={pressed ? theme.colors.accent.primary : theme.colors.text.secondary}
      />
      <Text className="text-xs font-medium text-text-primary">{label}</Text>
    </Pressable>
  );
}
