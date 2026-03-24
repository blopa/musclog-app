import { format, isSameDay } from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { UserMetricService } from '../../database/services';
import { theme } from '../../theme'; // TODO: figure out a way to use useTheme instead or dynamically use dark or light theme based on configuration
import { Button } from '../theme/Button';
import { CenteredModal } from './CenteredModal';
import { DatePickerModal } from './DatePickerModal';

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
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [existingFlowId, setExistingFlowId] = useState<string | null>(null);
  const [existingSymptomId, setExistingSymptomId] = useState<string | null>(null);

  const symptomOptions = [
    { label: t('cycle.symptoms.cramps'), value: 'cramps' },
    { label: t('cycle.symptoms.headache'), value: 'headache' },
    { label: t('cycle.symptoms.bloating'), value: 'bloating' },
    { label: t('cycle.symptoms.moodSwings'), value: 'mood_swings' },
    { label: t('cycle.symptoms.fatigue'), value: 'fatigue' },
  ];

  const resetForm = () => {
    setFlow(null);
    setSymptoms([]);
    setExistingFlowId(null);
    setExistingSymptomId(null);
  };

  // Reset to initial date or today whenever the modal opens
  useEffect(() => {
    if (visible) {
      setSelectedDate(initialDate || new Date());
      resetForm(); // Reset form fields when modal opens
    }
  }, [visible, initialDate]);

  // Load existing metrics for the selected date
  useEffect(() => {
    if (!visible) {
      return;
    }

    const loadExistingMetrics = async () => {
      const startOfDay = new Date(selectedDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      resetForm(); // Reset form fields before loading new data

      const [flowMetrics, symptomMetrics] = await Promise.all([
        UserMetricService.getMetricsHistory('period_flow', {
          startDate: startOfDay.getTime(),
          endDate: endOfDay.getTime(),
        }),
        UserMetricService.getMetricsHistory('period_symptoms', {
          startDate: startOfDay.getTime(),
          endDate: endOfDay.getTime(),
        }),
      ]);

      if (flowMetrics.length > 0) {
        const decrypted = await flowMetrics[0].getDecrypted();
        setFlow(decrypted.value);
        setExistingFlowId(flowMetrics[0].id);
      } else {
        setFlow(null);
        setExistingFlowId(null);
      }

      if (symptomMetrics.length > 0) {
        const note = await symptomMetrics[0].getNote();
        setSymptoms(note ? note.split(', ') : []);
        setExistingSymptomId(symptomMetrics[0].id);
      } else {
        setSymptoms([]);
        setExistingSymptomId(null);
      }
    };

    loadExistingMetrics();
  }, [visible, selectedDate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dateTimestamp = selectedDate.getTime();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
      console.error('Error saving cycle log:', error);
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

  const isToday = isSameDay(selectedDate, new Date());
  const dateLabel = isToday ? t('datePicker.today') : format(selectedDate, 'MMM d, yyyy');

  return (
    <>
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
          {/* Date Selector */}
          <Pressable
            onPress={() => setIsDatePickerVisible(true)}
            className="mb-6 flex-row items-center gap-3 rounded-xl border-2 border-white/10 px-4 py-3"
          >
            <CalendarDays size={18} color={theme.colors.accent.primary} />
            <Text className="flex-1 font-semibold text-text-primary">{dateLabel}</Text>
            <ChevronDown size={16} color={theme.colors.text.secondary} />
          </Pressable>

          {/* Flow Intensity */}
          <View className="mb-6">
            <Text className="mb-4 text-lg font-bold text-text-primary">
              {t('cycle.flowIntensity')}
            </Text>
            <View className="flex-row justify-between">
              {[1, 2, 3, 4, 5].map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setFlow(level)}
                  className={`h-12 w-12 items-center justify-center rounded-full border-2 ${
                    flow === level ? 'bg-accent-primary10 border-accent-primary' : 'border-white/10'
                  }`}
                >
                  <Text
                    className={
                      flow === level ? 'font-bold text-accent-primary' : 'text-text-primary'
                    }
                  >
                    {level}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Symptoms */}
          <View className="mb-2">
            <Text className="mb-4 text-lg font-bold text-text-primary">
              {t('cycle.symptomsTitle')}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {symptomOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => toggleSymptom(option.value)}
                  className={`rounded-full border-2 px-4 py-2 ${
                    symptoms.includes(option.value)
                      ? 'bg-accent-primary10 border-accent-primary'
                      : 'border-white/10'
                  }`}
                >
                  <Text
                    className={
                      symptoms.includes(option.value)
                        ? 'font-bold text-accent-primary'
                        : 'text-text-primary'
                    }
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </CenteredModal>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        maxYear={new Date().getFullYear()}
      />
    </>
  );
}
