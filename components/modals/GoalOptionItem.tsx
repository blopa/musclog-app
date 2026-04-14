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
};

export function GoalOptionItem({
  icon,
  title,
  description,
  onPress,
  isRecommended = false,
  recommendedText,
}: GoalOptionItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          borderRadius: 16,
          borderWidth: isRecommended ? 1.5 : 1,
          borderColor: isRecommended ? theme.colors.accent.primary : theme.colors.border.light,
          backgroundColor: isRecommended ? theme.colors.accent.primary10 : theme.colors.background.card,
          padding: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View
            style={{
              borderRadius: 12,
              padding: 12,
              backgroundColor: isRecommended ? theme.colors.accent.primary20 : theme.colors.background.secondaryDark,
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
                  color: theme.colors.text.primary,
                }}
              >
                {title}
              </Text>
              {isRecommended && recommendedText && (
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
              )}
            </View>
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.secondary,
              }}
            >
              {description}
            </Text>
          </View>
          <ChevronRight
            size={theme.iconSize.sm}
            color={isRecommended ? theme.colors.accent.primary : theme.colors.text.secondary}
            style={{ marginTop: 2 }}
          />
        </View>
      </View>
    </Pressable>
  );
}
