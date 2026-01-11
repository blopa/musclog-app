import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { Check, LucideIcon, GripVertical } from 'lucide-react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme';

// Helper to ensure items with the same groupId are contiguous
function normalizeGroups<T extends string | number>(
  options: SelectorOption<T>[]
): SelectorOption<T>[] {
  const result: SelectorOption<T>[] = [];
  const processedGroupIds = new Set<string>();

  for (const option of options) {
    // If no groupId, just add it
    if (!option.groupId) {
      result.push(option);
      continue;
    }

    // If we've already processed this group, skip (it was added when we first encountered it)
    if (processedGroupIds.has(option.groupId)) {
      continue;
    }

    // First time encountering this group - add all members of the group together
    processedGroupIds.add(option.groupId);
    const groupMembers = options.filter((o) => o.groupId === option.groupId);
    result.push(...groupMembers);
  }

  return result;
}

// Helper to determine an item's position within its group
type GroupPosition = 'none' | 'first' | 'middle' | 'last' | 'only';

function getGroupPosition<T extends string | number>(
  options: SelectorOption<T>[],
  index: number
): GroupPosition {
  const item = options[index];
  if (!item?.groupId) return 'none';

  const prevItem = index > 0 ? options[index - 1] : null;
  const nextItem = index < options.length - 1 ? options[index + 1] : null;

  const hasPrevInGroup = prevItem?.groupId === item.groupId;
  const hasNextInGroup = nextItem?.groupId === item.groupId;

  if (!hasPrevInGroup && !hasNextInGroup) return 'only';
  if (!hasPrevInGroup && hasNextInGroup) return 'first';
  if (hasPrevInGroup && !hasNextInGroup) return 'last';
  return 'middle';
}

// Helper to reorder with group support - when one item moves, pull its group members along
function reorderWithGroups<T extends string | number>(
  options: SelectorOption<T>[],
  movedItemId: T,
  newIndex: number
): SelectorOption<T>[] {
  const movedItem = options.find((o) => o.id === movedItemId);
  if (!movedItem) return options;

  // If the moved item has no group, just do a simple move
  if (!movedItem.groupId) {
    const oldIndex = options.findIndex((o) => o.id === movedItemId);
    const result = [...options];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex > oldIndex ? newIndex : newIndex, 0, removed);
    return result;
  }

  // Get all items in the same group
  const groupId = movedItem.groupId;
  const groupItems = options.filter((o) => o.groupId === groupId);
  const nonGroupItems = options.filter((o) => o.groupId !== groupId);

  // Find where to insert the group
  // We need to find the correct position in the non-group items array
  const targetItem = options[newIndex];
  let insertIndex: number;

  if (targetItem && targetItem.groupId !== groupId) {
    // Find position of target in non-group items
    insertIndex = nonGroupItems.findIndex((o) => o.id === targetItem.id);
    if (insertIndex === -1) {
      insertIndex = nonGroupItems.length;
    } else {
      // If dragging to the last position and target is not in group, insert after it
      if (newIndex === options.length - 1) {
        insertIndex = insertIndex + 1;
      }
    }
  } else {
    // Target is in the same group or doesn't exist (newIndex is beyond array length)
    // Count how many non-group items come before newIndex
    let count = 0;
    for (let i = 0; i < newIndex && i < options.length; i++) {
      if (options[i].groupId !== groupId) {
        count++;
      }
    }
    // If newIndex is at or beyond the end, insert at the end of non-group items
    if (newIndex >= options.length) {
      insertIndex = nonGroupItems.length;
    } else {
      insertIndex = count;
    }
  }

  // Insert group items at the calculated position
  const result = [...nonGroupItems];
  result.splice(insertIndex, 0, ...groupItems);

  return result;
}

