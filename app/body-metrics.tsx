import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import {
  ChevronLeft,
  Plus,
  SlidersHorizontal,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '../theme';
import { MasterLayout } from '../components/MasterLayout';
import { SegmentedControl } from '../components/theme/SegmentedControl';
import { GenericCard } from '../components/cards/GenericCard';

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

// Simple line chart component
function LineChart() {
  return (
    <View className="relative mt-4 h-48 w-full">
      <Svg width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={theme.colors.accent.primary} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={theme.colors.accent.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {/* Area fill */}
        <Path
          d="M0 120 C 50 110, 100 130, 150 90 C 200 50, 250 70, 300 40 C 350 10, 400 30, 400 30 L 400 150 L 0 150 Z"
          fill="url(#chartGradient)"
        />
        {/* Line */}
        <Path
          d="M0 120 C 50 110, 100 130, 150 90 C 200 50, 250 70, 300 40 C 350 10, 400 30, 400 30"
          fill="none"
          stroke={theme.colors.accent.primary}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Data point circle */}
        <Circle
          cx="300"
          cy="40"
          r="5"
          fill={theme.colors.accent.primary}
          stroke={theme.colors.background.card}
          strokeWidth="2"
        />
      </Svg>
      {/* Grid lines */}
      <View
        className="pointer-events-none absolute inset-0 flex-col justify-between"
        style={{ paddingBottom: 8 }}>
        <View
          className="w-full border-t border-dashed"
          style={{ borderColor: theme.colors.border.light }}
        />
        <View
          className="w-full border-t border-dashed"
          style={{ borderColor: theme.colors.border.light }}
        />
        <View
          className="w-full border-t border-dashed"
          style={{ borderColor: theme.colors.border.light }}
        />
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
                  {t('bodyMetrics.current.label')} {currentMetric.label}
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-3xl font-extrabold text-text-primary">
                    {currentMetric.current}
                  </Text>
                  {currentMetric.unit && (
                    <Text className="ml-1 text-lg font-medium text-text-tertiary">
                      {currentMetric.unit}
                    </Text>
                  )}
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

              {/* X-axis labels */}
              <View className="mt-4 flex-row justify-between px-1">
                <Text className="text-[10px] font-medium text-text-tertiary">May 12</Text>
                <Text className="text-[10px] font-medium text-text-tertiary">May 26</Text>
                <Text className="text-[10px] font-medium text-text-tertiary">Jun 11</Text>
              </View>
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
              {HISTORY_ENTRIES.map((entry) => {
                const IconComponent = entry.icon;
                return (
                  <View key={entry.id} style={{ opacity: entry.opacity || 1 }}>
                    <GenericCard variant="card" size="default">
                      <View className="flex-row items-center justify-between p-5">
                    <View className="flex-1 flex-row items-center gap-4">
                      <View
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: entry.iconBg }}>
                        <IconComponent size={theme.iconSize.xl} color={entry.iconColor} />
                      </View>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs font-medium text-text-secondary">
                          {entry.date}
                        </Text>
                        <Text className="text-xl font-extrabold tracking-tight text-text-primary">
                          {entry.value}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end gap-1">
                      {entry.change && (
                        <View
                          className="flex-row items-center rounded-full px-2.5 py-1"
                          style={{
                            backgroundColor:
                              entry.changeType === 'down'
                                ? 'rgba(34, 197, 94, 0.15)' // Green at 15% opacity
                                : 'rgba(249, 115, 22, 0.15)', // Orange at 15% opacity
                          }}>
                          {entry.changeType === 'down' ? (
                            <TrendingDown size={14} color="#22c55e" />
                          ) : (
                            <TrendingUp size={14} color="#f97316" />
                          )}
                          <Text
                            className="ml-1 text-xs font-bold"
                            style={{
                              color: entry.changeType === 'down' ? '#22c55e' : '#f97316',
                            }}>
                            {entry.change}
                          </Text>
                        </View>
                      )}
                      {!entry.change && (
                        <View
                          className="flex-row items-center rounded-full px-2.5 py-1"
                          style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)' }}>
                          <Text className="text-xs font-bold text-text-tertiary">{entry.note}</Text>
                        </View>
                      )}
                        <Text className="text-[10px] font-medium text-text-tertiary">
                          {entry.note}
                        </Text>
                      </View>
                      </View>
                    </GenericCard>
                  </View>
                );
              })}
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
