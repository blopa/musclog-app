import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GripVertical, Plus as PlusIcon, Trash2 } from 'lucide-react-native';
import { GenericCard } from '../cards/GenericCard';
import NewNumericalInput from '../theme/NewNumericalInput';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import DashedButton from '../theme/DashedButton';

type SetItem = {
  id: string;
  weight: number;
  reps: number;
  partialReps: number;
  rest: number;
  isPR?: boolean;
};

function SetCard({
  item,
  index,
  onChange,
  onRemove,
  drag,
  isActive,
}: {
  item: SetItem;
  index: number;
  onChange: (id: string, patch: Partial<SetItem>) => void;
  onRemove: (id: string) => void;
  drag?: () => void;
  isActive?: boolean;
}) {
  const accentStyle = item.isPR
    ? { borderLeftColor: theme.colors.accent.primary, borderLeftWidth: theme.borderWidth.thick6 }
    : { borderLeftColor: theme.colors.border.gray600, borderLeftWidth: theme.borderWidth.thin };
  const displayIndex = Number.isFinite(index) ? index + 1 : 1;

  return (
    <View className="mb-4">
      <GenericCard variant="card" containerStyle={accentStyle}>
        <Pressable onLongPress={drag} delayLongPress={150} disabled={!drag} style={{ flex: 1 }}>
          <View className="p-4">
            {/* Header with grip, title, and remove */}
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2" style={{ flex: 1 }}>
                {/* Grip icon - larger hit target */}
                <View style={{ marginRight: theme.spacing.gap.sm }}>
                  <GripVertical size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </View>
                <Text
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{
                    color: item.isPR ? theme.colors.accent.primary : theme.colors.text.secondary,
                  }}
                >
                  Set {displayIndex}
                </Text>
                {item.isPR ? (
                  <View
                    style={{ backgroundColor: theme.colors.accent.primary10 }}
                    className="flex-row items-center rounded px-2 py-0.5"
                  >
                    <Text
                      style={{
                        color: theme.colors.accent.primary,
                        fontWeight: theme.typography.fontWeight.extrabold,
                      }}
                      className="text-[10px]"
                    >
                      PR
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pressable onPress={() => onRemove(item.id)} className="flex-row items-center gap-1">
                <Trash2 size={theme.iconSize.xs} color={theme.colors.status.error} />
                <Text
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: theme.colors.status.errorSolid }}
                >
                  Remove
                </Text>
              </Pressable>
            </View>

            {/* Inputs */}
            <View className="mb-4 grid grid-cols-2 gap-4">
              <NewNumericalInput
                label="Weight (kg)"
                value={item.weight}
                onChange={(v) => onChange(item.id, { weight: v })}
                min={0}
                step={1}
              />
              <NewNumericalInput
                label="Reps"
                value={item.reps}
                onChange={(v) => onChange(item.id, { reps: v })}
                min={0}
                step={1}
              />
            </View>

            <View className="grid grid-cols-2 gap-4">
              <NewNumericalInput
                label="Partial Reps"
                value={item.partialReps}
                onChange={(v) => onChange(item.id, { partialReps: v })}
                min={0}
                step={1}
              />
              <NewNumericalInput
                label="Rest (sec)"
                value={item.rest}
                onChange={(v) => onChange(item.id, { rest: v })}
                min={0}
                step={5}
              />
            </View>
          </View>
        </Pressable>
      </GenericCard>
    </View>
  );
}

type EditPastWorkoutDataModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (updatedSets: SetItem[]) => Promise<void> | void;
  workoutId: string;
  exerciseId: string;
  initialSets: SetItem[];
};

export default function EditPastWorkoutDataModal({
  visible,
  onClose,
  onSave,
  initialSets,
}: EditPastWorkoutDataModalProps) {
  const [sets, setSets] = useState<SetItem[]>(initialSets ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setSets(initialSets ?? []);
  }, [initialSets, visible]);

  const handleChange = (id: string, patch: Partial<SetItem>) => {
    setSets((s) => s.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleRemove = (id: string) => {
    setSets((s) => s.filter((it) => it.id !== id));
  };

  const handleAdd = () => {
    const next: SetItem = { id: String(Date.now()), weight: 0, reps: 0, partialReps: 0, rest: 0 };
    setSets((s) => [...s, next]);
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Small delay to allow React to render the loading state before closing
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    try {
      await onSave(sets);
      onClose();
      setIsSaving(false);
    } catch (err) {
      setIsSaving(false);
      console.error('Failed to save sets:', err);
    }
  };

  const headerRight = (
    <Pressable
      onPress={handleSave}
      className="flex-row items-center gap-2 px-3 py-1"
      disabled={isSaving}
    >
      {isSaving ? <ActivityIndicator size="small" color={theme.colors.accent.primary} /> : null}
      <Text
        style={{ color: isSaving ? theme.colors.text.tertiary : theme.colors.accent.primary }}
        className="font-bold"
      >
        {isSaving ? 'Saving...' : t('common.save')}
      </Text>
    </Pressable>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workoutDetail.editSetsTitle') || 'Edit Sets'}
      subtitle={''}
      scrollable={false}
      headerRight={headerRight}
    >
      <View className="p-4">
        <DraggableFlatList
          data={sets}
          scrollEnabled={false}
          activationDistance={10}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data }) => setSets(data)}
          renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<SetItem>) => {
            const index = (typeof getIndex === 'function' ? getIndex() : undefined) ?? 0;
            return (
              <SetCard
                item={item}
                index={index}
                onChange={handleChange}
                onRemove={handleRemove}
                drag={drag}
                isActive={isActive}
              />
            );
          }}
        />
        <View style={{ marginTop: theme.spacing.gap.base }}>
          <DashedButton
            label={t('workoutDetail.addSet') || 'Add New Set'}
            onPress={handleAdd}
            size="sm"
            icon={<PlusIcon size={theme.iconSize.sm} color={theme.colors.background.workoutIcon} />}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