export type SelectorOption<T extends string | number> = {
  id: T;
  label: string;
  description: string;
  icon: LucideIcon | React.ComponentType<{ size: number; color: string }>;
  iconBgColor: string;
  iconColor: string;
  groupId?: string;
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
  const isDragMode = isEditable && selectionEnabled;

  const handleDragEnd = ({
    data,
    from,
    to,
  }: {
    data: SelectorOption<T>[];
    from: number;
    to: number;
  }) => {
    // Get the moved item
    const movedItem = orderedOptions[from];
    if (!movedItem) {
      setOrderedOptions(data);
      onOrderChange?.(data);
      return;
    }

    // If the item has a group, reorder with group support
    if (movedItem.groupId) {
      const reordered = reorderWithGroups(orderedOptions, movedItem.id, to);
      setOrderedOptions(reordered);
      onOrderChange?.(reordered);
    } else {
      setOrderedOptions(data);
      onOrderChange?.(data);
    }
  };

  const renderGroupIndicator = (groupPosition: GroupPosition) => {
    if (groupPosition === 'none') return null;

    const lineColor = theme.colors.accent.primary;
    const lineWidth = 3;
    const indicatorWidth = 12;

    return (
      <View
        style={{
          width: indicatorWidth,
          alignItems: 'center',
          marginRight: theme.spacing.gap.sm,
        }}>
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
      </View>
    );
  };

  const renderDraggableItem = ({
    item,
    drag,
    isActive,
    getIndex,
  }: RenderItemParams<SelectorOption<T>>) => {
    const Icon = item.icon as any;
    const selected = isSelected(item.id);
    const index = getIndex() ?? 0;
    const groupPosition = getGroupPosition(orderedOptions, index);

    return (
      <ScaleDecorator>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          {renderGroupIndicator(groupPosition)}
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={150}
            onPress={() => !isActive && toggle(item.id)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              padding: theme.spacing.padding.base,
              borderRadius: theme.borderRadius.md,
              borderWidth: theme.borderWidth.thin,
              borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
              backgroundColor: isActive
                ? theme.colors.background.cardElevated
                : selected
                  ? theme.colors.accent.primary10
                  : theme.colors.background.card,
              ...(selected ? theme.shadows.accentGlow : {}),
              opacity: isActive ? 0.9 : 1,
            }}>
            {/* Drag Handle */}
            <View
              style={{
                marginRight: theme.spacing.gap.sm,
                opacity: 0.5,
              }}>
              <GripVertical
                size={theme.iconSize.md}
                color={theme.colors.text.secondary}
                strokeWidth={theme.strokeWidth.normal}
              />
            </View>

            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
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
                    backgroundColor: item.iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon size={theme.iconSize.lg} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.text.primary,
                    }}>
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.secondary,
                      marginTop: theme.spacing.padding.xs / 4,
                    }}>
                    {item.description}
                  </Text>
                </View>
              </View>
              {showCheckboxes && (
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
              )}
            </View>
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  };

  const renderRegularItem = (option: SelectorOption<T>, index: number) => {
    const Icon = option.icon as any;
    const selected = isSelected(option.id);
    const groupPosition = getGroupPosition(orderedOptions, index);

    return (
      <View key={String(option.id)} style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        {renderGroupIndicator(groupPosition)}
        <Pressable onPress={() => toggle(option.id)} style={{ flex: 1 }}>
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
                borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
                backgroundColor: selected
                  ? theme.colors.accent.primary10
                  : theme.colors.background.card,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...(selected ? theme.shadows.accentGlow : {}),
              }}>
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
              ) : (
                <View />
              )}
            </View>
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

      {isDragMode ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <DraggableFlatList
            data={orderedOptions}
            onDragEnd={handleDragEnd}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderDraggableItem}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing.gap.md }} />}
            scrollEnabled={false}
          />
        </GestureHandlerRootView>
      ) : (
        <View style={{ gap: theme.spacing.gap.md }}>
          {orderedOptions.map((option, index) => renderRegularItem(option, index))}
        </View>
      )}
    </View>
  );
}
