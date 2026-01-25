import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { CenteredModal } from './CenteredModal';
import { Button } from '../theme/Button';
import { useSettings } from '../../hooks/useSettings';
import { getWeightUnitI18nKey } from '../../utils/units';

type EditSetDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { weight: number; reps: number; partials: number; repsInReserve: number }) => void;
  setLabel: string;
  initialWeight: number;
  initialReps: number;
  initialPartials: number;
  initialRepsInReserve: number;
  showRir?: boolean;
};

type NumberInputFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
};

function NumberInputField({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  allowDecimals = false,
}: NumberInputFieldProps) {
  const handleDecrement = useCallback(() => {
    const newValue = Math.max(min, value - step);
    onChange(allowDecimals ? newValue : Math.round(newValue));
  }, [allowDecimals, min, onChange, step, value]);

  const handleIncrement = useCallback(() => {
    const newValue = Math.min(max, value + step);
    onChange(allowDecimals ? newValue : Math.round(newValue));
  }, [allowDecimals, max, onChange, step, value]);

  const handleTextChange = useCallback((text: string) => {
    const num = allowDecimals ? parseFloat(text) || 0 : parseInt(text, 10) || 0;
    const clampedValue = Math.max(min, Math.min(max, num));
    onChange(allowDecimals ? clampedValue : Math.round(clampedValue));
  }, [allowDecimals, max, min, onChange]);

  return (
    <View className="gap-3">
      <Text
        className="px-1 text-xs font-bold uppercase tracking-wider"
        style={{ color: theme.colors.accent.primary }}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          className="h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.background.white5 }}
          onPress={handleDecrement}
        >
          <Minus size={theme.iconSize.xl} color={theme.colors.accent.primary} />
        </Pressable>
        <View
          className="flex-1 overflow-hidden rounded-lg border"
          style={{
            backgroundColor: theme.colors.background.black20,
            borderColor: theme.colors.background.white10,
            borderWidth: theme.borderWidth.thin,
          }}
        >
          <TextInput
            value={value.toString()}
            onChangeText={handleTextChange}
            keyboardType={allowDecimals ? 'decimal-pad' : 'number-pad'}
            className="w-full bg-transparent py-3 text-xl font-bold"
            style={[
              {
                color: theme.colors.text.primary,
                textAlign: 'center',
                textAlignVertical: 'center',
                borderWidth: theme.borderWidth.none,
                paddingHorizontal: theme.spacing.padding.zero,
                paddingVertical: theme.spacing.padding.md,
              },
              Platform.OS === 'web' &&
                ({
                  outlineStyle: 'none',
                  outlineWidth: 0,
                } as any),
            ]}
            placeholderTextColor={theme.colors.text.secondary}
            selectTextOnFocus
          />
        </View>
        <Pressable
          className="h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.background.white5 }}
          onPress={handleIncrement}
        >
          <Plus size={theme.iconSize.xl} color={theme.colors.accent.primary} />
        </Pressable>
      </View>
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
  initialRepsInReserve,
  // TODO: implement showRir usage
  showRir = true,
}: EditSetDetailsModalProps) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [partials, setPartials] = useState(initialPartials);
  const [repsInReserve, setRepsInReserve] = useState(initialRepsInReserve);

  // Reset values when modal opens
  useEffect(() => {
    if (visible) {
      setWeight(initialWeight);
      setReps(initialReps);
      setPartials(initialPartials);
      setRepsInReserve(initialRepsInReserve);
    }
  }, [visible, initialWeight, initialReps, initialPartials, initialRepsInReserve]);

  const handleSave = () => {
    onSave({ weight, reps, partials, repsInReserve });
    onClose();
  };

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t('editSetDetails.title')}
      subtitle={t('editSetDetails.subtitle', { setLabel })}
      footer={
        <View className="flex-row items-stretch gap-3">
          <Button
            label={t('editSetDetails.cancel')}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
          />
          <Button
            label={t('editSetDetails.saveChanges')}
            variant="accent"
            size="sm"
            width="flex-1"
            onPress={handleSave}
          />
        </View>
      }
    >
      <View className="gap-6">
        {/* Weight */}
        <NumberInputField
          label={`${t('workoutSession.weight')} (${t(weightUnitKey)})`}
          value={weight}
          onChange={setWeight}
          min={0}
          max={1000}
          step={0.5}
          allowDecimals={true}
        />

        {/* Reps */}
        <NumberInputField
          label={t('workoutSession.reps')}
          value={reps}
          onChange={setReps}
          min={0}
          max={999}
          step={1}
          allowDecimals={false}
        />

        {/* Partial Reps */}
        <NumberInputField
          label={t('editSetDetails.partialReps')}
          value={partials}
          onChange={setPartials}
          min={0}
          max={999}
          step={1}
          allowDecimals={false}
        />

        {/* Reps in Reserve */}
        <NumberInputField
          label={t('editSetDetails.repsInReserve', 'RIR (Reps in Reserve)')}
          value={repsInReserve}
          onChange={setRepsInReserve}
          min={0}
          max={10}
          step={1}
          allowDecimals={false}
        />
      </View>
    </CenteredModal>
  );
}
