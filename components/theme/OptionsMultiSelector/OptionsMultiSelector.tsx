import { Check, GripVertical } from 'lucide-react-native';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { theme } from '../../../theme';
import { ActionButtonsArea } from './ActionButtonsArea';
import {
  getGroupColor,
  getGroupPosition,
  GroupPosition,
  normalizeGroups,
  SelectorOption,
} from './utils';

const ScaleDecorator = ({ children, isActive }: { children: ReactNode; isActive?: boolean }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive !== undefined) {
      scale.value = withSpring(isActive ? 0.95 : 1, { damping: 15, stiffness: 150 });
    }
  }, [isActive, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

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
  hasGroups = false,
  onOrderChange,
  onDelete,
}: OptionsMultiSelectorProps<T>) {
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
  const isDragMode = isEditable && selectionEnabled;

  // Check if we can group/ungroup selected items
  const selectedCount = selectedIds.length;
  const canGroup = selectedCount >= 2 && isEditable && selectionEnabled;
  const canDelete = selectedCount >= 1 && isEditable && selectionEnabled && !!onDelete;

  // Check if all selected items are already in the same group
  const selectedItems = useMemo(() => {
    return orderedOptions.filter((o) => selectedIds.includes(o.id));
  }, [orderedOptions, selectedIds]);

  const allSelectedInSameGroup = useMemo(() => {
    if (selectedItems.length < 2) return false;
    const firstGroupId = selectedItems[0]?.groupId;
    if (!firstGroupId) return false;
    return selectedItems.every((item) => item.groupId === firstGroupId);
  }, [selectedItems]);

  // Generate a unique groupId
  const generateGroupId = () => {
    return `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle grouping/ungrouping
  const handleGroupAction = () => {
    if (!canGroup) return;

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
    if (!canDelete || !onDelete) return;

    onDelete(selectedIds);
    // Selection is cleared by the onDelete handler
  };

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

    const lineColor = getGroupColor(groupId, orderedOptions);
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

  const renderDraggableItem = ({
    item,
    drag,
    isActive,
    getIndex,
  }: RenderItemParams<SelectorOption<T>>) => {
    const Icon = item.icon as any;
    const selected = showCheckboxes && isSelected(item.id);
    const index = getIndex() ?? 0;
    const groupPosition = getGroupPosition(orderedOptions, index);
    const isFirstInGroup = groupPosition === 'first' || groupPosition === 'only';
    const groupColor = item.groupId ? getGroupColor(item.groupId, orderedOptions) : undefined;

    return (
      <ScaleDecorator isActive={isActive}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
          }}
        >
          {renderGroupIndicator(groupPosition, item.groupId, isFirstInGroup)}
          <View style={{ flex: 1 }}>
            <Pressable
              onLongPress={drag}
              delayLongPress={150}
              onPress={() => !isActive && showCheckboxes && toggle(item.id)}
              disabled={isActive || !showCheckboxes}
              style={{ flex: 1 }}
            >
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
                    opacity: isActive
                      ? theme.colors.opacity.strong
                      : pressed
                        ? theme.colors.opacity.strong
                        : theme.colors.opacity.full,
                  }}
                >
                  {/* Drag Handle */}
                  <View
                    style={{
                      marginRight: theme.spacing.gap.sm,
                      opacity: theme.colors.opacity.medium,
                    }}
                  >
                    <GripVertical
                      size={theme.iconSize.md}
                      color={theme.colors.text.secondary}
                      strokeWidth={theme.strokeWidth.medium}
                    />
                  </View>

                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
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
                          backgroundColor: item.iconBgColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={theme.iconSize.lg} color={item.iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: theme.typography.fontSize.base,
                            fontWeight: theme.typography.fontWeight.bold,
                            color: theme.colors.text.primary,
                          }}
                        >
                          {item.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: theme.typography.fontSize.xs,
                            color: theme.colors.text.secondary,
                            marginTop: theme.spacing.padding.xsHalf,
                          }}
                        >
                          {item.description}
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
                    ) : null}
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  const renderRegularItem = (option: SelectorOption<T>, index: number) => {
    const Icon = option.icon as any;
    const selected = showCheckboxes && isSelected(option.id);
    const groupPosition = getGroupPosition(orderedOptions, index);
    const isFirstInGroup = groupPosition === 'first' || groupPosition === 'only';
    const groupColor = option.groupId ? getGroupColor(option.groupId, orderedOptions) : undefined;

    return (
      <View
        key={String(option.id)}
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
        }}
      >
        {renderGroupIndicator(groupPosition, option.groupId, isFirstInGroup)}
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
                    : groupColor
                      ? groupColor + '40'
                      : theme.colors.border.light,
                  backgroundColor: groupColor ? groupColor + '08' : theme.colors.background.card,
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
