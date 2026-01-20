import React, { memo, useMemo, useCallback } from 'react';
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

const OptionItem = memo(
  <T extends string | number>({
    option,
    isSelected,
    onSelect,
  }: {
    option: SelectorOption<T>;
    isSelected: boolean;
    onSelect: (id: T) => void;
  }) => {
    const Icon = option.icon as any;
    const handlePress = useCallback(() => {
      onSelect(option.id);
    }, [option.id, onSelect]);

    return (
      <Pressable key={option.id} onPress={handlePress}>
        {({ pressed }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: theme.spacing.padding.base,
              borderRadius: theme.borderRadius.md,
              borderWidth: theme.borderWidth.thin,
              borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
              backgroundColor: theme.colors.background.card,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              ...(isSelected ? theme.shadows.accentGlow : {}),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.gap.base,
                flex: 1,
              }}
            >
              <View
                style={{
                  width: theme.size['10'],
                  height: theme.size['10'],
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: option.iconBgColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={theme.iconSize.lg} color={option.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.primary,
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.secondary,
                    marginTop: theme.spacing.padding.xsHalf,
                  }}
                >
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
                borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.default,
                backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected && (
                <Check
                  size={theme.iconSize.xs}
                  color={theme.colors.text.black}
                  strokeWidth={theme.strokeWidth.thick}
                />
              )}
            </View>
          </View>
        )}
      </Pressable>
    );
  }
) as <T extends string | number>(props: {
  option: SelectorOption<T>;
  isSelected: boolean;
  onSelect: (id: T) => void;
}) => React.ReactElement;

export function OptionsSelector<T extends string | number>({
  title,
  options,
  selectedId,
  onSelect,
}: OptionsSelectorProps<T>) {
  // Memoize the onSelect callback to prevent OptionItem re-renders
  const stableOnSelect = useCallback(
    (id: T) => {
      onSelect(id);
    },
    [onSelect]
  );

  // Memoize the options list with selection state
  const optionItems = useMemo(
    () =>
      options.map((option) => (
        <OptionItem
          key={option.id}
          option={option}
          isSelected={selectedId === option.id}
          onSelect={stableOnSelect}
        />
      )),
    [options, selectedId, stableOnSelect]
  );

  return (
    <View>
      <Text
        style={{
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.extraWide,
          marginBottom: theme.spacing.padding.base,
          paddingHorizontal: theme.spacing.padding.xs,
        }}
      >
        {title}
      </Text>
      <View style={{ gap: theme.spacing.gap.md }}>{optionItems}</View>
    </View>
  );
}
