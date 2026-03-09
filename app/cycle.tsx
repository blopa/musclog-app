import { useRouter } from 'expo-router';
import { Activity, Calendar, Plus, UtensilsCrossed } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MasterLayout } from '../components/MasterLayout';
import { CycleLogModal } from '../components/modals/CycleLogModal';
import { Button } from '../components/theme/Button';
import { UserMetricService } from '../database/services';
import { useMenstrualCycle } from '../hooks/useMenstrualCycle';
import { theme } from '../theme';

export default function CycleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { nextPeriodDate } = useMenstrualCycle();
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [dailyMetrics, setDailyMetrics] = useState<any[]>([]);

  useEffect(() => {
    const fetchDailyMetrics = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const flowMetrics = await UserMetricService.getMetricsHistory('period_flow', {
        startDate: startOfDay.getTime(),
        endDate: endOfDay.getTime(),
      });

      const symptomMetrics = await UserMetricService.getMetricsHistory('period_symptoms', {
        startDate: startOfDay.getTime(),
        endDate: endOfDay.getTime(),
      });

      const allMetrics = [...flowMetrics, ...symptomMetrics];
      const decoratedMetrics = await Promise.all(
        allMetrics.map(async (m) => {
          const decrypted = await m.getDecrypted();
          const note = await m.getNote();
          return {
            id: m.id,
            type: m.type,
            value: decrypted.value,
            note: note,
          };
        })
      );

      setDailyMetrics(decoratedMetrics);
    };

    fetchDailyMetrics();
  }, [isLogModalVisible]);

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8">
          <View className="mb-8 flex-row items-center justify-between">
            <Text className="text-4xl font-black text-text-primary">
              {t('cycle.title')}
            </Text>
          </View>

          {/* Prediction Card */}
          <View className="mb-8 rounded-3xl border-2 border-white/5 bg-bg-overlay p-6">
            <View className="mb-6 flex-row items-center gap-4">
              <View className="bg-accent-primary20 h-12 w-12 items-center justify-center rounded-2xl">
                <Calendar size={24} color={theme.colors.accent.primary} />
              </View>
              <View>
                <Text className="text-sm font-bold uppercase tracking-wider text-text-tertiary">
                  {t('cycle.nextPeriod')}
                </Text>
                <Text className="text-xl font-black text-text-primary">
                  {nextPeriodDate
                    ? nextPeriodDate.toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                      })
                    : '--'}
                </Text>
              </View>
            </View>

            <View className="h-2 w-full overflow-hidden rounded-full bg-bg-navActive">
              <View
                className="h-full bg-accent-primary"
                style={{ width: '40%' }} // Placeholder progress
              />
            </View>
          </View>

          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-text-primary">
                {t('cycle.dailyLog')}
              </Text>
              <Pressable
                onPress={() => setIsLogModalVisible(true)}
                className="h-10 w-10 items-center justify-center rounded-full bg-accent-primary"
              >
                <Plus size={24} color={theme.colors.text.black} />
              </Pressable>
            </View>

            {dailyMetrics.length > 0 ? (
              <View className="gap-4">
                {dailyMetrics.map((metric) => (
                  <View
                    key={metric.id}
                    className="flex-row items-center justify-between rounded-2xl border-2 border-white/5 bg-bg-card p-5"
                  >
                    <View className="flex-1">
                      <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-text-tertiary">
                        {metric.type === 'period_flow'
                          ? t('cycle.flowIntensity')
                          : t('cycle.symptomsTitle')}
                      </Text>
                      <Text className="text-lg font-black text-text-primary">
                        {metric.type === 'period_flow' ? `${metric.value}/5` : metric.note || '--'}
                      </Text>
                    </View>
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-bg-navActive">
                      <Activity size={20} color={theme.colors.accent.primary} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center justify-center rounded-2xl border-2 border-white/5 bg-bg-card p-6">
                <Text className="text-center text-text-tertiary">
                  {t('cycle.noLogsToday')}
                </Text>
                <View className="mt-4">
                  <Button
                    label={t('cycle.logSymptoms')}
                    onPress={() => setIsLogModalVisible(true)}
                    variant="outline"
                    size="sm"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <CycleLogModal visible={isLogModalVisible} onClose={() => setIsLogModalVisible(false)} />
    </MasterLayout>
  );
}
