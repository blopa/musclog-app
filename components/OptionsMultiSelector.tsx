import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, LucideIcon, ChevronUp, ChevronDown } from 'lucide-react-native';
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
  isEditable?: boolean;
  onOrderChange?: (reorderedOptions: SelectorOption<T>[]) => void;
};

export function OptionsMultiSelector<T extends string | number>({
  title,
  options,
  selectedIds = [],
  onChange,
  isEditable = false,
  onOrderChange,
}: OptionsMultiSelectorProps<T>) {
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [orderedOptions, setOrderedOptions] = useState<SelectorOption<T>[]>(options);

  // Update orderedOptions when options prop changes
  useEffect(() => {
    setOrderedOptions(options);
  }, [options]);

  const isSelected = (id: T) => selectedIds.includes(id);

  const toggle = (id: T) => {
    if (isSelected(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const showCheckboxes = !isEditable || selectionEnabled;
  const isDragMode = isEditable && selectionEnabled;

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= orderedOptions.length) return;

    const newOptions = [...orderedOptions];
    const [movedItem] = newOptions.splice(fromIndex, 1);
    newOptions.splice(toIndex, 0, movedItem);

    setOrderedOptions(newOptions);
    onOrderChange?.(newOptions);
  };

  const renderItem = (option: SelectorOption<T>, index: number) => {
    const Icon = option.icon as any;
    const selected = isSelected(option.id);
    const isFirst = index === 0;
    const isLast = index === orderedOptions.length - 1;

    return (
      <View
        key={String(option.id)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.gap.sm,
        }}>
        {/* Drag Handle - Only show in drag mode */}
        {isDragMode && (
          <View
            style={{
              flexDirection: 'column',
              gap: theme.spacing.gap.xs / 2,
            }}>
            <Pressable
              onPress={() => moveItem(index, index - 1)}
              disabled={isFirst}
              style={({ pressed }) => ({
                opacity: isFirst ? 0.3 : pressed ? 0.6 : 1,
                padding: theme.spacing.padding.xs / 2,
              })}>
              <ChevronUp
                size={theme.iconSize.md}
                color={theme.colors.text.secondary}
                strokeWidth={theme.strokeWidth.normal}
              />
            </Pressable>
            <Pressable
              onPress={() => moveItem(index, index + 1)}
              disabled={isLast}
              style={({ pressed }) => ({
                opacity: isLast ? 0.3 : pressed ? 0.6 : 1,
                padding: theme.spacing.padding.xs / 2,
              })}>
              <ChevronDown
                size={theme.iconSize.md}
                color={theme.colors.text.secondary}
                strokeWidth={theme.strokeWidth.normal}
              />
            </Pressable>
          </View>
        )}

        {/* Main Item */}
        <Pressable
          onPress={() => toggle(option.id)}
          style={({ pressed }) => [
            {
              flex: 1,
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
              flex: 1,
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
            <View style={{ flex: 1 }}>
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
          {showCheckboxes ? (
            <View
              style={{
                width: theme.size['6'],
                height: theme.size['6'],
                borderRadius: theme.borderRadius.sm,
                borderWidth: theme.borderWidth.medium,
                borderColor: selected ? theme.colors.accent.primary : theme.colors.border.default,
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
          ) : (
            <View />
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.padding.base,
          paddingHorizontal: theme.spacing.padding.xs,
        }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}>
          {title}
        </Text>
        {isEditable ? (
          selectionEnabled ? (
            <Pressable
              onPress={() => {
                // clear selections and exit edit mode
                try {
                  onChange([] as any);
                } catch (e) {
                  // ignore
                }
                setSelectionEnabled(false);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
              <Text
                style={{
                  color: theme.colors.accent.primary,
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.xs,
                }}>
                Done
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setSelectionEnabled(true)}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
              <Text
                style={{
                  color: theme.colors.accent.primary,
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.xs,
                }}>
                Edit
              </Text>
            </Pressable>
          )
        ) : null}
      </View>
      <View style={{ gap: theme.spacing.gap.md }}>
        {orderedOptions.map((option, index) => renderItem(option, index))}
      </View>
    </View>
  );
}
