import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { FLOW_LEVEL_KEYS, FLOW_LEVELS } from '@/constants/cycle';
import { UserMetricService } from '@/database/services';
import {
  getLocalCalendarYear,
  localCalendarDayDate,
  localDayClosedRangeMaxMs,
  localDayStartMs,
} from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { getCurrentTimezone } from '@/utils/timezone';

import { CenteredModal } from './CenteredModal';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';

const PHYSICAL_SYMPTOM_KEYS: { key: string; value: string }[] = [
  { key: 'cycle.symptoms.cramps', value: 'cramps' },
  { key: 'cycle.symptoms.bloating', value: 'bloating' },
  { key: 'cycle.symptoms.breastTenderness', value: 'breast_tenderness' },
  { key: 'cycle.symptoms.headache', value: 'headache' },
  { key: 'cycle.symptoms.migraine', value: 'migraine' },
  { key: 'cycle.symptoms.nausea', value: 'nausea' },
  { key: 'cycle.symptoms.backPain', value: 'back_pain' },
  { key: 'cycle.symptoms.fatigue', value: 'fatigue' },
  { key: 'cycle.symptoms.acne', value: 'acne' },
  { key: 'cycle.symptoms.foodCravings', value: 'food_cravings' },
  { key: 'cycle.symptoms.digestiveIssues', value: 'digestive_issues' },
  { key: 'cycle.symptoms.hotFlashes', value: 'hot_flashes' },
  { key: 'cycle.symptoms.insomnia', value: 'insomnia' },
];

const EMOTIONAL_SYMPTOM_KEYS: { key: string; value: string }[] = [
  { key: 'cycle.symptoms.moodSwings', value: 'mood_swings' },
  { key: 'cycle.symptoms.anxiety', value: 'anxiety' },
  { key: 'cycle.symptoms.irritability', value: 'irritability' },
  { key: 'cycle.symptoms.lowMood', value: 'low_mood' },
  { key: 'cycle.symptoms.brainFog', value: 'brain_fog' },
  { key: 'cycle.symptoms.lowLibido', value: 'low_libido' },
];

type CycleLogModalProps = {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
};

