import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useTheme } from '../../../hooks/useTheme';
import { Theme } from '../../../theme';
import { ActionButtonsArea } from './ActionButtonsArea';
import {
  getGroupColor,
  getGroupPosition,
  GroupPosition,
  normalizeGroups,
  SelectorOption,
} from './utils';

type OptionsMultiSelectorProps<T extends string | number> = {
  title: string;
  options: SelectorOption<T>[];
  selectedIds?: T[];
  onChange: (ids: T[]) => void;
  isEditable?: boolean;
  hasGroups?: boolean;
  onOrderChange?: (reorderedOptions: SelectorOption<T>[]) => void;
  onDelete?: (ids: T[]) => void;
};

export function OptionsMultiSelector<T extends string | number>({
  title,
  options,
  selectedIds = [],
  onChange,
  isEditable = false,
  hasGroups = true,
  onOrderChange,
  onDelete,
}: OptionsMultiSelectorProps<T>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [orderedOptions, setOrderedOptions] = useState<SelectorOption<T>[]>(options);

  // Update orderedOptions when options prop changes, ensuring groups are contiguous
  useEffect(() => {
    setOrderedOptions(normalizeGroups(options));
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
  const showArrows = isEditable && selectionEnabled;

  // Check if we can group/ungroup selected items
  const selectedCount = selectedIds.length;
  const canGroup = selectedCount >= 2 && isEditable && selectionEnabled;
  const canDelete = selectedCount >= 1 && isEditable && selectionEnabled && !!onDelete;

  // Check if all selected items are already in the same group
  const selectedItems = useMemo(() => {
    return orderedOptions.filter((o) => selectedIds.includes(o.id));
  }, [orderedOptions, selectedIds]);

  const allSelectedInSameGroup = useMemo(() => {
    if (selectedItems.length < 2) {
      return false;
    }
    const firstGroupId = selectedItems[0]?.groupId;
    if (!firstGroupId) {
      return false;
    }
    return selectedItems.every((item) => item.groupId === firstGroupId);
  }, [selectedItems]);

  // Generate a unique groupId
  const generateGroupId = () => {
    return `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle grouping/ungrouping
  const handleGroupAction = () => {
    if (!canGroup) {
      return;
    }

    // Generate groupId ONCE before mapping (not inside the map)
    const newGroupId = allSelectedInSameGroup ? undefined : generateGroupId();

    const updatedOptions = orderedOptions.map((option) => {
      if (selectedIds.includes(option.id)) {
        if (allSelectedInSameGroup) {
          // Ungroup: set groupId to undefined
          return { ...option, groupId: undefined };
        } else {
          // Group: assign the SAME groupId to all selected items
          return { ...option, groupId: newGroupId };
        }
      }
      return option;
    });

    // Normalize groups to ensure they're contiguous
    const normalized = normalizeGroups(updatedOptions);
    setOrderedOptions(normalized);
    onOrderChange?.(normalized);

    // Clear selection after grouping
    onChange([]);
  };

  // Handle delete
  const handleDelete = () => {
    if (!canDelete || !onDelete) {
      return;
    }

    onDelete(selectedIds);
    // Selection is cleared by the onDelete handler
  };

  // Returns the contiguous indices of the group the item at `index` belongs to,
  // or just [index] if the item has no group.
  const getGroupIndices = (index: number): number[] => {
    const groupId = orderedOptions[index]?.groupId;
    if (!groupId) {
      return [index];
    }
    return orderedOptions.map((o, i) => (o.groupId === groupId ? i : -1)).filter((i) => i !== -1);
  };

  // Move item (and its whole group) up by one position
  const handleMoveUp = (index: number) => {
    const groupIndices = getGroupIndices(index);
    const firstIndex = groupIndices[0];
    if (firstIndex === 0) {
      return;
    }

    const newOptions = [...orderedOptions];
    // Take the item sitting just above the group and insert it after the group
    const itemAbove = newOptions[firstIndex - 1];
    newOptions.splice(firstIndex - 1, 1);
    newOptions.splice(firstIndex + groupIndices.length - 1, 0, itemAbove);
    setOrderedOptions(newOptions);
    onOrderChange?.(newOptions);
  };

  // Move item (and its whole group) down by one position
  const handleMoveDown = (index: number) => {
    const groupIndices = getGroupIndices(index);
    const lastIndex = groupIndices[groupIndices.length - 1];
    if (lastIndex === orderedOptions.length - 1) {
      return;
    }

    const newOptions = [...orderedOptions];
    // Take the item sitting just below the group and insert it before the group
    const itemBelow = newOptions[lastIndex + 1];
    newOptions.splice(lastIndex + 1, 1);
    newOptions.splice(groupIndices[0], 0, itemBelow);
    setOrderedOptions(newOptions);
    onOrderChange?.(newOptions);
  };

  const renderGroupIndicator = (
    groupPosition: GroupPosition,
    theme: Theme,
    groupId?: string,
    isFirstInGroup: boolean = false
  ) => {
    // Don't show group indicators if hasGroups is false
    if (!hasGroups || groupPosition === 'none') {
      return null;
    }

    const lineColor = getGroupColor(groupId, theme, orderedOptions);
    const lineWidth = theme.borderWidth.thick;
    const indicatorWidth = theme.size['4'];

    return (
      <View
        style={{
          width: indicatorWidth,
          alignItems: 'center',
          marginRight: theme.spacing.gap.sm,
          position: 'relative',
        }}
      >
        {/* Main vertical line */}
        <View
          style={{
            width: lineWidth,
            flex: 1,
            backgroundColor: lineColor,
            borderTopLeftRadius:
              groupPosition === 'first' || groupPosition === 'only' ? lineWidth : 0,
            borderTopRightRadius:
              groupPosition === 'first' || groupPosition === 'only' ? lineWidth : 0,
            borderBottomLeftRadius:
              groupPosition === 'last' || groupPosition === 'only' ? lineWidth : 0,
            borderBottomRightRadius:
              groupPosition === 'last' || groupPosition === 'only' ? lineWidth : 0,
          }}
        />
        {/* Small circle indicator at the top of each group */}
        {isFirstInGroup ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: (indicatorWidth - theme.size.sm) / 2,
              width: theme.size.sm,
              height: theme.size.sm,
              borderRadius: theme.borderRadius.xs,
              backgroundColor: lineColor,
              borderWidth: theme.borderWidth.medium,
              borderColor: theme.colors.background.primary,
            }}
          />
        ) : null}
      </View>
    );
  };

  const renderRegularItem = (option: SelectorOption<T>, index: number, theme: Theme) => {
    const Icon = option.icon as any;
    const selected = showCheckboxes && isSelected(option.id);
    const groupPosition = hasGroups ? getGroupPosition(orderedOptions, index) : 'none';
    const isFirstInGroup = groupPosition === 'first' || groupPosition === 'only';
    const groupColor =
      hasGroups && option.groupId
        ? getGroupColor(option.groupId, theme, orderedOptions)
        : undefined;

    const groupIndices = getGroupIndices(index);
    const isGroupFirst = groupIndices[0] === 0;
    const isGroupLast = groupIndices[groupIndices.length - 1] === orderedOptions.length - 1;

    return (
      <Animated.View
        key={String(option.id)}
        layout={LinearTransition.springify().damping(35).stiffness(360)}
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
        }}
      >
        {showArrows ? (
          <View
            style={{
              width: theme.size['4'],
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: theme.spacing.gap.sm,
              gap: theme.spacing.gap.xs,
            }}
          >
            <Pressable
              onPress={() => handleMoveUp(index)}
              disabled={isGroupFirst}
              hitSlop={8}
              style={{ opacity: isGroupFirst ? theme.colors.opacity.medium : 1 }}
            >
              <ChevronUp
                size={theme.iconSize.md}
                color={theme.colors.accent.primary}
                strokeWidth={theme.strokeWidth.medium}
              />
            </Pressable>
            <Pressable
              onPress={() => handleMoveDown(index)}
              disabled={isGroupLast}
              hitSlop={8}
              style={{
                opacity: isGroupLast ? theme.colors.opacity.medium : 1,
              }}
            >
              <ChevronDown
                size={theme.iconSize.md}
                color={theme.colors.accent.primary}
                strokeWidth={theme.strokeWidth.medium}
              />
            </Pressable>
          </View>
        ) : (
          renderGroupIndicator(groupPosition, theme, option.groupId, isFirstInGroup)
        )}
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => showCheckboxes && toggle(option.id)}
            disabled={!showCheckboxes}
            style={{ flex: 1 }}
          >
            {({ pressed }) => (
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.padding.base,
                  borderRadius: theme.borderRadius.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: selected
                    ? theme.colors.accent.primary
                    : hasGroups && groupColor
                      ? groupColor + '40'
                      : theme.colors.border.light,
                  backgroundColor:
                    hasGroups && groupColor ? groupColor + '08' : theme.colors.background.card,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...(selected ? theme.shadows.accentGlow : {}),
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
                {showCheckboxes ? (
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
                    }}
                  >
                    {selected ? (
                      <Check
                        size={theme.iconSize.xs}
                        color={theme.colors.text.black}
                        strokeWidth={theme.strokeWidth.thick}
                      />
                    ) : null}
                  </View>
                ) : (
                  <View />
                )}
              </View>
            )}
          </Pressable>
        </View>
      </Animated.View>
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
        }}
      >
        <Text
          style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: theme.typography.letterSpacing.extraWide,
          }}
        >
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
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text
                style={{
                  color: theme.colors.accent.primary,
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {t('optionsSelector.done')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setSelectionEnabled(true)}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text
                style={{
                  color: theme.colors.accent.primary,
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {t('optionsSelector.edit')}
              </Text>
            </Pressable>
          )
        ) : null}
      </View>

      {/* Fixed Action Buttons Area */}
      {selectionEnabled && (canGroup || canDelete) ? (
        <ActionButtonsArea
          canGroup={canGroup}
          canDelete={canDelete}
          allSelectedInSameGroup={allSelectedInSameGroup}
          selectedCount={selectedCount}
          onGroupAction={handleGroupAction}
          onDelete={handleDelete}
        />
      ) : null}

      <View style={{ gap: theme.spacing.gap.md }}>
        {orderedOptions.map((option, index) => renderRegularItem(option, index, theme))}
      </View>
    </View>
  );
}
