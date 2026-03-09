import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { UserMetricService } from '../../database/services';
import { Button } from '../theme/Button';
import { CenteredModal } from './CenteredModal';

type CycleLogModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function CycleLogModal({ visible, onClose }: CycleLogModalProps) {
  const { t } = useTranslation();
  const [flow, setFlow] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const symptomOptions = [
    { label: t('cycle.symptoms.cramps'), value: 'cramps' },
    { label: t('cycle.symptoms.headache'), value: 'headache' },
    { label: t('cycle.symptoms.bloating'), value: 'bloating' },
    { label: t('cycle.symptoms.moodSwings'), value: 'mood_swings' },
    { label: t('cycle.symptoms.fatigue'), value: 'fatigue' },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const now = Date.now();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (flow !== null) {
        await UserMetricService.createMetric({
          type: 'period_flow',
          value: flow,
          unit: 'level',
          date: now,
          timezone,
        });
      }

      if (symptoms.length > 0) {
        await UserMetricService.createMetric({
          type: 'period_symptoms',
          value: symptoms.length,
          unit: 'count',
          note: symptoms.join(', '),
          date: now,
          timezone,
        });
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
                  className={flow === level ? 'font-bold text-accent-primary' : 'text-text-primary'}
                >
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

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
  );
}
