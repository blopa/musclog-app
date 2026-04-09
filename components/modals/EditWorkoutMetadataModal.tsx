import { differenceInMinutes } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

type EditWorkoutMetadataModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { startedAt: number; completedAt: number }) => Promise<void> | void;
  initialStartedAt: number;
  initialCompletedAt: number;
};

export default function EditWorkoutMetadataModal({
  visible,
  onClose,
  onSave,
  initialStartedAt,
  initialCompletedAt,
}: EditWorkoutMetadataModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [startedAt, setStartedAt] = useState(new Date(initialStartedAt));
  const [completedAt, setCompletedAt] = useState(new Date(initialCompletedAt));
  const [isSaving, setIsSaving] = useState(false);

  // Picker states
  const [pickerConfig, setPickerConfig] = useState<{
    type: 'date' | 'time';
    target: 'started' | 'completed';
    visible: boolean;
  }>({ type: 'date', target: 'started', visible: false });

  const totalMinutes = Math.max(0, differenceInMinutes(completedAt, startedAt));

  const handleDateSelect = (date: Date) => {
    const isStarted = pickerConfig.target === 'started';
    const current = isStarted ? startedAt : completedAt;

    const newDate = new Date(current);
    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());

    if (isStarted) {
      setStartedAt(newDate);
    } else {
      setCompletedAt(newDate);
    }
    setPickerConfig((prev) => ({ ...prev, visible: false }));
  };

  const handleTimeSelect = (time: Date) => {
    const isStarted = pickerConfig.target === 'started';
    const current = isStarted ? startedAt : completedAt;

    const newTime = new Date(current);
    newTime.setHours(time.getHours(), time.getMinutes());

    if (isStarted) {
      setStartedAt(newTime);
    } else {
      setCompletedAt(newTime);
    }
    setPickerConfig((prev) => ({ ...prev, visible: false }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        startedAt: startedAt.getTime(),
        completedAt: completedAt.getTime(),
      });
      onClose();
    } catch (error) {
      console.error('Failed to save workout metadata:', error);
    } finally {
      setIsSaving(false);
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
        {isSaving ? t('common.saving') : t('common.save')}
      </Text>
    </Pressable>
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('workoutDetail.editTimeTitle')}
        headerRight={headerRight}
      >
        <View className="flex-1 gap-6 p-4">
          <View
            className="items-center justify-center rounded-2xl p-6"
            style={{ backgroundColor: theme.colors.background.white5 }}
          >
            <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
              {t('workoutDetail.totalTime')}
            </Text>
            <View className="flex-row items-baseline gap-1 mt-1">
              <Text className="text-4xl font-extrabold text-text-primary">{totalMinutes}</Text>
              <Text className="text-lg font-bold text-text-secondary">{t('common.min')}</Text>
            </View>
          </View>

          <View className="gap-6">
            <View className="flex-row gap-4">
              <DatePickerInput
                className="flex-1"
                label={t('workoutDetail.startDate')}
                selectedDate={startedAt}
                onPress={() => setPickerConfig({ type: 'date', target: 'started', visible: true })}
                variant="default"
              />
              <TimePickerInput
                className="flex-1"
                label={t('workoutDetail.startTime')}
                selectedTime={startedAt}
                onPress={() => setPickerConfig({ type: 'time', target: 'started', visible: true })}
                variant="default"
              />
            </View>

            <View className="flex-row gap-4">
              <DatePickerInput
                className="flex-1"
                label={t('workoutDetail.endDate')}
                selectedDate={completedAt}
                onPress={() => setPickerConfig({ type: 'date', target: 'completed', visible: true })}
                variant="default"
              />
              <TimePickerInput
                className="flex-1"
                label={t('workoutDetail.endTime')}
                selectedTime={completedAt}
                onPress={() => setPickerConfig({ type: 'time', target: 'completed', visible: true })}
                variant="default"
              />
            </View>
          </View>
        </View>
      </FullScreenModal>

      <DatePickerModal
        visible={pickerConfig.visible && pickerConfig.type === 'date'}
        onClose={() => setPickerConfig((prev) => ({ ...prev, visible: false }))}
        selectedDate={pickerConfig.target === 'started' ? startedAt : completedAt}
        onDateSelect={handleDateSelect}
      />

      <TimePickerModal
        visible={pickerConfig.visible && pickerConfig.type === 'time'}
        onClose={() => setPickerConfig((prev) => ({ ...prev, visible: false }))}
        selectedTime={pickerConfig.target === 'started' ? startedAt : completedAt}
        onTimeSelect={handleTimeSelect}
        title={
          pickerConfig.target === 'started' ? t('workoutDetail.startTime') : t('workoutDetail.endTime')
        }
      />
    </>
  );
}
