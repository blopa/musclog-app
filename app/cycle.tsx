import { Activity, Calendar, Plus, Settings } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PhysiologicalInsightsCard } from '../components/cards/PhysiologicalInsightsCard';
import { DateNavigator } from '../components/DateNavigator';
import { MasterLayout } from '../components/MasterLayout';
import { CycleLogModal } from '../components/modals/CycleLogModal';
import { CycleSettingsModal } from '../components/modals/CycleSettingsModal';
import { PhaseWheel } from '../components/PhaseWheel';
import { UserMetricService } from '../database/services';
import { MenstrualService } from '../database/services/MenstrualService';
import { useMenstrualCycle } from '../hooks/useMenstrualCycle';
import { useTheme } from '../hooks/useTheme';
import { localDayClosedRangeMaxMs, localDayStartMs } from '../utils/calendarDate';

export default function CycleScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { currentPhase, energyLevel, cycleDay, cycle, nextPeriodDate } = useMenstrualCycle();
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [dailyMetrics, setDailyMetrics] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const insights = currentPhase ? MenstrualService.getInsights(currentPhase) : null;

  const cycleProgress =
    cycleDay && cycle?.avgCycleLength ? Math.round((cycleDay / cycle.avgCycleLength) * 100) : 0;

  useEffect(() => {
    const fetchDailyMetrics = async () => {
      const startMs = localDayStartMs(selectedDate);
      const endMs = localDayClosedRangeMaxMs(selectedDate);

      const flowMetrics = await UserMetricService.getMetricsHistory('period_flow', {
        startDate: startMs,
        endDate: endMs,
      });

      const symptomMetrics = await UserMetricService.getMetricsHistory('period_symptoms', {
        startDate: startMs,
        endDate: endMs,
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
  }, [isLogModalVisible, selectedDate]);

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-8">
          {/* Title */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-4xl font-black text-text-primary">{t('cycle.title')}</Text>
            {cycle ? (
              <Pressable
                onPress={() => setIsSettingsModalVisible(true)}
                className="h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                hitSlop={8}
              >
                <Settings size={20} color={theme.colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>

          {/* Day counter + phase label */}
          <View className="mb-8 flex-row items-center justify-between">
            <View className="rounded-2xl bg-bg-overlay px-4 py-3">
              <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                {t('focus.day')}
              </Text>
              <Text className="text-2xl font-black text-accent-primary">
                {cycleDay
                  ? `${cycleDay.toString().padStart(2, '0')}/${cycle?.avgCycleLength}`
                  : '--'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-bold uppercase tracking-widest text-accent-primary">
                {t('focus.currentPhase')}
              </Text>
              <Text className="text-2xl font-black capitalize text-text-primary">
                {currentPhase || '--'}
              </Text>
            </View>
          </View>

          {/* Phase Wheel */}
          <View className="mb-10 items-center justify-center">
            <PhaseWheel
              currentPhase={currentPhase}
              energyLevel={energyLevel}
              cycleDay={cycleDay || 1}
              totalDays={cycle?.avgCycleLength || 28}
              avgPeriodDuration={cycle?.avgPeriodDuration}
            />
          </View>

          {/* Date Navigator */}
          <View className="mb-6">
            <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
          </View>

          {/* Cycle Insights & Log */}
          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-text-primary">
                {t('cycle.insightsAndLog')}
              </Text>
              <Pressable
                onPress={() => setIsLogModalVisible(true)}
                className="h-10 w-10 items-center justify-center rounded-full bg-accent-primary"
              >
                <Plus size={24} color={theme.colors.text.black} />
              </Pressable>
            </View>

            {/* Next Period Prediction */}
            <View className="mb-4 rounded-2xl border-2 border-white/5 bg-bg-overlay p-5">
              <View className="mb-4 flex-row items-center gap-4">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg-navActive">
                  <Calendar size={20} color={theme.colors.accent.primary} />
                </View>
                <View>
                  <Text className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                    {t('cycle.nextPeriod')}
                  </Text>
                  <Text className="text-lg font-black text-text-primary">
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
                <View className="h-full bg-accent-primary" style={{ width: `${cycleProgress}%` }} />
              </View>
            </View>

            {/* Daily log items */}
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
            ) : null}
          </View>

          {/* Physiological Insights */}
          <View className="mb-8 flex-row gap-4">
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
        <View pointerEvents="none" style={{ height: theme.spacing.margin.base }} />
      </ScrollView>

      <CycleLogModal
        visible={isLogModalVisible}
        onClose={() => setIsLogModalVisible(false)}
        initialDate={selectedDate}
      />

      {cycle ? (
        <CycleSettingsModal
          visible={isSettingsModalVisible}
          onClose={() => setIsSettingsModalVisible(false)}
          cycle={cycle}
        />
      ) : null}
    </MasterLayout>
  );
}
