import { Activity, Calendar, Plus, UtensilsCrossed } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { MasterLayout } from '../components/MasterLayout';
import { CycleLogModal } from '../components/modals/CycleLogModal';
import { Button } from '../components/theme/Button';
import { theme } from '../theme';
import { useMenstrualCycle } from '../hooks/useMenstrualCycle';
import { UserMetricService } from '../database/services';
import UserMetric from '../database/models/UserMetric';

export default function CycleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { nextPeriodDate, currentPhase } = useMenstrualCycle();
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
              {t('cycle.title', 'Cycle')}
            </Text>
            <Pressable
              onPress={() => router.push('/nutrition/food')}
              className="flex-row items-center gap-2 rounded-full bg-bg-overlay px-4 py-2"
            >
              <UtensilsCrossed size={16} color={theme.colors.accent.primary} />
              <Text className="text-sm font-bold text-accent-primary">
                {t('home.navigation.food')}
              </Text>
            </Pressable>
          </View>

          {/* Prediction Card */}
          <View className="mb-8 rounded-3xl bg-bg-overlay p-6 border-2 border-white/5">
            <View className="mb-6 flex-row items-center gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent-primary20">
                <Calendar size={24} color={theme.colors.accent.primary} />
              </View>
              <View>
                <Text className="text-sm text-text-tertiary font-bold uppercase tracking-wider">
                  {t('cycle.nextPeriod', 'Next Period Prediction')}
                </Text>
                <Text className="text-xl font-black text-text-primary">
                  {nextPeriodDate ? nextPeriodDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : '--'}
                </Text>
              </View>
            </View>

            <View className="h-2 w-full rounded-full bg-bg-navActive overflow-hidden">
               <View
                 className="h-full bg-accent-primary"
                 style={{ width: '40%' }} // Placeholder progress
               />
            </View>
          </View>

          <View className="mb-8">
             <View className="flex-row items-center justify-between mb-4">
                <Text className="text-2xl font-bold text-text-primary">
                   {t('cycle.dailyLog', 'Daily Log')}
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
                     className="rounded-2xl bg-bg-card p-5 border-2 border-white/5 flex-row items-center justify-between"
                   >
                     <View className="flex-1">
                       <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-1">
                         {metric.type === 'period_flow' ? t('cycle.flowIntensity', 'Flow Intensity') : t('cycle.symptomsTitle', 'Symptoms')}
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
               <View className="rounded-2xl bg-bg-card p-6 border-2 border-white/5 items-center justify-center">
                  <Text className="text-text-tertiary text-center">
                     {t('cycle.noLogsToday', 'No symptoms logged for today.')}
                  </Text>
                  <View className="mt-4">
                     <Button
                       label={t('cycle.logSymptoms', 'Log Symptoms')}
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

      <CycleLogModal
        visible={isLogModalVisible}
        onClose={() => setIsLogModalVisible(false)}
      />
    </MasterLayout>
  );
}
