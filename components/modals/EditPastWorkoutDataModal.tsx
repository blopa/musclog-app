import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Plus as PlusIcon, Trash2 } from 'lucide-react-native';
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

const sampleSets: SetItem[] = [
  { id: '1', weight: 28, reps: 12, partialReps: 0, rest: 90 },
  { id: '2', weight: 32, reps: 10, partialReps: 2, rest: 120, isPR: true },
  { id: '3', weight: 32, reps: 0, partialReps: 0, rest: 0 },
];

function SetCard({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: SetItem;
  index: number;
  onChange: (id: string, patch: Partial<SetItem>) => void;
  onRemove: (id: string) => void;
}) {
  const accentStyle = item.isPR
    ? { borderLeftColor: theme.colors.accent.primary, borderLeftWidth: theme.borderWidth.thick6 }
    : { borderLeftColor: theme.colors.border.gray600, borderLeftWidth: theme.borderWidth.thin };

  return (
    <View className="mb-4">
      <GenericCard variant="card" containerStyle={accentStyle}>
        <View className="p-4">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-xs font-bold uppercase tracking-widest"
                style={{
                  color: item.isPR ? theme.colors.accent.primary : theme.colors.text.secondary,
                }}
              >
                Set {index + 1}
              </Text>
              {item.isPR && (
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
              )}
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
      </GenericCard>
    </View>
  );
}

type EditPastWorkoutDataModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function EditPastWorkoutDataModal({
  visible,
  onClose,
  onSave,
}: EditPastWorkoutDataModalProps) {
  const [sets, setSets] = useState<SetItem[]>(sampleSets);
  const { t } = useTranslation();

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

  const handleSave = () => {
    onSave();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={'Dumbbell • Upper Body Power'}
      subtitle={'Aug 24, 2023'}
      scrollable={false}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: theme.size['160'] }} className="p-4">
        <View className="flex flex-col gap-4">
          {sets.map((s, idx) => (
            <SetCard
              key={s.id}
              item={s}
              index={idx}
              onChange={handleChange}
              onRemove={handleRemove}
            />
          ))}
          <DashedButton
            label="Add New Set"
            onPress={handleAdd}
            size="sm"
            icon={<PlusIcon size={theme.iconSize.sm} color={theme.colors.background.workoutIcon} />}
          />
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}
