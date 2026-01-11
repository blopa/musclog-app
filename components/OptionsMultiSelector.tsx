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

type OptionsMultiSelectorProps<T extends string | number> = {
  title: string;
  options: SelectorOption<T>[];
  selectedIds?: T[];
  onChange: (ids: T[]) => void;
};

export function OptionsMultiSelector<T extends string | number>({
  title,
  options,
  selectedIds = [],
  onChange,
}: OptionsMultiSelectorProps<T>) {
  const isSelected = (id: T) => selectedIds.includes(id);

  const toggle = (id: T) => {
    if (isSelected(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

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
          const selected = isSelected(option.id);
          return (
            <Pressable
              key={String(option.id)}
              onPress={() => toggle(option.id)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.padding.base,
                  borderRadius: theme.borderRadius.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
                  backgroundColor: selected
                    ? theme.colors.accent.primary10
                    : theme.colors.background.card,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...(selected ? theme.shadows.accentGlow : {}),
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
                  borderRadius: theme.borderRadius.sm,
                  borderWidth: theme.borderWidth.medium,
                  borderColor: selected
                    ? theme.colors.accent.primary
                    : theme.colors.border.default,
                  backgroundColor: selected ? theme.colors.accent.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {selected && (
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

export default OptionsMultiSelector;
