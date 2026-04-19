import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { Button } from '@/components/theme/Button';
import NewNumericalInput from '@/components/theme/NewNumericalInput';
import { Slider } from '@/components/theme/Slider';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { getWeightUnitI18nKey } from '@/utils/units';

type LogSetPerformanceModalProps = {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  setLabel: string;
  weight: number;
  reps: number;
  partials?: string | number;
  repsInReserve?: number;
  initialRpe?: number;
  onConfirm?: (data: {
    rpe: number;
    weight: number;
    reps: number;
    partials: number;
    repsInReserve: number;
  }) => void;
  /** True while the confirm action is in progress (disables buttons, shows loading on log set). */
  isSaving?: boolean;
  onEditSetDetails?: (data: {
    weight: number;
    reps: number;
    partials: number;
    repsInReserve: number;
  }) => void;
};

type StatCardProps = {
  label: string;
  value: string | number;
  suffix?: string;
  muted?: boolean;
};

function StatCard({ label, value, suffix, muted }: StatCardProps) {
  const theme = useTheme();
  return (
    <View className="flex-1 rounded-xl border border-border-accent bg-bg-overlay p-4">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </Text>
      <View className="flex-row items-baseline gap-1">
        <Text
          className="text-3xl font-bold tracking-tight"
          style={{ color: muted ? theme.colors.text.tertiary : theme.colors.text.primary }}
        >
          {value}
        </Text>
        {suffix ? <Text className="text-sm font-medium text-text-secondary">{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function LogSetPerformanceModal({
  visible,
  onClose,
  exerciseName,
  setLabel,
  weight: initialWeight,
  reps: initialReps,
  partials: initialPartials = '-',
  repsInReserve: initialRepsInReserve = 0,
  initialRpe = 8,
  onConfirm,
  isSaving = false,
  onEditSetDetails,
}: LogSetPerformanceModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const [rpe, setRpe] = useState(initialRpe);
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [partials, setPartials] = useState(
    typeof initialPartials === 'number' ? initialPartials : 0
  );
  const [repsInReserve, setRepsInReserve] = useState(initialRepsInReserve);

  // Update local state when props change
  useEffect(() => {
    if (visible) {
      setWeight(initialWeight);
      setReps(initialReps);
      setPartials(typeof initialPartials === 'number' ? initialPartials : 0);
      setRepsInReserve(initialRepsInReserve);
      setRpe(initialRpe);
    }
  }, [visible, initialWeight, initialReps, initialPartials, initialRepsInReserve, initialRpe]);

  const handleConfirm = () => {
    onConfirm?.({ rpe, weight, reps, partials, repsInReserve });
    // Don't call onClose — parent navigates or shows next screen; closing first would cause a flash
  };

  // Web-specific ScrollView styles to prevent browser gestures
  const webScrollViewStyle =
    Platform.OS === 'web'
      ? ({
          // Allow vertical scrolling but prevent horizontal browser gestures
          touchAction: 'pan-y',
        } as any)
      : {};

  // Web-specific styles to allow horizontal gestures on slider area
  const webSliderContainerStyle =
    Platform.OS === 'web'
      ? ({
          // Allow horizontal panning for slider, preventing browser swipe gesture
          touchAction: 'pan-x pan-y',
        } as any)
      : {};

  const footer = (
    <View className="flex-row items-stretch gap-3">
      <Button
        label={t('logSetPerformance.cancel')}
        variant="outline"
        size="sm"
        width="flex-1"
        onPress={onClose}
        disabled={isSaving}
      />
      <Button
        label={t('logSetPerformance.logSet')}
        icon={Save}
        size="sm"
        width="flex-2"
        onPress={handleConfirm}
        loading={isSaving}
        disabled={isSaving}
      />
    </View>
  );

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={t('logSetPerformance.title')}
      subtitle={`${setLabel} • ${exerciseName}`}
      footer={footer}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={webScrollViewStyle}
        contentContainerStyle={{
          paddingBottom: theme.spacing.padding.xl,
        }}
      >
        <View className="gap-6">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <NewNumericalInput
                label={`${t('workoutSession.weight')} (${t(weightUnitKey)})`}
                value={weight}
                onChange={setWeight}
                min={0}
                step={0.5}
              />
            </View>
            <View className="flex-1">
              <NewNumericalInput
                label={t('workoutSession.reps')}
                value={reps}
                onChange={setReps}
                min={0}
                step={1}
              />
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <NewNumericalInput
                label={t('workoutSession.partials')}
                value={partials}
                onChange={setPartials}
                min={0}
                step={1}
              />
            </View>
            <View className="flex-1">
              <NewNumericalInput
                label={t('editSetDetails.repsInReserve')}
                value={repsInReserve}
                onChange={setRepsInReserve}
                min={0}
                step={1}
              />
            </View>
          </View>

          {/* RPE Section */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-sm font-bold uppercase tracking-wide text-text-secondary">
                {t('logSetPerformance.difficulty')}
              </Text>
              <Text
                className="text-2xl font-bold tabular-nums"
                style={{ color: theme.colors.accent.primary }}
              >
                {rpe}
              </Text>
            </View>

            {/* RPE Slider */}
            <View className="mb-2" style={webSliderContainerStyle}>
              <Slider
                value={rpe}
                min={1}
                max={10}
                onChange={setRpe}
                trackColor={theme.colors.background.secondaryDark}
                thumbColor={theme.colors.background.white}
              />
            </View>

            {/* RPE Labels */}
            <View className="flex-row justify-between">
              <Text
                className="font-medium uppercase tracking-wider text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('logSetPerformance.easy')}
              </Text>
              <Text
                className="font-medium uppercase tracking-wider text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('logSetPerformance.moderate')}
              </Text>
              <Text
                className="font-medium uppercase tracking-wider text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('logSetPerformance.failure')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </BottomPopUpMenu>
  );
}
