import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Trash2, Plus as PlusIcon } from 'lucide-react-native';
import NewNumericalInput from '../theme/NewNumericalInput';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';

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
    ? { borderColor: theme.colors.border.gray600, borderLeftWidth: 4 }
    : { borderColor: 'rgba(148,163,184,0.18)', borderLeftWidth: 1 };

  return (
    <View
      className="dark:bg-surface relative overflow-hidden rounded-lg border bg-white p-4 shadow-sm"
      style={accentStyle}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text
            className={`text-xs font-bold ${item.isPR ? 'text-primary' : 'text-gray-400'} uppercase tracking-widest`}
          >
            Set {index + 1}
          </Text>
          {item.isPR && (
            <View className="bg-primary/10 flex-row items-center rounded px-2 py-0.5">
              <Text className="text-primary text-[10px] font-extrabold">PR</Text>
            </View>
          )}
        </View>
        <Pressable onPress={() => onRemove(item.id)} className="flex-row items-center gap-1">
          <Trash2 size={14} color="#ef4444" />
          <Text className="text-xs font-bold uppercase tracking-wider text-red-500">Remove</Text>
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
      title={t('workoutHistory.title')}
      scrollable={false}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} className="p-4">
        <View className="mb-4 flex-row items-center gap-4 px-2">
          <View className="bg-indigo-brand/10 h-12 w-12 items-center justify-center rounded-xl">
            <Text className="text-indigo-brand text-2xl">💪</Text>
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-300">Dumbbell • Upper Body Power</Text>
            <Text className="text-xs text-gray-400">Aug 24, 2023</Text>
          </View>
        </View>

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

          <Pressable
            onPress={handleAdd}
            className="w-full flex-row items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-4 dark:border-white/10"
          >
            <PlusIcon size={16} color={theme.colors.background.workoutIcon} />
            <Text className="text-sm font-bold text-gray-400">Add New Set</Text>
          </Pressable>
        </View>
      </ScrollView>
      {/*TODO: implement save button*/}
    </FullScreenModal>
  );
}
