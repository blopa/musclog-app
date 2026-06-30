import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  CircleDot,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { PhysiologicalInsightsCard } from '@/components/cards/PhysiologicalInsightsCard';
import { DateNavigator } from '@/components/DateNavigator';
import { MasterLayout } from '@/components/MasterLayout';
import { CycleLogModal } from '@/components/modals/CycleLogModal';
import { CycleSettingsModal } from '@/components/modals/CycleSettingsModal';
import { PeriodLogModal } from '@/components/modals/PeriodLogModal';
import { PhaseWheel } from '@/components/PhaseWheel';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import {
  CONFIDENCE_LABEL_KEYS,
  FLOW_LEVEL_KEYS,
  LIFE_STAGE_WARNING_KEYS,
  type PeriodLogMode,
} from '@/constants/cycle';
import { UserMetricService } from '@/database/services';
import { MenstrualService } from '@/database/services/MenstrualService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import {
  localCalendarDayDate,
  localDayClosedRangeMaxMs,
  localDayStartMs,
  MS_PER_SOLAR_DAY,
} from '@/utils/calendarDate';

type DailyMetric = {
  id: string;
  type: string;
  value: number;
  note: string | undefined;
};

const getHormoneTrend = (trend?: string) => {
  if (trend === 'rising') {
    return 'up';
  }

  if (trend === 'dropping') {
    return 'down';
  }

  return 'stable';
};

