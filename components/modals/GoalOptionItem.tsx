import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type GoalOptionItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
  isRecommended?: boolean;
  recommendedText?: string;
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
  recommendedText,
  isSelected = false,
  disabled = false,
  showChevron = true,
}: GoalOptionItemProps) {
  const theme = useTheme();
  const isActive = isRecommended || isSelected;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 })}
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                flexWrap: 'wrap',
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: disabled ? theme.colors.text.tertiary : theme.colors.text.primary,
                }}
              >
                {title}
              </Text>
              {isRecommended && recommendedText ? (
                <View
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: theme.colors.accent.primary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: '#fff',
                    }}
                  >
                    {recommendedText}
                  </Text>
                </View>
              ) : null}
            </View>
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
