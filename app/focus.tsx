import { useRouter } from 'expo-router';
import { LayoutDashboard } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DailySummaryCard } from '../components/cards/DailySummaryCard/DailySummaryCard';
import { DailySummaryEmptyState } from '../components/cards/DailySummaryCard/DailySummaryEmptyState';
import { MasterLayout } from '../components/MasterLayout';
import { PhaseWheel } from '../components/PhaseWheel';
import { PhysiologicalInsightsCard } from '../components/PhysiologicalInsightsCard';
import { MenstrualService } from '../database/services/MenstrualService';
import { useDailyNutritionSummary } from '../hooks/useDailyNutritionSummary';
import { useMenstrualCycle } from '../hooks/useMenstrualCycle';
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
              {t('home.navigation.focus')}
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
                {t('focus.currentPhase')}
              </Text>
              <Text className="text-4xl font-black capitalize text-text-primary">
                {currentPhase || '--'}
              </Text>
            </View>
            <View className="items-end rounded-2xl bg-bg-overlay p-4">
              <Text className="text-xs font-bold uppercase tracking-tighter text-text-tertiary">
                {t('focus.day')}
              </Text>
              <Text className="text-2xl font-black text-accent-primary">
                {cycleDay
                  ? `${cycleDay.toString().padStart(2, '0')}/${cycle?.avgCycleLength}`
                  : '--'}
              </Text>
            </View>
          </View>

          {/* Phase Wheel Implementation */}
          <View className="mb-12 items-center justify-center">
            <PhaseWheel
              currentPhase={currentPhase}
              energyLevel={energyLevel}
              cycleDay={cycleDay || 1}
              totalDays={cycle?.avgCycleLength || 28}
            />
          </View>

          {/* Nutrition Summary Integration */}
          <View className="mb-8">
            <Text className="mb-4 text-2xl font-bold text-text-primary">
              {t('home.sections.dailySummary')}
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
              {t('focus.physiologicalInsights')}
            </Text>
            <View className="flex-row gap-4">
              <PhysiologicalInsightsCard
                type="estrogen"
                label={t('focus.estrogen')}
                value={insights?.estrogen || '--'}
                trend={
                  insights?.estrogen === 'rising'
                    ? 'up'
                    : insights?.estrogen === 'dropping'
                      ? 'down'
                      : 'stable'
                }
              />
              <PhysiologicalInsightsCard
                type="metabolism"
                label={t('focus.metabolism')}
                value={insights?.metabolism || '--'}
                trend={insights?.metabolism === 'increasing' ? 'up' : 'stable'}
              />
            </View>
          </View>
        </View>
        <View pointerEvents="none" style={{ height: theme.spacing.margin.base }} />
      </ScrollView>
    </MasterLayout>
  );
}
