import { differenceInMinutes } from 'date-fns';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { OptionsMultiSelector } from '@/components/theme/OptionsMultiSelector/OptionsMultiSelector';
import type { SelectorOption } from '@/components/theme/OptionsMultiSelector/utils';
import Exercise from '@/database/models/Exercise';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import { useTheme } from '@/hooks/useTheme';
import { formatWorkoutDuration } from '@/utils/workout';
import { getWorkoutIcon } from '@/utils/workoutHistory';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

// Divider component
function SectionDivider() {
  return <View className="bg-background-white10 h-px" />;
}

type EditWorkoutMetadataModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    startedAt: number;
    completedAt: number;
    reorderedExercises?: { id: string; groupId?: string }[];
  }) => Promise<void> | void;
  initialStartedAt: number;
  initialCompletedAt: number;
  workoutLogId?: string;
  logExercises?: WorkoutLogExercise[];
  exercises?: Exercise[];
};

export default function EditWorkoutMetadataModal({
  visible,
  onClose,
  onSave,
  initialStartedAt,
  initialCompletedAt,
  workoutLogId,
  logExercises,
  exercises,
}: EditWorkoutMetadataModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [startedAt, setStartedAt] = useState(new Date(initialStartedAt));
  const [completedAt, setCompletedAt] = useState(new Date(initialCompletedAt));
  const [isSaving, setIsSaving] = useState(false);

  // Exercise reordering state
  const hasExercises = workoutLogId && logExercises && logExercises.length > 0 && exercises;
  const [exerciseOptions, setExerciseOptions] = useState<SelectorOption<string>[]>([]);

  // Initialize exercise options when modal opens
  useEffect(() => {
    let isMounted = true;

    if (visible && hasExercises) {
      const exerciseMap = new Map<string, Exercise>();
      exercises!.forEach((ex) => exerciseMap.set(ex.id, ex));

      const options: SelectorOption<string>[] = logExercises!.map((le) => {
        const exercise = exerciseMap.get(le.exerciseId);
        const iconData = getWorkoutIcon(theme, exercise?.name ?? '');

        return {
          id: le.id,
          label: exercise?.name ?? '',
          description: '',
          icon: iconData.icon,
          iconColor: iconData.iconBgColor,
          iconBgColor: iconData.iconBgOpacity,
          groupId: le.groupId,
        };
      });

      if (isMounted) {
        setExerciseOptions(options);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [visible, logExercises, exercises, theme, hasExercises]);

  // Picker states
  const [pickerConfig, setPickerConfig] = useState<{
    type: 'date' | 'time';
    target: 'started' | 'completed';
    visible: boolean;
  }>({ type: 'date', target: 'started', visible: false });

  const totalMinutes = Math.max(0, differenceInMinutes(completedAt, startedAt));
  const durationDisplay = formatWorkoutDuration(totalMinutes);

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
      const reorderedExercises =
        hasExercises && exerciseOptions.length > 0
          ? exerciseOptions.map((opt) => ({
              id: opt.id as string,
              groupId: opt.groupId ?? '',
            }))
          : undefined;

      await onSave({
        startedAt: startedAt.getTime(),
        completedAt: completedAt.getTime(),
        reorderedExercises,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save workout metadata:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const footer = (
    <Button
      label={t('common.save')}
      onPress={handleSave}
      variant="gradientCta"
      width="full"
      size="md"
      icon={Check}
      loading={isSaving}
      disabled={isSaving}
    />
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('workoutDetail.editTimeTitle')}
        footer={footer}
      >
        <ScrollView className="flex-1">
          <View className="gap-6 p-4">
            <View
              className="items-center justify-center rounded-2xl p-6"
              style={{ backgroundColor: theme.colors.background.white5 }}
            >
              <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                {t('workoutDetail.totalTime')}
              </Text>
              <View className="mt-1 flex-row items-baseline gap-1">
                <Text className="text-4xl font-extrabold text-text-primary">
                  {durationDisplay.value}
                </Text>
                {durationDisplay.suffix ? (
                  <Text className="text-lg font-bold text-text-secondary">
                    {durationDisplay.suffix}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="gap-6">
              <View className="flex-row gap-4">
                <DatePickerInput
                  className="flex-1"
                  label={t('workoutDetail.startDate')}
                  selectedDate={startedAt}
                  onPress={() =>
                    setPickerConfig({ type: 'date', target: 'started', visible: true })
                  }
                  variant="default"
                />
                <TimePickerInput
                  className="flex-1"
                  label={t('workoutDetail.startTime')}
                  selectedTime={startedAt}
                  onPress={() =>
                    setPickerConfig({ type: 'time', target: 'started', visible: true })
                  }
                  variant="default"
                />
              </View>

              <View className="flex-row gap-4">
                <DatePickerInput
                  className="flex-1"
                  label={t('workoutDetail.endDate')}
                  selectedDate={completedAt}
                  onPress={() =>
                    setPickerConfig({ type: 'date', target: 'completed', visible: true })
                  }
                  variant="default"
                />
                <TimePickerInput
                  className="flex-1"
                  label={t('workoutDetail.endTime')}
                  selectedTime={completedAt}
                  onPress={() =>
                    setPickerConfig({ type: 'time', target: 'completed', visible: true })
                  }
                  variant="default"
                />
              </View>
            </View>

            {hasExercises && exerciseOptions.length > 0 ? (
              <>
                <SectionDivider />
                <View>
                  <Text className="mb-4 text-xs font-bold uppercase tracking-widest text-text-tertiary">
                    {t('workoutDetail.reorderTitle')}
                  </Text>
                  <OptionsMultiSelector
                    title={t('workoutDetail.exercisesCount', { count: exerciseOptions.length })}
                    options={exerciseOptions}
                    onChange={() => {}}
                    onOrderChange={setExerciseOptions}
                    isEditable={true}
                    hasGroups={true}
                    hideCheckboxes={true}
                    disablePressAnimation={true}
                  />
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </FullScreenModal>

      <DatePickerModal
        visible={pickerConfig.visible ? pickerConfig.type === 'date' : false}
        onClose={() => setPickerConfig((prev) => ({ ...prev, visible: false }))}
        selectedDate={pickerConfig.target === 'started' ? startedAt : completedAt}
        onDateSelect={handleDateSelect}
      />

      <TimePickerModal
        visible={pickerConfig.visible ? pickerConfig.type === 'time' : false}
        onClose={() => setPickerConfig((prev) => ({ ...prev, visible: false }))}
        selectedTime={pickerConfig.target === 'started' ? startedAt : completedAt}
        onTimeSelect={handleTimeSelect}
        title={
          pickerConfig.target === 'started'
            ? t('workoutDetail.startTime')
            : t('workoutDetail.endTime')
        }
      />
    </>
  );
}
