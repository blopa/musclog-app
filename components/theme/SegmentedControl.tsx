import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type Option = {
  label: string;
  value: string;
  icon?: ReactNode;
};

type SegmentedControlVariant = 'elevated' | 'outline' | 'gradient';

type TestSegmentedControlProps = {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: SegmentedControlVariant;
};

export function SegmentedControl({
  options,
  value,
  onValueChange,
  variant = 'elevated',
}: TestSegmentedControlProps) {
  const theme = useTheme();
  const containerBase = 'flex-row rounded-lg p-1';

  const getContainerClass = (variant: SegmentedControlVariant): string => {
    switch (variant) {
      case 'elevated':
        return `${containerBase} bg-bg-cardElevated shadow-md`;
      case 'gradient':
        return `${containerBase} bg-bg-cardElevated`;
      case 'outline':
        return `${containerBase} bg-transparent border border-border-light`;
      default:
        return `${containerBase} bg-bg-card`;
    }
  };

  const containerClass = getContainerClass(variant);

  return (
    <View className={containerClass}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <Pressable
            key={option.value}
            className={`flex-1 rounded-md py-2 ${variant !== 'gradient' && isSelected ? 'bg-bg-card' : ''}`}
            onPress={() => onValueChange(option.value)}
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
          >
            {variant === 'gradient' && isSelected ? (
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: theme.spacing.padding.sm,
                  borderRadius: theme.borderRadius.sm,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: theme.colors.accent.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center justify-center gap-1.5">
                  {option.icon}
                  <Text className="text-center text-xs font-bold text-text-primary">
                    {option.label}
                  </Text>
                </View>
              </LinearGradient>
            ) : (
              <View
                className="flex-row items-center justify-center gap-1.5"
                style={
                  variant === 'gradient' ? { paddingVertical: theme.spacing.padding.sm } : undefined
                }
              >
                {option.icon}
                <Text
                  className={`text-center ${variant === 'gradient' ? 'text-xs' : 'text-sm'} font-bold ${
                    isSelected ? 'text-text-primary' : 'text-text-tertiary'
                  }`}
                >
                  {option.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
