import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, Pressable, ScrollView } from 'react-native';

import { CenteredModal } from './CenteredModal';
import { Button } from '../theme/Button';
import { theme } from '../../theme';
import { UserMetricService } from '../../database/services';

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
    { label: t('cycle.symptoms.cramps', 'Cramps'), value: 'cramps' },
    { label: t('cycle.symptoms.headache', 'Headache'), value: 'headache' },
    { label: t('cycle.symptoms.bloating', 'Bloating'), value: 'bloating' },
    { label: t('cycle.symptoms.moodSwings', 'Mood Swings'), value: 'mood_swings' },
    { label: t('cycle.symptoms.fatigue', 'Fatigue'), value: 'fatigue' },
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
        const metric = await UserMetricService.createMetric({
          type: 'period_symptoms',
          value: symptoms.length,
          unit: 'count',
          date: now,
          timezone,
        });
        await UserMetricService.updateMetricNote(metric.id, symptoms.join(', '));
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
      title={t('cycle.logDaily', 'Daily Cycle Log')}
      footer={
        <View className="flex-row gap-4">
          <Button
            label={t('common.cancel')}
            onPress={onClose}
            variant="outline"
            width="flex-1"
          />
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
            {t('cycle.flowIntensity', 'Flow Intensity')}
          </Text>
          <View className="flex-row justify-between">
            {[1, 2, 3, 4, 5].map((level) => (
              <Pressable
                key={level}
                onPress={() => setFlow(level)}
                className={`h-12 w-12 items-center justify-center rounded-full border-2 ${
                  flow === level ? 'border-accent-primary bg-accent-primary10' : 'border-white/10'
                }`}
              >
                <Text className={flow === level ? 'text-accent-primary font-bold' : 'text-text-primary'}>
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mb-2">
          <Text className="mb-4 text-lg font-bold text-text-primary">
            {t('cycle.symptomsTitle', 'Symptoms')}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {symptomOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => toggleSymptom(option.value)}
                className={`px-4 py-2 rounded-full border-2 ${
                  symptoms.includes(option.value)
                    ? 'border-accent-primary bg-accent-primary10'
                    : 'border-white/10'
                }`}
              >
                <Text className={symptoms.includes(option.value) ? 'text-accent-primary font-bold' : 'text-text-primary'}>
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
