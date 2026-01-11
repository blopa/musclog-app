import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, LucideIcon, GripVertical } from 'lucide-react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
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

// Helper to get a consistent color for each group
function getGroupColor(groupId: string | undefined): string {
  if (!groupId) return theme.colors.accent.primary;
  
  // Simple hash to consistently pick a color for a groupId
  const colors = [
    theme.colors.accent.primary,
    theme.colors.status.purple,
    theme.colors.status.indigo,
    '#10B981', // emerald green
    '#F59E0B', // amber
    '#EF4444', // red
  ];
  
  const hash = groupId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
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
  }: {
    data: SelectorOption<T>[];
    from: number;
    to: number;
  }) => {
    // Get the moved item from original array
    const movedItem = orderedOptions[from];
    if (!movedItem) {
      setOrderedOptions(data);
      onOrderChange?.(data);
      return;
    }

    // If no group, just use the drag result directly
    if (!movedItem.groupId) {
      setOrderedOptions(data);
      onOrderChange?.(data);
      return;
    }

    // Item has a group - we need to ensure all group members are contiguous
    // and preserve the internal order from the drag result
    const groupId = movedItem.groupId;

    // Get all group items in the order they appear in the NEW data array
    const groupItems = data.filter((o) => o.groupId === groupId);

    // Get all non-group items in their new order
    const nonGroupItems = data.filter((o) => o.groupId !== groupId);

    // Find where the moved item ended up in the new data array to determine insertion point
    const movedItemNewIndex = data.findIndex((o) => o.id === movedItem.id);

    // Count how many non-group items come BEFORE the moved item's new position in data
    let insertIndex = 0;
    for (let i = 0; i < movedItemNewIndex; i++) {
      if (data[i].groupId !== groupId) {
        insertIndex++;
      }
    }

    // Build the result: non-group items with group inserted at correct position
    const result = [...nonGroupItems];
    result.splice(insertIndex, 0, ...groupItems);

    setOrderedOptions(result);
    onOrderChange?.(result);
  };

  const renderGroupIndicator = (
    groupPosition: GroupPosition,
    groupId?: string,
    isFirstInGroup: boolean = false
  ) => {
    if (groupPosition === 'none') return null;

    const lineColor = getGroupColor(groupId);
    const lineWidth = 3;
    const indicatorWidth = 16;

    return (
      <View
        style={{
          width: indicatorWidth,
          alignItems: 'center',
          marginRight: theme.spacing.gap.sm,
          position: 'relative',
        }}>
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
        {isFirstInGroup && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: (indicatorWidth - 8) / 2,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: lineColor,
              borderWidth: 2,
              borderColor: theme.colors.background.primary,
            }}
          />
        )}
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
    const isFirstInGroup = groupPosition === 'first' || groupPosition === 'only';
    const groupColor = item.groupId ? getGroupColor(item.groupId) : undefined;

    return (
      <ScaleDecorator>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          {renderGroupIndicator(groupPosition, item.groupId, isFirstInGroup)}
          <Pressable
            onLongPress={drag}
            delayLongPress={150}
            onPress={() => !isActive && toggle(item.id)}
            disabled={isActive}
            style={{ flex: 1 }}>
            {({ pressed }) => (
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: theme.spacing.padding.base,
                  borderRadius: theme.borderRadius.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: selected
                    ? theme.colors.accent.primary
                    : groupColor
                      ? groupColor + '40'
                      : theme.colors.border.light,
                  backgroundColor: isActive
                    ? theme.colors.background.cardElevated
                    : groupColor
                      ? groupColor + '08'
                      : theme.colors.background.card,
                  ...(selected ? theme.shadows.accentGlow : {}),
                  opacity: isActive ? 0.9 : pressed ? 0.7 : 1,
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
              </View>
            )}
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  };

  const renderRegularItem = (option: SelectorOption<T>, index: number) => {
    const Icon = option.icon as any;
    const selected = isSelected(option.id);
    const groupPosition = getGroupPosition(orderedOptions, index);
    const isFirstInGroup = groupPosition === 'first' || groupPosition === 'only';
    const groupColor = option.groupId ? getGroupColor(option.groupId) : undefined;

    return (
      <View key={String(option.id)} style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        {renderGroupIndicator(groupPosition, option.groupId, isFirstInGroup)}
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
                borderColor: selected
                  ? theme.colors.accent.primary
                  : groupColor
                    ? groupColor + '40'
                    : theme.colors.border.light,
                backgroundColor: groupColor ? groupColor + '08' : theme.colors.background.card,
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
        <DraggableFlatList
          data={orderedOptions}
          onDragEnd={handleDragEnd}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDraggableItem}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.gap.md }} />}
          scrollEnabled={false}
          activationDistance={10}
        />
      ) : (
        <View style={{ gap: theme.spacing.gap.md }}>
          {orderedOptions.map((option, index) => renderRegularItem(option, index))}
        </View>
      )}
    </View>
  );
}
