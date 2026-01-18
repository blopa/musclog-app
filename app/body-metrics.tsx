import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { ChevronLeft, Plus, SlidersHorizontal, Calendar, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { theme } from '../theme';
import { VictoryChart, VictoryArea, VictoryLine, VictoryScatter, VictoryAxis } from 'victory';
import { MasterLayout } from '../components/MasterLayout';
import { SegmentedControl } from '../components/theme/SegmentedControl';
import { GenericCard } from '../components/cards/GenericCard';
import { HistoryBodyMetricCard } from '../components/cards/HistoryBodyMetricCard';

type MetricType = 'weight' | 'bodyFat' | 'bmi' | 'ffmi';
type TimePeriod = '30D' | '3M' | '1Y';

const METRIC_DATA = {
  weight: {
    current: '78.5',
    unit: 'kg',
    label: 'Weight',
  },
  bodyFat: {
    current: '15.0',
    unit: '%',
    label: 'Body Fat',
  },
  bmi: {
    current: '24.2',
    unit: '',
    label: 'BMI',
  },
  ffmi: {
    current: '20.5',
    unit: '',
    label: 'FFMI',
  },
};

const HISTORY_ENTRIES = [
  {
    id: '1',
    date: 'Today, 08:30 AM',
    value: '78.5 kg',
    change: '-0.4 kg',
    changeType: 'down' as const,
    note: 'Target: 75.0 kg',
    icon: Calendar,
    iconColor: '#ffffff',
    iconBg: '#4f46e5', // Indigo-600 for vibrant blue/indigo
  },
  {
    id: '2',
    date: 'Jun 08, 07:45 AM',
    value: '78.9 kg',
    change: '+0.2 kg',
    changeType: 'up' as const,
    note: 'Post-workout',
    icon: Calendar,
    iconColor: '#9ca3af', // Gray-400
    iconBg: 'rgba(55, 65, 81, 0.3)', // Gray-700 with opacity
  },
  {
    id: '3',
    date: 'Jun 05, 08:15 AM',
    value: '78.7 kg',
    change: '-0.8 kg',
    changeType: 'down' as const,
    note: 'Weekly low',
    icon: Calendar,
    iconColor: '#9ca3af', // Gray-400
    iconBg: 'rgba(55, 65, 81, 0.3)', // Gray-700 with opacity
  },
  {
    id: '4',
    date: 'May 31, 09:00 AM',
    value: '79.5 kg',
    change: null,
    changeType: null,
    note: 'Baseline',
    icon: Clock,
    iconColor: '#9ca3af', // Gray-400
    iconBg: 'rgba(55, 65, 81, 0.3)', // Gray-700 with opacity
    opacity: 0.7,
  },
];

// Simple line chart component using Victory Native
function LineChart() {
  // Convert SVG Bezier path data points to chart data
  // Based on: M0 120 C 50 110, 100 130, 150 90 C 200 50, 250 70, 300 40 C 350 10, 400 30, 400 30
  const chartData = [
    { x: 0, y: 120 },
    { x: 50, y: 110 },
    { x: 100, y: 130 },
    { x: 150, y: 90 },
    { x: 200, y: 50 },
    { x: 250, y: 70 },
    { x: 300, y: 40 },
    { x: 400, y: 30 },
  ];

  // Last data point for the circle marker
  const lastPoint = { x: 300, y: 40 };

  return (
    <View className="relative mt-4 h-48 w-full">
      <VictoryChart
        height={192}
        padding={{ left: 0, right: 0, top: 0, bottom: 0 }}
        domain={{ x: [0, 400], y: [0, 150] }}
        style={{
          parent: {
            height: 192,
            width: '100%',
          },
        }}>
        {/* Grid lines - horizontal dashed lines */}
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: 'transparent' },
            grid: {
              stroke: theme.colors.border.light,
              strokeDasharray: '4,4',
              strokeWidth: 1,
            },
            ticks: { stroke: 'transparent' },
            tickLabels: { fill: 'transparent' },
          }}
          tickValues={[37.5, 75, 112.5]}
        />
        {/* Area fill with gradient */}
        <VictoryArea
          data={chartData}
          interpolation="monotoneX"
          style={{
            data: {
              fill: theme.colors.accent.primary,
              fillOpacity: 0.3,
            },
          }}
        />
        {/* Line */}
        <VictoryLine
          data={chartData}
          interpolation="monotoneX"
          style={{
            data: {
              stroke: theme.colors.accent.primary,
              strokeWidth: 3,
              strokeLinecap: 'round',
            },
          }}
        />
        {/* Data point circle at the end */}
        <VictoryScatter
          data={[lastPoint]}
          size={10}
          style={{
            data: {
              fill: theme.colors.accent.primary,
              stroke: theme.colors.background.card,
              strokeWidth: 2,
            },
          }}
        />
        {/* Hidden independent axis (x-axis) */}
        <VictoryAxis
          style={{
            axis: { stroke: 'transparent' },
            grid: { stroke: 'transparent' },
            ticks: { stroke: 'transparent' },
            tickLabels: { fill: 'transparent' },
          }}
        />
      </VictoryChart>
      {/* Custom X-axis labels */}
      <View className="mt-4 flex-row justify-between px-1">
        <Text className="text-[10px] font-medium text-text-tertiary">May 12</Text>
        <Text className="text-[10px] font-medium text-text-tertiary">May 26</Text>
        <Text className="text-[10px] font-medium text-text-tertiary">Jun 11</Text>
      </View>
    </View>
  );
}

