import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { CARE_TOPIC_LABEL_KEYS, careTopics, CYCLE_EDUCATION } from '@/utils/cycle/careGuidance';
import { contextAt } from '@/utils/cycle/contraception';
import { handleError } from '@/utils/handleError';

export function CycleCareCard({ day, onAppointment }: { day: number; onAppointment: () => void }) {
  const { t } = useTranslation();
  const { dayLogs, contexts } = useMenstrualCycle();
  const topics = careTopics(
    dayLogs.find((log) => log.date === day),
    contextAt(contexts, day)?.lifeStage ?? 'regular'
  );
  return (
    <View className="mb-6 gap-2 rounded-2xl bg-bg-overlay p-5">
      <Text className="text-base font-bold text-text-primary">{t('cycle.complete.careTitle')}</Text>
      <Text className="text-sm text-text-secondary">{t('cycle.complete.careHint')}</Text>
      {topics.map((topic) => (
        <TextButton
          key={topic}
          label={t(CARE_TOPIC_LABEL_KEYS[topic])}
          onPress={() => {
            void Linking.openURL(CYCLE_EDUCATION[topic]).catch((error) =>
              handleError(error, 'CycleCareCard.link', {
                sendToSentry: false,
                snackbarMessage: t('errors.somethingWentWrong'),
              })
            );
          }}
        />
      ))}
      <TextButton label={t('cycle.settings.summaryCreate')} onPress={onAppointment} />
    </View>
  );
}