export function CycleLogModal({ visible, onClose, initialDate }: CycleLogModalProps) {
  const { t } = useTranslation();
  const [flow, setFlow] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() =>
    localCalendarDayDate(initialDate || new Date())
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [existingFlowId, setExistingFlowId] = useState<string | null>(null);
  const [existingSymptomId, setExistingSymptomId] = useState<string | null>(null);

  const resetForm = () => {
    setFlow(null);
    setSymptoms([]);
    setExistingFlowId(null);
    setExistingSymptomId(null);
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    const loadExistingMetrics = async () => {
      const startMs = localDayStartMs(selectedDate);
      const endMs = localDayClosedRangeMaxMs(selectedDate);

      resetForm();

      const [flowMetrics, symptomMetrics] = await Promise.all([
        UserMetricService.getMetricsHistory('period_flow', {
          startDate: startMs,
          endDate: endMs,
        }),
        UserMetricService.getMetricsHistory('period_symptoms', {
          startDate: startMs,
          endDate: endMs,
        }),
      ]);

      if (flowMetrics.length > 0) {
        const decrypted = await flowMetrics[0].getDecrypted();
        setFlow(decrypted.value);
        setExistingFlowId(flowMetrics[0].id);
      }

      if (symptomMetrics.length > 0) {
        const note = await symptomMetrics[0].getNote();
        setSymptoms(note ? note.split(', ') : []);
        setExistingSymptomId(symptomMetrics[0].id);
      }
    };

    loadExistingMetrics();
  }, [visible, selectedDate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dateTimestamp = localDayStartMs(selectedDate);
      const timezone = getCurrentTimezone();

      if (flow !== null) {
        if (existingFlowId) {
          await UserMetricService.updateMetric(existingFlowId, {
            value: flow,
            date: dateTimestamp,
          });
        } else {
          await UserMetricService.createMetric({
            type: 'period_flow',
            value: flow,
            unit: 'level',
            date: dateTimestamp,
            timezone,
          });
        }
      }

      if (symptoms.length > 0) {
        if (existingSymptomId) {
          await UserMetricService.updateMetric(existingSymptomId, {
            value: symptoms.length,
            note: symptoms.join(', '),
            date: dateTimestamp,
          });
        } else {
          await UserMetricService.createMetric({
            type: 'period_symptoms',
            value: symptoms.length,
            unit: 'count',
            note: symptoms.join(', '),
            date: dateTimestamp,
            timezone,
          });
        }
      }

      onClose();
    } catch (error) {
      handleError(error, 'CycleLogModal.handleSave', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSymptom = (symptom: string) => {
    if (symptoms.includes(symptom)) {
      setSymptoms(symptoms.filter((s) => s !== symptom));
    } else {
      setSymptoms([...symptoms, symptom]);
    }
  };

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t('cycle.logDaily')}
      footer={
        <View className="flex-row gap-4">
          <Button label={t('common.cancel')} onPress={onClose} variant="outline" width="flex-1" />
          <Button
            label={t('common.save')}
            onPress={handleSave}
            variant="accent"
            width="flex-1"
            loading={isSaving}
          />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <DatePickerInput
            hideLabel
            selectedDate={selectedDate}
            onPress={() => setIsDatePickerVisible(true)}
            variant="compact"
          />
        </View>

        {/* Flow Intensity */}
        <View className="mb-6">
          <Text className="mb-4 text-lg font-bold text-text-primary">
            {t('cycle.flowIntensity')}
          </Text>
          <View className="gap-2">
            {FLOW_LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => setFlow(level)}
                className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${
                  flow === level ? 'bg-accent-primary10 border-accent-primary' : 'border-white/10'
                }`}
              >
                <View
                  className={`mr-3 h-6 w-6 items-center justify-center rounded-full border-2 ${
                    flow === level ? 'border-accent-primary' : 'border-white/20'
                  }`}
                >
                  {flow === level ? (
                    <View className="h-3 w-3 rounded-full bg-accent-primary" />
                  ) : null}
                </View>
                <View>
                  <Text
                    className={`font-semibold ${
                      flow === level ? 'text-accent-primary' : 'text-text-primary'
                    }`}
                  >
                    {t(FLOW_LEVEL_KEYS[level])}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Physical Symptoms */}
        <View className="mb-4">
          <Text className="mb-3 text-base font-bold text-text-primary">
            {t('cycle.symptoms.physicalTitle')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {PHYSICAL_SYMPTOM_KEYS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => toggleSymptom(option.value)}
                className={`rounded-full border-2 px-3 py-2 ${
                  symptoms.includes(option.value)
                    ? 'bg-accent-primary10 border-accent-primary'
                    : 'border-white/10'
                }`}
              >
                <Text
                  className={`text-sm ${
                    symptoms.includes(option.value)
                      ? 'font-bold text-accent-primary'
                      : 'text-text-primary'
                  }`}
                >
                  {t(option.key)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Emotional Symptoms */}
        <View className="mb-2">
          <Text className="mb-3 text-base font-bold text-text-primary">
            {t('cycle.symptoms.emotionalTitle')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EMOTIONAL_SYMPTOM_KEYS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => toggleSymptom(option.value)}
                className={`rounded-full border-2 px-3 py-2 ${
                  symptoms.includes(option.value)
                    ? 'bg-accent-primary10 border-accent-primary'
                    : 'border-white/10'
                }`}
              >
                <Text
                  className={`text-sm ${
                    symptoms.includes(option.value)
                      ? 'font-bold text-accent-primary'
                      : 'text-text-primary'
                  }`}
                >
                  {t(option.key)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(localCalendarDayDate(date));
          setIsDatePickerVisible(false);
        }}
        maxYear={getLocalCalendarYear(new Date())}
      />
    </CenteredModal>
  );
}