export default function CycleScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const formatFlowMetric = (value: number) => {
    const key = FLOW_LEVEL_KEYS[value];
    if (key) {
      return t(key);
    }
    return `${formatInteger(value)}/5`;
  };

  const formatMetricValue = (metric: DailyMetric) => {
    if (metric.type === 'period_flow') {
      return formatFlowMetric(metric.value);
    }
    return metric.note || '--';
  };
  const {
    currentPhase,
    energyLevel,
    cycleDay,
    cycle,
    cycleStats,
    nextPeriodDate,
    nextPeriodEarliest,
    nextPeriodLatest,
    isCurrentlyInPeriod,
    isIrregular,
    predictionConfidence,
    activePeriodLog,
    nowMs,
  } = useMenstrualCycle();

  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [periodLogMode, setPeriodLogMode] = useState<PeriodLogMode>('start');
  const [isPeriodLogModalVisible, setIsPeriodLogModalVisible] = useState(false);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDayDate(new Date()));

  const insights = currentPhase ? MenstrualService.getInsights(currentPhase) : null;

  const avgCycleLength = cycleStats?.avgCycleLength ?? cycle?.avgCycleLength ?? 28;
  const cycleProgress = cycleDay != null ? Math.round((cycleDay / avgCycleLength) * 100) : 0;

  const openPeriodLog = (mode: PeriodLogMode) => {
    setPeriodLogMode(mode);
    setIsPeriodLogModalVisible(true);
  };

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
  }, [isLogModalVisible, isPeriodLogModalVisible, selectedDate]);

  const lifeStage = cycle?.lifeStage;
  const lifeStageWarningKey = lifeStage ? LIFE_STAGE_WARNING_KEYS[lifeStage] : undefined;
  const lifeStageWarning = lifeStageWarningKey ? t(lifeStageWarningKey) : null;

  const confidenceLabelKey = CONFIDENCE_LABEL_KEYS[predictionConfidence];
  const confidenceLabel = confidenceLabelKey
    ? t(confidenceLabelKey, { count: cycleStats?.logCount ?? 0 })
    : null;

  const formatDate = (date: Date | null) => {
    if (!date) {
      return '--';
    }

    return date.toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
      month: 'long',
      day: 'numeric',
    });
  };

  const nextPeriodDisplay =
    isIrregular && nextPeriodEarliest && nextPeriodLatest
      ? `${formatDate(nextPeriodEarliest)} – ${formatDate(nextPeriodLatest)}`
      : formatDate(nextPeriodDate);

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <AnimatedContent>
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

            {/* Life stage contextual banner */}
            {lifeStageWarning ? (
              <View
                className="mb-6 flex-row items-center gap-3 rounded-2xl p-4"
                style={{ backgroundColor: theme.colors.status.warning10 }}
              >
                <AlertCircle size={18} color={theme.colors.status.warning} />
                <Text className="flex-1 text-sm" style={{ color: theme.colors.status.warning }}>
                  {lifeStageWarning}
                </Text>
              </View>
            ) : null}

            {/* No data empty state */}
            {!cycle ? (
              <View className="mb-8 items-center rounded-2xl bg-bg-overlay p-8">
                <Sparkles size={40} color={theme.colors.text.secondary} />
                <Text className="mt-4 text-center text-lg font-bold text-text-primary">
                  {t('cycle.noData.title')}
                </Text>
                <Text className="mt-2 text-center text-sm text-text-secondary">
                  {t('cycle.noData.description')}
                </Text>
              </View>
            ) : (
              <>
                {/* Day counter + phase label */}
                <View className="mb-8 flex-row items-center justify-between">
                  <View className="rounded-2xl bg-bg-overlay px-4 py-3">
                    <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                      {t('focus.day')}
                    </Text>
                    <Text className="text-2xl font-black text-accent-primary">
                      {cycleDay != null
                        ? `${cycleDay.toString().padStart(2, '0')}/${avgCycleLength}`
                        : '--'}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-bold uppercase tracking-widest text-accent-primary">
                      {t('focus.currentPhase')}
                    </Text>
                    <Text className="text-2xl font-black capitalize text-text-primary">
                      {currentPhase ? t(`cycle.phase.${currentPhase}`) : '--'}
                    </Text>
                  </View>
                </View>

                {/* Phase Wheel */}
                <View className="mb-10 items-center justify-center">
                  <PhaseWheel
                    currentPhase={currentPhase}
                    energyLevel={energyLevel}
                    cycleDay={cycleDay ?? 1}
                    totalDays={avgCycleLength}
                    avgPeriodDuration={cycleStats?.avgPeriodDuration ?? cycle?.avgPeriodDuration}
                  />
                </View>

                {/* Period quick actions */}
                <View className="mb-6 gap-3">
                  {isCurrentlyInPeriod ? (
                    <>
                      <View
                        className="flex-row items-center gap-3 rounded-2xl px-4 py-3"
                        style={{ backgroundColor: theme.colors.rose.brand10 }}
                      >
                        <CircleDot size={16} color={theme.colors.rose.brand} />
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: theme.colors.rose.brand }}
                        >
                          {activePeriodLog
                            ? t('cycle.periodActive', {
                                day:
                                  Math.round(
                                    (nowMs - activePeriodLog.startDate) / MS_PER_SOLAR_DAY
                                  ) + 1,
                              })
                            : t('cycle.periodActiveGeneric')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => openPeriodLog('end')}
                        className="flex-row items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4"
                        style={{ borderColor: theme.colors.rose.brand }}
                      >
                        <CheckCircle size={20} color={theme.colors.rose.brand} />
                        <Text className="font-bold" style={{ color: theme.colors.rose.brand }}>
                          {t('cycle.actions.periodEnded')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={() => openPeriodLog('start')}
                      className="flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4"
                      style={{ backgroundColor: theme.colors.rose.brand }}
                    >
                      <CircleDot size={20} color={theme.colors.text.white} />
                      <Text className="font-bold text-white">
                        {t('cycle.actions.periodStarted')}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => openPeriodLog('past')}
                    className="flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3"
                    style={{ borderColor: theme.colors.border.default }}
                  >
                    <Calendar size={16} color={theme.colors.text.secondary} />
                    <Text className="text-sm text-text-secondary">
                      {t('cycle.actions.logPastPeriod')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

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
              {cycle ? (
                <View className="mb-4 rounded-2xl border-2 border-white/5 bg-bg-overlay p-5">
                  <View className="mb-4 flex-row items-center gap-4">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg-navActive">
                      <Calendar size={20} color={theme.colors.accent.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                        {t('cycle.nextPeriod')}
                      </Text>
                      <Text className="text-lg font-black text-text-primary">
                        {nextPeriodDisplay}
                      </Text>
                    </View>
                  </View>

                  {/* Cycle progress bar */}
                  <View className="mb-3 h-2 w-full overflow-hidden rounded-full bg-bg-navActive">
                    <View
                      className="h-full bg-accent-primary"
                      style={{ width: `${cycleProgress}%` }}
                    />
                  </View>

                  {/* Confidence + irregular indicators */}
                  <View className="flex-row items-center justify-between">
                    {confidenceLabel ? (
                      <Text className="text-xs text-text-tertiary">{confidenceLabel}</Text>
                    ) : null}
                    {isIrregular ? (
                      <Text className="text-xs text-text-tertiary">
                        {t('cycle.confidence.irregular')}
                      </Text>
                    ) : null}
                  </View>

                  {/* Prediction disclaimer */}
                  <Text className="mt-2 text-xs text-text-tertiary">
                    {t('cycle.predictionDisclaimer')}
                  </Text>
                </View>
              ) : null}

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
                          {formatMetricValue(metric)}
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
            {currentPhase ? (
              <View className="mb-8 flex-row gap-4">
                <PhysiologicalInsightsCard
                  type="estrogen"
                  label={t('focus.estrogen')}
                  value={insights?.estrogen || '--'}
                  trend={getHormoneTrend(insights?.estrogen)}
                />
                <PhysiologicalInsightsCard
                  type="metabolism"
                  label={t('focus.metabolism')}
                  value={insights?.metabolism || '--'}
                  trend={insights?.metabolism === 'increasing' ? 'up' : 'stable'}
                />
              </View>
            ) : null}
          </View>
          <View pointerEvents="none" style={{ height: theme.spacing.margin.base }} />
        </AnimatedContent>
      </ScrollView>

      <CycleLogModal
        visible={isLogModalVisible}
        onClose={() => setIsLogModalVisible(false)}
        initialDate={selectedDate}
      />

      <PeriodLogModal
        visible={isPeriodLogModalVisible}
        onClose={() => setIsPeriodLogModalVisible(false)}
        mode={periodLogMode}
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
