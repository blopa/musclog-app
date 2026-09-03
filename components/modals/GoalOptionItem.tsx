import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type GoalOptionItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  /** Applies the same accent-tinted border/background/icon-well treatment as isSelected —
   *  that tint is the option's whole "this one is preferred" signal; it does not also render
   *  a "Recommended" badge, which would just repeat what the tint already says. */
  isRecommended?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
};

export function GoalOptionItem({
  icon,
  title,
  description,
  onPress,
  isRecommended = false,
  isSelected = false,
  disabled = false,
  showChevron = true,
}: GoalOptionItemProps) {
  const theme = useTheme();
  const isActive = isRecommended || isSelected;
  const getPressedOpacity = (pressed: boolean) => {
    if (disabled) {
      return 0.5;
    }

    if (pressed) {
      return 0.85;
    }

    return 1;
  };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({ opacity: getPressedOpacity(pressed) })}
    >
      <View
        style={{
          borderRadius: 16,
          borderWidth: isActive ? 1.5 : 1,
          borderColor: isActive ? theme.colors.accent.primary : theme.colors.border.light,
          backgroundColor: isActive ? theme.colors.accent.primary10 : theme.colors.background.card,
          padding: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View
            style={{
              borderRadius: 12,
              padding: 12,
              backgroundColor: isActive
                ? theme.colors.accent.primary20
                : theme.colors.background.secondaryDark,
            }}
          >
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: disabled ? theme.colors.text.tertiary : theme.colors.text.primary,
                marginBottom: 4,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: disabled ? theme.colors.text.tertiary : theme.colors.text.secondary,
              }}
            >
              {description}
            </Text>
          </View>
          {showChevron && !disabled ? (
            <ChevronRight
              size={theme.iconSize.sm}
              color={isActive ? theme.colors.accent.primary : theme.colors.text.secondary}
              style={{ marginTop: 2 }}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
