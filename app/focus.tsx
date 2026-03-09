import { Zap, LayoutDashboard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { MasterLayout } from '../components/MasterLayout';
import { DailySummaryCard } from '../components/cards/DailySummaryCard/DailySummaryCard';
import { DailySummaryEmptyState } from '../components/cards/DailySummaryCard/DailySummaryEmptyState';
import { PhysiologicalInsightsCard } from '../components/PhysiologicalInsightsCard';
import { useDailyNutritionSummary } from '../hooks/useDailyNutritionSummary';
import { useMenstrualCycle } from '../hooks/useMenstrualCycle';
import { MenstrualService } from '../database/services/MenstrualService';
import { theme } from '../theme';

export default function FocusScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentPhase, energyLevel, cycleDay, cycle } = useMenstrualCycle();

  const today = useMemo(() => new Date(), []);
  const {
    calories: dailyCalories,
    macros: dailyMacros,
    nutritionGoal,
  } = useDailyNutritionSummary({ date: today });

  const insights = currentPhase ? MenstrualService.getInsights(currentPhase) : null;

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-4xl font-black text-text-primary">
              {t('home.navigation.focus', 'Focus')}
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              className="flex-row items-center gap-2 rounded-full bg-bg-overlay px-4 py-2"
            >
              <LayoutDashboard size={16} color={theme.colors.accent.primary} />
              <Text className="text-sm font-bold text-accent-primary">
                {t('home.navigation.home')}
              </Text>
            </Pressable>
          </View>

          <View className="mb-8 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold uppercase tracking-widest text-accent-primary">
                {t('focus.currentPhase', 'Current Phase')}
              </Text>
              <Text className="text-4xl font-black text-text-primary capitalize">
                {currentPhase || '--'}
              </Text>
            </View>
            <View className="items-end rounded-2xl bg-bg-overlay p-4">
              <Text className="text-xs font-bold text-text-tertiary uppercase tracking-tighter">
                {t('focus.day', 'Day')}
              </Text>
              <Text className="text-2xl font-black text-accent-primary">
                {cycleDay ? `${cycleDay.toString().padStart(2, '0')}/${cycle?.avgCycleLength}` : '--'}
              </Text>
            </View>
          </View>

          {/* Phase Wheel Placeholder */}
          <View className="mb-12 items-center justify-center">
            <View className="relative h-64 w-64 items-center justify-center rounded-full border-[16px] border-bg-navActive">
              {/* Visual implementation of wheel would go here */}
              <View className="absolute h-full w-full rounded-full border-[16px] border-accent-primary opacity-20" />
              <View className="items-center">
                <View className="mb-2 h-12 w-12 items-center justify-center rounded-full bg-accent-primary">
                  <Zap size={24} color={theme.colors.text.black} />
                </View>
                <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                  {t('focus.energyLevel', 'Energy Level')}
                </Text>
                <Text className="text-3xl font-black text-text-primary capitalize">
                  {energyLevel || '--'}
                </Text>
              </View>
            </View>
          </View>

          {/* Nutrition Summary Integration */}
          <View className="mb-8">
            <Text className="mb-4 text-2xl font-bold text-text-primary">
              {t('home.sections.dailySummary', 'Daily Summary')}
            </Text>
            {nutritionGoal ? (
              <DailySummaryCard
                calories={dailyCalories}
                macros={{
                  protein: dailyMacros.protein,
                  carbs: dailyMacros.carbs,
                  fats: dailyMacros.fat,
                }}
              />
            ) : (
              <DailySummaryEmptyState onSetGoals={() => router.push('/')} />
            )}
          </View>

          <View className="mb-8">
            <Text className="mb-4 text-2xl font-bold text-text-primary">
              {t('focus.physiologicalInsights', 'Physiological Insights')}
            </Text>
            <View className="flex-row gap-4">
              <PhysiologicalInsightsCard
                type="estrogen"
                label={t('focus.estrogen', 'Estrogen')}
                value={insights?.estrogen || '--'}
                trend={insights?.estrogen === 'rising' ? 'up' : insights?.estrogen === 'dropping' ? 'down' : 'stable'}
              />
              <PhysiologicalInsightsCard
                type="metabolism"
                label={t('focus.metabolism', 'Metabolism')}
                value={insights?.metabolism || '--'}
                trend={insights?.metabolism === 'increasing' ? 'up' : 'stable'}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
