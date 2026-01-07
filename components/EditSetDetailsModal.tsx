import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { CenteredModal } from './CenteredModal';
import { Button } from './theme/Button';

type EditSetDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { weight: number; reps: number; partials: number }) => void;
  setLabel: string;
  initialWeight: number;
  initialReps: number;
  initialPartials: number;
};

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <View className="gap-2">
      <Text
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: theme.colors.accent.primary }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

type NumberBoxProps = {
  value: number;
  onChange: (value: number) => void;
};

function NumberBox({ value, onChange }: NumberBoxProps) {
  return (
    <View className="relative flex-row items-center rounded-lg border border-border-default bg-bg-overlay">
      <TextInput
        value={value.toString()}
        onChangeText={(text) => {
          const num = parseInt(text, 10) || 0;
          onChange(num);
        }}
        keyboardType="numeric"
        className="w-full bg-transparent px-4 py-3 text-center text-lg font-bold text-text-primary"
        style={{ color: theme.colors.text.primary }}
        placeholderTextColor={theme.colors.text.secondary}
      />
    </View>
  );
}

export function EditSetDetailsModal({
  visible,
  onClose,
  onSave,
  setLabel,
  initialWeight,
  initialReps,
  initialPartials,
}: EditSetDetailsModalProps) {
  const { t } = useTranslation();
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [partials, setPartials] = useState(initialPartials);

  // Reset values when modal opens
  useEffect(() => {
    if (visible) {
      setWeight(initialWeight);
      setReps(initialReps);
      setPartials(initialPartials);
    }
  }, [visible, initialWeight, initialReps, initialPartials]);

  const handleSave = () => {
    onSave({ weight, reps, partials });
    onClose();
  };

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t('editSetDetails.title')}
      subtitle={t('editSetDetails.subtitle', { setLabel })}
      footer={
        <View className="flex-row gap-3">
          <Button
            label={t('editSetDetails.cancel')}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
          />
          <Button
            label={t('editSetDetails.saveChanges')}
            size="sm"
            width="flex-1"
            onPress={handleSave}
          />
        </View>
      }>
      <View className="gap-5">
        {/* Weight */}
        <Field label={t('workoutSession.weight')}>
          <View className="relative flex-row items-center rounded-lg border border-border-default bg-bg-overlay">
            <TextInput
              value={weight.toString()}
              onChangeText={(text) => {
                const num = parseFloat(text) || 0;
                setWeight(num);
              }}
              keyboardType="decimal-pad"
              className="flex-1 bg-transparent py-3 pl-4 pr-12 text-lg font-bold text-text-primary"
              style={{ color: theme.colors.text.primary }}
              placeholderTextColor={theme.colors.text.secondary}
            />
            <View className="absolute right-0 flex items-center pr-4" pointerEvents="none">
              <Text className="text-sm font-semibold text-text-secondary">
                {t('workoutSession.kg')}
              </Text>
            </View>
          </View>
        </Field>

        {/* Reps + Partials */}
        <View className="flex-row gap-4">
          <View className="flex-1">
            <Field label={t('workoutSession.reps')}>
              <NumberBox value={reps} onChange={setReps} />
            </Field>
          </View>
          <View className="flex-1">
            <Field label={t('editSetDetails.partialReps')}>
              <NumberBox value={partials} onChange={setPartials} />
            </Field>
          </View>
        </View>
      </View>
    </CenteredModal>
  );
}
