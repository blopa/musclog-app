import { Stack, useRouter } from 'expo-router';
import { RefreshCw, Ruler, Scale, Sparkles, Utensils } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, InteractionManager, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomPopUpMenu, BottomPopUpMenuItem } from '../components/BottomPopUpMenu';
import { LineChart } from '../components/charts/LineChart';
import { MasterLayout } from '../components/MasterLayout';
import { BodyCompProteinChart } from '../components/progress/BodyCompProteinChart';
import { BodyMetricsCharts } from '../components/progress/BodyMetricsCharts';
import { MacroMuscleChart } from '../components/progress/MacroMuscleChart';
import { MenstrualPerformanceChart } from '../components/progress/MenstrualPerformanceChart';
import { NutritionCharts } from '../components/progress/NutritionCharts';
import { ProgressChartSection } from '../components/progress/ProgressChartSection';
import { ProgressDateFilter } from '../components/progress/ProgressDateFilter';
import { ProgressInsightsSection } from '../components/progress/ProgressInsightsSection';
import { RecoveryTrainingChart } from '../components/progress/RecoveryTrainingChart';
import { VolumeCaloriesChart } from '../components/progress/VolumeCaloriesChart';
import { WorkoutCharts } from '../components/progress/WorkoutCharts';
import { MenuButton } from '../components/theme/MenuButton';
import { ChartTooltipProvider, useChartTooltip } from '../context/ChartTooltipContext';
import { useAiEnabled } from '../hooks/useAiEnabled';
import { useProgressData } from '../hooks/useProgressData';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { healthDataSyncService } from '../services/healthDataSync';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { units, chartTooltipPosition } = useSettings();
  const { isEnabled: aiEnabled } = useAiEnabled();
  const {
    data,
    allAggregationData,
    isLoading,
    preset,
    changePreset,
    appliedCustomRange,
    applyCustomRange,
    useWeeklyAverages,
    setUseWeeklyAverages,
    refresh,
    hasAnyAggregationData,
  } = useProgressData();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Fix #5: Render charts progressively so the screen becomes interactive fast.
  // Phase 0 → nothing (reset when isLoading changes)
  // Phase 1 → primary above-fold charts (BodyMetrics) rendered immediately on load
  // Phase 2 → secondary charts after all pending interactions complete
  // Phase 3 → remaining charts 400ms later
  const [chartPhase, setChartPhase] = useState(0);
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const prevIsLoadingRef = useRef(isLoading);

  useEffect(() => {
    if (prevIsLoadingRef.current === isLoading) {
      return;
    }
    prevIsLoadingRef.current = isLoading;

    phaseTimersRef.current.forEach(clearTimeout);
    phaseTimersRef.current = [];

    if (isLoading) {
      setChartPhase(0);
      return;
    }

    setChartPhase(1);
    const task = InteractionManager.runAfterInteractions(() => {
      setChartPhase(2);
      const t1 = setTimeout(() => setChartPhase(3), 400);
      phaseTimersRef.current.push(t1);
    });
    return () => {
      task.cancel();
      phaseTimersRef.current.forEach(clearTimeout);
    };
  }, [isLoading]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await healthDataSyncService.syncFromHealthConnect({ lookbackDays: 30 });
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
      setShowMenu(false);
    }
  };

  const menuItems: BottomPopUpMenuItem[] = [
    ...(aiEnabled
      ? [
          {
            title: t('progress.getAiInsights'),
            description: t('progress.getAiInsightsDescription'),
            icon: Sparkles,
            onPress: () => {
              router.push('/chat?context=progression');
            },
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.background.iconDarker,
          },
        ]
      : []),
    {
      title: t('progress.manageMetrics'),
      description: t('progress.manageMetricsDescription'),
      icon: Scale,
      onPress: () => {
        router.push('/settings');
      },
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
    {
      title: t('progress.manageNutrition'),
      description: t('progress.manageNutritionDescription'),
      icon: Utensils,
      onPress: () => {
        router.push('/nutrition/manage');
      },
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
    {
      title: t('progress.listMeasurements'),
      description: t('progress.listMeasurementsDescription'),
      icon: Ruler,
      onPress: () => {
        router.push('/profile');
      },
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
    {
      title: t('progress.syncHealthConnect'),
      description: isSyncing ? t('progress.syncing') : t('progress.syncHealthConnectDescription'),
      icon: RefreshCw,
      onPress: isSyncing ? () => {} : handleSync,
      iconColor: isSyncing ? theme.colors.text.secondary : theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
  ];

  return (
    <MasterLayout>
      <Stack.Screen
        options={{
          title: t('progress.title'),
          headerRight: () => <MenuButton onPress={() => setShowMenu(true)} />,
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.colors.background.primary,
          },
          headerTintColor: theme.colors.text.primary,
          headerShadowVisible: false,
        }}
      />
      <ChartTooltipProvider tooltipPosition={chartTooltipPosition}>
        <ProgressScreenContent
          allAggregationData={allAggregationData}
          chartPhase={chartPhase}
          data={data}
          hasAnyAggregationData={hasAnyAggregationData}
          insets={insets}
          isLoading={isLoading}
          menuItems={menuItems}
          preset={preset}
          changePreset={changePreset}
          appliedCustomRange={appliedCustomRange}
          onApplyCustomRange={applyCustomRange}
          setUseWeeklyAverages={setUseWeeklyAverages}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
          t={t}
          theme={theme}
          units={units}
          useWeeklyAverages={useWeeklyAverages}
        />
      </ChartTooltipProvider>
    </MasterLayout>
  );
}

function ProgressScreenContent({
  allAggregationData,
  chartPhase,
  data,
  hasAnyAggregationData,
  insets,
  isLoading,
  menuItems,
  preset,
  changePreset,
  appliedCustomRange,
  onApplyCustomRange,
  setUseWeeklyAverages,
  showMenu,
  setShowMenu,
  t,
  theme,
  units,
  useWeeklyAverages,
}: any) {
  const { dismissAll } = useChartTooltip();

  return (
    <View className="flex-1 bg-bg-primary" style={{ paddingTop: 8 }}>
      <ProgressDateFilter
        activePreset={preset}
        onPresetChange={changePreset}
        appliedRange={appliedCustomRange}
        onApplyCustomRange={onApplyCustomRange}
        useWeeklyAverages={useWeeklyAverages}
        onToggleWeeklyAverages={setUseWeeklyAverages}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          onScrollBeginDrag={dismissAll}
        >
          <View className="px-4">
            {data?.insights ? <ProgressInsightsSection insights={data.insights} /> : null}

            {/* Phase 1: primary chart — renders immediately on load */}
            {chartPhase >= 1 ? (
              <BodyMetricsCharts
                weightHistory={data?.weightHistory || []}
                fatHistory={data?.fatHistory || []}
                ffmiHistory={data?.ffmiHistory || []}
                units={units}
              />
            ) : null}

            {/* Phase 2: secondary charts — rendered after interactions complete */}
            {chartPhase >= 2 ? (
              <>
                <NutritionCharts
                  nutritionHistory={data?.nutritionHistory || []}
                  weightHistory={data?.weightHistory || []}
                  units={units}
                />

                <WorkoutCharts
                  workoutVolumeHistory={data?.workoutVolumeHistory || []}
                  muscleGroupSets={data?.muscleGroupSets || []}
                />
              </>
            ) : null}

            {/* Phase 3: remaining charts — rendered 400ms after interactions */}
            {chartPhase >= 3 && data ? (
              <>
                {hasAnyAggregationData((d: any) => d.correlationHistory) ? (
                  <VolumeCaloriesChart
                    allData={{
                      daily: allAggregationData.daily?.correlationHistory ?? [],
                      weekly: allAggregationData.weekly?.correlationHistory ?? [],
                      monthly: allAggregationData.monthly?.correlationHistory ?? [],
                    }}
                    units={units}
                  />
                ) : null}
                {hasAnyAggregationData((d: any) => d.bodyCompProteinHistory) ? (
                  <BodyCompProteinChart
                    allData={{
                      daily: allAggregationData.daily?.bodyCompProteinHistory ?? [],
                      weekly: allAggregationData.weekly?.bodyCompProteinHistory ?? [],
                      monthly: allAggregationData.monthly?.bodyCompProteinHistory ?? [],
                    }}
                    units={units}
                  />
                ) : null}
                {hasAnyAggregationData((d: any) => d.menstrualPhaseHistory) ? (
                  <MenstrualPerformanceChart
                    allData={{
                      daily: allAggregationData.daily?.menstrualPhaseHistory ?? [],
                      weekly: allAggregationData.weekly?.menstrualPhaseHistory ?? [],
                      monthly: allAggregationData.monthly?.menstrualPhaseHistory ?? [],
                    }}
                  />
                ) : null}
                {hasAnyAggregationData((d: any) => d.recoveryTrainingHistory) ? (
                  <RecoveryTrainingChart
                    allData={{
                      daily: allAggregationData.daily?.recoveryTrainingHistory ?? [],
                      weekly: allAggregationData.weekly?.recoveryTrainingHistory ?? [],
                      monthly: allAggregationData.monthly?.recoveryTrainingHistory ?? [],
                    }}
                  />
                ) : null}
                {hasAnyAggregationData((d: any) => d.macroMuscleHistory) ? (
                  <MacroMuscleChart
                    allData={{
                      daily: allAggregationData.daily?.macroMuscleHistory ?? [],
                      weekly: allAggregationData.weekly?.macroMuscleHistory ?? [],
                      monthly: allAggregationData.monthly?.macroMuscleHistory ?? [],
                    }}
                    units={units}
                  />
                ) : null}

                {data.measurementsHistory
                  ? Object.entries(data.measurementsHistory).map(
                      ([type, history]: [string, any]) => (
                        <ProgressChartSection key={type} title={t(`progress.measurement.${type}`)}>
                          <LineChart
                            data={history.map((p: any) => ({ x: p.date, y: p.value }))}
                            height={150}
                            xDomain={[history[0].date, history[history.length - 1].date]}
                            yDomain={[
                              Math.min(...history.map((p: any) => p.value)) * 0.95,
                              Math.max(...history.map((p: any) => p.value)) * 1.05,
                            ]}
                            tooltipFormatter={(p) => `${Math.round(p.y * 10) / 10}`}
                          />
                        </ProgressChartSection>
                      )
                    )
                  : null}
              </>
            ) : null}
          </View>
          <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
        </ScrollView>
      )}

      <BottomPopUpMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title={t('progress.quickActions')}
        items={menuItems}
      />
    </View>
  );
}
