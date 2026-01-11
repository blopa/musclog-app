import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, LucideIcon } from 'lucide-react-native';
import { theme } from '../theme';

export type SelectorOption<T extends string | number> = {
  id: T;
  label: string;
  description: string;
  icon: LucideIcon | React.ComponentType<{ size: number; color: string }>;
  iconBgColor: string;
  iconColor: string;
};

type OptionsSelectorProps<T extends string | number> = {
  title: string;
  options: SelectorOption<T>[];
  selectedId?: T;
  onSelect: (id: T) => void;
};

export function OptionsSelector<T extends string | number>({
  title,
  options,
  selectedId,
  onSelect,
}: OptionsSelectorProps<T>) {
  return (
    <View>
      <Text
        style={{
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: theme.spacing.padding.base,
          paddingHorizontal: theme.spacing.padding.xs,
        }}>
        {title}
      </Text>
      <View style={{ gap: theme.spacing.gap.md }}>
        {options.map((option) => {
          const Icon = option.icon as any;
          const isSelected = selectedId === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.padding.base,
                  borderRadius: theme.borderRadius.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
                  backgroundColor: isSelected
                    ? theme.colors.accent.primary10
                    : theme.colors.background.card,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...(isSelected ? theme.shadows.accentGlow : {}),
                },
              ]}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.gap.base,
                }}>
                <View
                  style={{
                    width: theme.size['10'],
                    height: theme.size['10'],
                    borderRadius: theme.borderRadius.full,
                    backgroundColor: option.iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon size={theme.iconSize.lg} color={option.iconColor} />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.text.primary,
                    }}>
                    {option.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.secondary,
                      marginTop: theme.spacing.padding.xs / 4,
                    }}>
                    {option.description}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: theme.size['6'],
                  height: theme.size['6'],
                  borderRadius: theme.borderRadius.full,
                  borderWidth: theme.borderWidth.medium,
                  borderColor: isSelected
                    ? theme.colors.accent.primary
                    : theme.colors.border.default,
                  backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {isSelected && (
                  <Check
                    size={theme.iconSize.xs}
                    color={theme.colors.text.black}
                    strokeWidth={theme.strokeWidth.thick}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

