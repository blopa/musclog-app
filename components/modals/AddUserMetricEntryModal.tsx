import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { CheckCircle, Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { SegmentedControl } from '../theme/SegmentedControl';
import { GenericCard } from '../cards/GenericCard';
import { DateTimeSelectorCard } from '../cards/DateTimeSelectorCard';
import { MoodSelectorCard } from '../cards/MoodSelectorCard';
import { PagerView, type PagerViewRef } from '../PagerView/PagerView';
import { format } from 'date-fns';
import { FullScreenModal } from './FullScreenModal';

type MetricType = 'weight' | 'bodyFat' | 'height';

type MetricConfig = {
  label: string;
  unit: string;
  defaultValue: number;
  quickIncrements: number[];
  step: number;
};

type AddUserMetricEntryModalProps = {
  visible: boolean;
  onClose: () => void;
};

// Map metric types to page indices
const metricToPageIndex: Record<MetricType, number> = {
  weight: 0,
  bodyFat: 1,
  height: 2,
};

export default function AddUserMetricEntryModal({
  visible,
  onClose,
}: AddUserMetricEntryModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pagerRef = useRef<PagerViewRef>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('weight');
  const [weight, setWeight] = useState(78.5);
  const [bodyFat, setBodyFat] = useState(15.0);
  const [height, setHeight] = useState(180);
  const [mood, setMood] = useState(3); // 0-4: Poor, Low, Okay, Good, Great
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [pagerHeight, setPagerHeight] = useState<number | null>(null);

  const pageIndexToMetric: MetricType[] = ['weight', 'bodyFat', 'height'];

  const metricOptions = [
    { label: t('bodyMetrics.metrics.weight'), value: 'weight' },
    { label: t('bodyMetrics.metrics.bodyFat'), value: 'bodyFat' },
    { label: t('bodyMetrics.metrics.height'), value: 'height' },
  ];

  const metricConfigs: Record<MetricType, MetricConfig> = {
    weight: {
      label: t('bodyMetrics.addEntry.enterWeight'),
      unit: 'kg',
      defaultValue: 78.5,
      quickIncrements: [0.5, 1.0, 5.0],
      step: 0.1,
    },
    bodyFat: {
      label: t('bodyMetrics.addEntry.enterBodyFat'),
      unit: '%',
      defaultValue: 15.0,
      quickIncrements: [0.5, 1.0, 2.0],
      step: 0.1,
    },
    height: {
      label: t('bodyMetrics.addEntry.enterHeight'),
      unit: 'cm',
      defaultValue: 180,
      quickIncrements: [1, 5, 10],
      step: 1,
    },
  };

  const currentConfig = metricConfigs[selectedMetric];
  const currentValue =
    selectedMetric === 'weight' ? weight : selectedMetric === 'bodyFat' ? bodyFat : height;

  const handleIncrement = (amount: number) => {
    if (selectedMetric === 'weight') {
      setWeight((prev) => Math.round((prev + amount) * 10) / 10);
    } else if (selectedMetric === 'bodyFat') {
      setBodyFat((prev) => Math.round((prev + amount) * 10) / 10);
    } else {
      setHeight((prev) => Math.round((prev + amount) * 10) / 10);
    }
  };

  const handleDecrement = () => {
    if (selectedMetric === 'weight') {
      setWeight((prev) => Math.max(0, Math.round((prev - currentConfig.step) * 10) / 10));
    } else if (selectedMetric === 'bodyFat') {
      setBodyFat((prev) => Math.max(0, Math.round((prev - currentConfig.step) * 10) / 10));
    } else {
      setHeight((prev) => Math.max(0, Math.round((prev - currentConfig.step) * 10) / 10));
    }
  };

  const handleIncrementAction = () => {
    if (selectedMetric === 'weight') {
      setWeight((prev) => Math.round((prev + currentConfig.step) * 10) / 10);
    } else if (selectedMetric === 'bodyFat') {
      setBodyFat((prev) => Math.round((prev + currentConfig.step) * 10) / 10);
    } else {
      setHeight((prev) => Math.round((prev + currentConfig.step) * 10) / 10);
    }
  };

  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy');
  };

  const formatTime = (date: Date) => {
    return format(date, 'hh:mm a');
  };

  // Sync PagerView when selectedMetric changes
  useEffect(() => {
    const pageIndex = metricToPageIndex[selectedMetric];
    pagerRef.current?.setPage(pageIndex);
  }, [selectedMetric]);

  const handleMetricChange = (value: string) => {
    setSelectedMetric(value as MetricType);
  };

  const handlePageChange = (pageIndex: number) => {
    const newMetric = pageIndexToMetric[pageIndex];
    if (newMetric !== selectedMetric) {
      setSelectedMetric(newMetric);
    }
  };

  const handleSave = () => {
    // TODO: Save entry logic
    router.back();
  };

  // Render full metric entry card content for a specific metric type
  const renderMetricEntry = (metric: MetricType) => {
    const config = metricConfigs[metric];
    const value = metric === 'weight' ? weight : metric === 'bodyFat' ? bodyFat : height;

    const handleIncrement = (amount: number) => {
      if (metric === 'weight') {
        setWeight((prev) => Math.round((prev + amount) * 10) / 10);
      } else if (metric === 'bodyFat') {
        setBodyFat((prev) => Math.round((prev + amount) * 10) / 10);
      } else {
        setHeight((prev) => Math.round((prev + amount) * 10) / 10);
      }
    };

    const handleDecrement = () => {
      if (metric === 'weight') {
        setWeight((prev) => Math.max(0, Math.round((prev - config.step) * 10) / 10));
      } else if (metric === 'bodyFat') {
        setBodyFat((prev) => Math.max(0, Math.round((prev - config.step) * 10) / 10));
      } else {
        setHeight((prev) => Math.max(0, Math.round((prev - config.step) * 10) / 10));
      }
    };

    const handleIncrementAction = () => {
      if (metric === 'weight') {
        setWeight((prev) => Math.round((prev + config.step) * 10) / 10);
      } else if (metric === 'bodyFat') {
        setBodyFat((prev) => Math.round((prev + config.step) * 10) / 10);
      } else {
        setHeight((prev) => Math.round((prev + config.step) * 10) / 10);
      }
    };

    return (
      <View className="p-6">
        {/* Metric Input Section */}
        <View>
          <Text className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-text-secondary">
            {config.label} ({config.unit})
          </Text>

          {/* Stepper Controls */}
          <View
            className="mb-6 flex-row items-center justify-between"
            style={{ maxWidth: 280, width: '100%', alignSelf: 'center' }}>
            <Pressable
              onPress={handleDecrement}
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: theme.colors.background.cardElevated,
                borderColor: theme.colors.background.white10,
                borderWidth: 1,
              }}>
              <Minus size={theme.iconSize.xl} color={theme.colors.text.primary} />
            </Pressable>

            <View className="flex-1 items-center">
              <Text className="text-center text-6xl font-extrabold text-text-primary">
                {config.step < 1 ? value.toFixed(1) : Math.round(value)}
              </Text>
            </View>

            <Pressable
              onPress={handleIncrementAction}
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: theme.colors.background.cardElevated,
                borderColor: theme.colors.background.white10,
                borderWidth: 1,
              }}>
              <Plus size={theme.iconSize.xl} color={theme.colors.text.primary} />
            </Pressable>
          </View>

          {/* Quick Increment Buttons */}
          <View className="mb-6 flex-row justify-center gap-2">
            {config.quickIncrements.map((increment) => (
              <Pressable
                key={increment}
                onPress={() => handleIncrement(increment)}
                className="rounded-full border px-3 py-1"
                style={{
                  backgroundColor: theme.colors.accent.primary10,
                  borderColor: theme.colors.accent.primary20,
                }}>
                <Text className="text-[10px] font-bold text-accent-primary">
                  +{increment % 1 === 0 ? increment : increment.toFixed(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View
          className="mb-6"
          style={{
            height: 1,
            backgroundColor: theme.colors.background.white5,
          }}
        />

        {/* Date and Time Sections */}
        <View className="space-y-3">
          <DateTimeSelectorCard
            type="date"
            value={selectedDate}
            onEdit={() => {}}
            label={t('bodyMetrics.addEntry.date')}
            formattedValue={formatDate(selectedDate)}
            noCard={true}
          />
          <DateTimeSelectorCard
            type="time"
            value={selectedTime}
            onEdit={() => {}}
            label={t('bodyMetrics.addEntry.time')}
            formattedValue={formatTime(selectedTime)}
            noCard={true}
          />
        </View>
      </View>
    );
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('bodyMetrics.addEntry.title')}
      scrollable={false}>
      <View className="flex-1">
        {/* Content */}
        <ScrollView className="flex-1 px-4 pb-12" showsVerticalScrollIndicator={false}>
          <View style={{ gap: 32 }}>
            {/* Metric Selector */}
            <SegmentedControl
              options={metricOptions}
              value={selectedMetric}
              onValueChange={handleMetricChange}
              variant="gradient"
            />

            {/* Metric Entry Group - Input, Date, and Time */}
            <GenericCard variant="card" size="default">
              <View style={{ overflow: 'hidden' }}>
                {/* Measure content height on first render */}
                <View
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  onLayout={(e) => {
                    if (!pagerHeight) {
                      const height = e.nativeEvent.layout.height;
                      setPagerHeight(height);
                    }
                  }}>
                  {renderMetricEntry(selectedMetric)}
                </View>
                <PagerView
                  ref={pagerRef}
                  style={{ height: pagerHeight || 400 }}
                  initialPage={metricToPageIndex[selectedMetric]}
                  onPageSelected={(e) => {
                    const pageIndex = e.nativeEvent.position;
                    handlePageChange(pageIndex);
                  }}
                  scrollEnabled={false}>
                  {/* Weight Page */}
                  <View key="weight">{renderMetricEntry('weight')}</View>
                  {/* Body Fat Page */}
                  <View key="bodyFat">{renderMetricEntry('bodyFat')}</View>
                  {/* Height Page */}
                  <View key="height">{renderMetricEntry('height')}</View>
                </PagerView>
              </View>
            </GenericCard>

            {/* Mood Slider Section */}
            <MoodSelectorCard value={mood} onChange={setMood} />
          </View>
        </ScrollView>

        {/* Save Button Footer */}
        <View
          className="border-t p-6 pb-10"
          style={{ borderColor: theme.colors.background.white5 }}>
          <Pressable
            onPress={handleSave}
            className="h-14 w-full items-center justify-center rounded-2xl active:scale-[0.98]"
            style={{
              shadowColor: theme.colors.accent.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 30,
              elevation: 8,
            }}>
            <LinearGradient
              colors={theme.colors.gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-full w-full flex-row items-center justify-center gap-2 rounded-2xl"
              style={{
                paddingVertical: 16,
              }}>
              <Text className="text-lg font-bold text-text-primary">
                {t('bodyMetrics.addEntry.saveEntry')}
              </Text>
              <CheckCircle size={theme.iconSize.lg} color={theme.colors.text.primary} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </FullScreenModal>
  );
}