export default function BodyMetricsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('weight');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30D');

  const metricOptions = [
    { label: t('bodyMetrics.metrics.weight'), value: 'weight' },
    { label: t('bodyMetrics.metrics.bodyFat'), value: 'bodyFat' },
    { label: t('bodyMetrics.metrics.bmi'), value: 'bmi' },
    { label: t('bodyMetrics.metrics.ffmi'), value: 'ffmi' },
  ];

  const currentMetric = METRIC_DATA[selectedMetric];

  return (
    <MasterLayout>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: '#0F0F0F' }}
        contentContainerStyle={{ backgroundColor: '#0F0F0F' }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="-ml-2 rounded-full p-2"
              style={{ backgroundColor: theme.colors.overlay.white5 }}>
              <ChevronLeft size={theme.iconSize.lg} color={theme.colors.text.primary} />
            </Pressable>
            <Text className="text-xl font-bold tracking-tight text-text-primary">
              {t('bodyMetrics.header.title')}
            </Text>
          </View>
          <Pressable
            className="rounded-full p-2"
            style={{ backgroundColor: theme.colors.overlay.white5 }}
            onPress={() => {
              // Handle add action
            }}>
            <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
          </Pressable>
        </View>

        <View className="mt-2 space-y-6 px-4">
          {/* Metric Selector */}
          <SegmentedControl
            options={metricOptions}
            value={selectedMetric}
            onValueChange={(value) => setSelectedMetric(value as MetricType)}
            variant="gradient"
          />

          {/* Current Metric Card */}
          <GenericCard variant="card" size="default">
            <View className="p-5">
              <View className="mb-6 flex-row items-center justify-between">
                <View>
                  <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                    {`${t('bodyMetrics.current.label')} ${currentMetric.label}`}
                  </Text>
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-3xl font-extrabold text-text-primary">
                      {currentMetric.current}
                    </Text>
                    {currentMetric.unit && currentMetric.unit.length > 0 ? (
                      <Text className="ml-1 text-lg font-medium text-text-tertiary">
                        {currentMetric.unit}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View
                  className="flex-row rounded-lg p-1"
                  style={{ backgroundColor: theme.colors.background.gray800Opacity50 }}>
                  <Pressable
                    onPress={() => setSelectedPeriod('30D')}
                    className={`rounded-md px-3 py-1 ${selectedPeriod === '30D' ? '' : ''}`}
                    style={
                      selectedPeriod === '30D'
                        ? {
                            backgroundColor: theme.colors.accent.primary10,
                          }
                        : {}
                    }>
                    <Text
                      className={`text-[10px] font-bold ${
                        selectedPeriod === '30D' ? 'text-accent-primary' : 'text-text-tertiary'
                      }`}>
                      30D
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedPeriod('3M')}
                    className={`rounded-md px-3 py-1 ${selectedPeriod === '3M' ? '' : ''}`}
                    style={
                      selectedPeriod === '3M'
                        ? {
                            backgroundColor: theme.colors.accent.primary10,
                          }
                        : {}
                    }>
                    <Text
                      className={`text-[10px] font-bold ${
                        selectedPeriod === '3M' ? 'text-accent-primary' : 'text-text-tertiary'
                      }`}>
                      3M
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedPeriod('1Y')}
                    className={`rounded-md px-3 py-1 ${selectedPeriod === '1Y' ? '' : ''}`}
                    style={
                      selectedPeriod === '1Y'
                        ? {
                            backgroundColor: theme.colors.accent.primary10,
                          }
                        : {}
                    }>
                    <Text
                      className={`text-[10px] font-bold ${
                        selectedPeriod === '1Y' ? 'text-accent-primary' : 'text-text-tertiary'
                      }`}>
                      1Y
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Chart */}
              <LineChart />
            </View>
          </GenericCard>

          {/* History Section */}
          <View className="space-y-4">
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-lg font-bold text-text-primary">
                {t('bodyMetrics.history.title')}
              </Text>
              <Pressable className="flex-row items-center gap-1">
                <SlidersHorizontal size={theme.iconSize.sm} color="#6b7280" />
                <Text className="text-xs font-semibold text-text-tertiary">
                  {t('bodyMetrics.history.filter')}
                </Text>
              </Pressable>
            </View>

            <View className="space-y-3">
              {HISTORY_ENTRIES.map((entry) => (
                <HistoryBodyMetricCard key={entry.id} entry={entry} />
              ))}
            </View>

            <Pressable className="w-full py-4">
              <Text className="text-center text-sm font-bold text-text-tertiary">
                {t('bodyMetrics.history.viewAll')}
              </Text>
            </Pressable>
          </View>

          {/* Bottom spacing for navigation */}
          <View className="h-24" />
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
