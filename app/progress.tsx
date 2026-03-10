import { useTranslation } from 'react-i18next';
import { ScrollView, View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MoreVertical, Sparkles, Ruler, Scale, Utensils, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';

import { MasterLayout } from '../components/MasterLayout';
import { useProgressData } from '../hooks/useProgressData';
import { useSettings } from '../hooks/useSettings';
import { ProgressDateFilter } from '../components/progress/ProgressDateFilter';
import { BodyMetricsCharts } from '../components/progress/BodyMetricsCharts';
import { NutritionCharts } from '../components/progress/NutritionCharts';
import { WorkoutCharts } from '../components/progress/WorkoutCharts';
import { ProgressInsightsSection } from '../components/progress/ProgressInsightsSection';
import { LineChart } from '../components/charts/LineChart';
import { ProgressChartSection } from '../components/progress/ProgressChartSection';
import { useTheme } from '../hooks/useTheme';
import { MenuButton } from '../components/theme/MenuButton';
import { useAiEnabled } from '../hooks/useAiEnabled';
import { healthDataSyncService } from '../services/healthDataSync';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { units } = useSettings();
  const { aiEnabled } = useAiEnabled();
  const {
    data,
    isLoading,
    preset,
    changePreset,
    useWeeklyAverages,
    setUseWeeklyAverages,
    refresh,
  } = useProgressData();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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

  const menuItems = [
    ...(aiEnabled ? [{
      label: t('progress.getAiInsights'),
      icon: Sparkles,
      onPress: () => {
        router.push('/chat?context=progression');
        setShowMenu(false);
      },
      color: theme.colors.accent.primary,
    }] : []),
    {
      label: t('progress.manageMetrics'),
      icon: Scale,
      onPress: () => {
        router.push('/settings'); // Or specific metrics screen if it exists
        setShowMenu(false);
      },
    },
    {
      label: t('progress.manageNutrition'),
      icon: Utensils,
      onPress: () => {
        router.push('/nutrition/manage');
        setShowMenu(false);
      },
    },
    {
      label: t('progress.listMeasurements'),
      icon: Ruler,
      onPress: () => {
        router.push('/profile');
        setShowMenu(false);
      },
    },
    {
      label: t('progress.syncHealthConnect'),
      icon: RefreshCw,
      onPress: handleSync,
      loading: isSyncing,
    },
  ];

  return (
    <MasterLayout>
      <Stack.Screen
        options={{
          title: t('progress.title'),
          headerRight: () => (
            <MenuButton onPress={() => setShowMenu(!showMenu)} />
          ),
        }}
      />
      <View className="flex-1">
        <ProgressDateFilter
          activePreset={preset}
          onPresetChange={changePreset}
          useWeeklyAverages={useWeeklyAverages}
          onToggleWeeklyAverages={setUseWeeklyAverages}
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
            <View className="px-4">
              {data?.insights && <ProgressInsightsSection insights={data.insights} />}

              <BodyMetricsCharts
                weightHistory={data?.weightHistory || []}
                fatHistory={data?.fatHistory || []}
                ffmiHistory={data?.ffmiHistory || []}
                units={units}
              />

              <NutritionCharts
                nutritionHistory={data?.nutritionHistory || []}
                weightHistory={data?.weightHistory || []}
              />

              <WorkoutCharts
                workoutVolumeHistory={data?.workoutVolumeHistory || []}
                muscleGroupSets={data?.muscleGroupSets || []}
              />

              {data?.measurementsHistory && Object.entries(data.measurementsHistory).map(([type, history]) => (
                <ProgressChartSection
                  key={type}
                  title={t(`progress.measurement.${type}`)}
                >
                  <LineChart
                    data={history.map(p => ({ x: p.date, y: p.value }))}
                    height={150}
                    xDomain={[history[0].date, history[history.length - 1].date]}
                    yDomain={[
                      Math.min(...history.map(p => p.value)) * 0.95,
                      Math.max(...history.map(p => p.value)) * 1.05
                    ]}
                    tooltipFormatter={(p) => `${Math.round(p.y * 10) / 10}`}
                  />
                </ProgressChartSection>
              ))}
            </View>
          </ScrollView>
        )}

        {showMenu && (
          <TouchableOpacity
            className="absolute bottom-0 left-0 right-0 top-0 z-40 bg-black/20"
            onPress={() => setShowMenu(false)}
          >
            <View
              className="absolute right-4 top-12 z-50 w-64 rounded-2xl bg-background-card p-2 shadow-xl"
              style={{ top: 60 }}
            >
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={item.onPress}
                  className="flex-row items-center gap-3 rounded-xl p-3 active:bg-background-tertiary"
                >
                  <item.icon size={20} color={item.color || theme.colors.text.secondary} />
                  <Text className="flex-1 text-sm font-medium text-text-primary">
                    {item.label}
                  </Text>
                  {item.loading && <ActivityIndicator size="small" color={theme.colors.accent.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </MasterLayout>
  );
}
