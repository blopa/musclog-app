import { useTranslation } from 'react-i18next';
import { ScrollView, View, ActivityIndicator, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Sparkles, Ruler, Scale, Utensils, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { BottomPopUpMenu, BottomPopUpMenuItem } from '../components/BottomPopUpMenu';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { units } = useSettings();
  const { isEnabled: aiEnabled } = useAiEnabled();
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

  const menuItems: BottomPopUpMenuItem[] = [
    ...(aiEnabled ? [{
      title: t('progress.getAiInsights'),
      description: 'Get AI-powered insights on your progress',
      icon: Sparkles,
      onPress: () => {
        router.push('/chat?context=progression');
      },
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.background.iconDarker,
    }] : []),
    {
      title: t('progress.manageMetrics'),
      description: 'Add or edit your weight and body fat data',
      icon: Scale,
      onPress: () => {
        router.push('/settings');
      },
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
    {
      title: t('progress.manageNutrition'),
      description: 'Review and edit your food logs',
      icon: Utensils,
      onPress: () => {
        router.push('/nutrition/manage');
      },
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
    {
      title: t('progress.listMeasurements'),
      description: 'View all your body measurements',
      icon: Ruler,
      onPress: () => {
        router.push('/profile');
      },
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
    {
      title: t('progress.syncHealthConnect'),
      description: 'Import data from Google Health Connect',
      icon: RefreshCw,
      onPress: handleSync,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
    },
  ];

  return (
    <MasterLayout>
      <Stack.Screen
        options={{
          title: t('progress.title'),
          headerRight: () => (
            <MenuButton onPress={() => setShowMenu(true)} />
          ),
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.colors.background.primary,
          },
          headerTintColor: theme.colors.text.primary,
          headerShadowVisible: false,
        }}
      />
      <View className="flex-1 bg-bg-primary" style={{ paddingTop: 8 }}>
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
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
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
                units={units}
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

        <BottomPopUpMenu
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          title={t('progress.quickActions')}
          items={menuItems}
        />
      </View>
    </MasterLayout>
  );
}
