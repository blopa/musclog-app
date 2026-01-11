import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, LucideIcon, GripVertical } from 'lucide-react-native';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

type SortableItemProps<T extends string | number> = {
  option: SelectorOption<T>;
  selected: boolean;
  showCheckboxes: boolean;
  isDragMode: boolean;
  onToggle: () => void;
};

function SortableItem<T extends string | number>({
  option,
  selected,
  showCheckboxes,
  isDragMode,
  onToggle,
}: SortableItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(option.id),
  });

  const Icon = option.icon as any;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            padding: theme.spacing.padding.base,
            borderRadius: theme.borderRadius.md,
            borderWidth: theme.borderWidth.thin,
            borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
            backgroundColor: isDragging
              ? theme.colors.background.cardElevated
              : selected
                ? theme.colors.accent.primary10
                : theme.colors.background.card,
            transform: [{ scale: pressed && !isDragging ? 0.98 : 1 }],
            ...(selected ? theme.shadows.accentGlow : {}),
          },
        ]}>
        {/* Drag Handle - Only show in drag mode */}
        {isDragMode && (
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              marginRight: theme.spacing.gap.sm,
              opacity: 0.5,
              touchAction: 'none',
            }}>
            <GripVertical
              size={theme.iconSize.md}
              color={theme.colors.text.secondary}
              strokeWidth={theme.strokeWidth.normal}
            />
          </div>
        )}

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
          {showCheckboxes && (
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
          )}
        </View>
      </Pressable>
    </div>
  );
}

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedOptions.findIndex((item) => String(item.id) === active.id);
      const newIndex = orderedOptions.findIndex((item) => String(item.id) === over.id);

      const newOptions = arrayMove(orderedOptions, oldIndex, newIndex);
      setOrderedOptions(newOptions);
      onOrderChange?.(newOptions);
    }
  };

  const renderRegularItem = (option: SelectorOption<T>) => {
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={orderedOptions.map((o) => String(o.id))}
            strategy={verticalListSortingStrategy}>
            <View style={{ gap: theme.spacing.gap.md }}>
              {orderedOptions.map((option) => (
                <SortableItem
                  key={String(option.id)}
                  option={option}
                  selected={isSelected(option.id)}
                  showCheckboxes={showCheckboxes}
                  isDragMode={isDragMode}
                  onToggle={() => toggle(option.id)}
                />
              ))}
            </View>
          </SortableContext>
        </DndContext>
      ) : (
        <View style={{ gap: theme.spacing.gap.md }}>
          {orderedOptions.map((option) => renderRegularItem(option))}
        </View>
      )}
    </View>
  );
}
