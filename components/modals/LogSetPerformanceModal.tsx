import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { Edit, Save } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { EditSetDetailsModal } from './EditSetDetailsModal';
import { Button } from '../theme/Button';
import { Slider } from '../theme/Slider';

type LogSetPerformanceModalProps = {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  setLabel: string;
  weight: number;
  reps: number;
  partials?: string | number;
  initialRpe?: number;
  onConfirm?: (data: { rpe: number }) => void;
  onEditSetDetails?: (data: { weight: number; reps: number; partials: number }) => void;
};

type StatCardProps = {
  label: string;
  value: string | number;
  suffix?: string;
  muted?: boolean;
};

function StatCard({ label, value, suffix, muted }: StatCardProps) {
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
        {suffix && <Text className="text-sm font-medium text-text-secondary">{suffix}</Text>}
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
  initialRpe = 8,
  onConfirm,
  onEditSetDetails,
}: LogSetPerformanceModalProps) {
  const { t } = useTranslation();
  const [rpe, setRpe] = useState(initialRpe);
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [partials, setPartials] = useState(
    typeof initialPartials === 'number' ? initialPartials : 0
  );
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Update local state when props change
  useEffect(() => {
    if (visible) {
      setWeight(initialWeight);
      setReps(initialReps);
      setPartials(typeof initialPartials === 'number' ? initialPartials : 0);
      setRpe(initialRpe);
    }
  }, [visible, initialWeight, initialReps, initialPartials, initialRpe]);

  const handleConfirm = () => {
    onConfirm?.({ rpe });
    onClose();
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
      />
      <Button
        label={t('logSetPerformance.logSet')}
        icon={Save}
        size="sm"
        width="flex-2"
        onPress={handleConfirm}
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
          {/* Stats Cards */}
          <View className="flex-row gap-3">
            <StatCard
              label={t('workoutSession.weight')}
              value={weight}
              suffix={t('workoutSession.kg')}
            />
            <StatCard label={t('workoutSession.reps')} value={reps} />
            <StatCard
              label={t('workoutSession.partials')}
              value={partials === 0 ? '-' : partials}
              muted={partials === 0}
            />
          </View>

          {/* Edit Set Details Button */}
          <Pressable
            className="-mt-2 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-accent-primary/30 py-2.5"
            style={{ backgroundColor: theme.colors.accent.primary5 }}
            onPress={() => setIsEditModalVisible(true)}
          >
            <Edit size={theme.iconSize.xs} color={theme.colors.accent.primary} />
            <Text className="text-sm font-bold" style={{ color: theme.colors.accent.primary }}>
              {t('logSetPerformance.editSetDetails')}
            </Text>
          </Pressable>

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

      {/* Edit Set Details Modal */}
      <EditSetDetailsModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={(data) => {
          setWeight(data.weight);
          setReps(data.reps);
          setPartials(data.partials);
          setIsEditModalVisible(false);
          onEditSetDetails?.(data);
        }}
        setLabel={setLabel}
        initialWeight={weight}
        initialReps={reps}
        initialPartials={partials}
      />
    </BottomPopUpMenu>
  );
}
