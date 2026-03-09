import { Calendar, Plus, UtensilsCrossed } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { MasterLayout } from '../components/MasterLayout';
import { CycleLogModal } from '../components/modals/CycleLogModal';
import { Button } from '../components/theme/Button';
import { theme } from '../theme';
import { useMenstrualCycle } from '../hooks/useMenstrualCycle';

export default function CycleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { nextPeriodDate, currentPhase } = useMenstrualCycle();
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);

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
