import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <Pressable
        className="flex-1 items-center justify-center p-4"
        style={{ backgroundColor: theme.colors.overlay.black60 }}
        onPress={onClose}>
        {/* Modal */}
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-xl border border-border-dark"
          style={{ backgroundColor: theme.colors.background.cardElevated }}
          onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border-dark bg-bg-overlay/50 px-6 py-5">
            <View className="flex-1">
              <Text className="text-xl font-bold text-text-primary">
                {t('editSetDetails.title')}
              </Text>
              <Text className="mt-1 text-xs font-medium text-text-secondary">
                {t('editSetDetails.subtitle', { setLabel })}
              </Text>
            </View>
            <Pressable className="h-10 w-10 items-center justify-center" onPress={onClose}>
              <X size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            </Pressable>
          </View>

          {/* Content */}
          <View className="gap-5 p-6">
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

          {/* Footer */}
          <View className="flex-row gap-3 border-t border-border-dark bg-bg-overlay/50 px-6 py-4">
            <Pressable
              className="flex-1 rounded-lg border border-border-light bg-bg-card py-3"
              onPress={onClose}>
              <Text className="text-center text-sm font-bold uppercase tracking-wide text-text-primary">
                {t('editSetDetails.cancel')}
              </Text>
            </Pressable>
            <Pressable className="flex-1 rounded-lg bg-accent-primary py-3" onPress={handleSave}>
              <Text className="text-text-black text-center text-sm font-bold uppercase tracking-wide">
                {t('editSetDetails.saveChanges')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
