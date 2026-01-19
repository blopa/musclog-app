import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { X, Smile, CheckCircle, Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { SegmentedControl } from '../../components/theme/SegmentedControl';
import { GenericCard } from '../../components/cards/GenericCard';
import { Slider } from '../../components/theme/Slider';
import { DateTimeSelectorCard } from '../../components/DateTimeSelectorCard';
import { format } from 'date-fns';

type MetricType = 'weight' | 'bodyFat' | 'bmi' | 'ffmi';

export default function AddEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('weight');
  const [weight, setWeight] = useState(78.5);
  const [mood, setMood] = useState(3); // 0-4: Poor, Low, Okay, Good, Great
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());

  const metricOptions = [
    { label: t('bodyMetrics.metrics.weight'), value: 'weight' },
    { label: t('bodyMetrics.metrics.bodyFat'), value: 'bodyFat' },
    { label: t('bodyMetrics.metrics.bmi'), value: 'bmi' },
    { label: t('bodyMetrics.metrics.ffmi'), value: 'ffmi' },
  ];

  const quickIncrements = [0.5, 1.0, 5.0];

  const handleIncrement = (amount: number) => {
    setWeight((prev) => Math.round((prev + amount) * 10) / 10);
  };

  const handleDecrement = () => {
    setWeight((prev) => Math.max(0, Math.round((prev - 0.1) * 10) / 10));
  };

  const handleIncrementAction = () => {
    setWeight((prev) => Math.round((prev + 0.1) * 10) / 10);
  };

  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy');
  };

  const formatTime = (date: Date) => {
    return format(date, 'hh:mm a');
  };

  const handleSave = () => {
    // TODO: Save entry logic
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-4 pt-6">
          <Pressable
            onPress={() => router.back()}
            className="-ml-2 rounded-full p-2"
            style={{ backgroundColor: theme.colors.overlay.white5 }}>
            <X size={theme.iconSize.lg} color={theme.colors.text.primary} />
          </Pressable>
          <Text className="text-lg font-bold text-text-primary">
            {t('bodyMetrics.addEntry.title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-4 pb-12" showsVerticalScrollIndicator={false}>
          <View className="space-y-8">
            {/* Metric Selector */}
            <SegmentedControl
              options={metricOptions}
              value={selectedMetric}
              onValueChange={(value) => setSelectedMetric(value as MetricType)}
              variant="gradient"
            />

            {/* Weight Input Section */}
            <GenericCard variant="card" size="default">
              <View className="p-6">
                <Text className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-text-secondary">
                  {t('bodyMetrics.addEntry.enterWeight')} (kg)
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
                      {weight.toFixed(1)}
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
                <View className="flex-row justify-center gap-2">
                  {quickIncrements.map((increment) => (
                    <Pressable
                      key={increment}
                      onPress={() => handleIncrement(increment)}
                      className="rounded-full border px-3 py-1"
                      style={{
                        backgroundColor: theme.colors.accent.primary10,
                        borderColor: theme.colors.accent.primary20,
                      }}>
                      <Text className="text-[10px] font-bold text-accent-primary">
                        +{increment.toFixed(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </GenericCard>

            {/* Date and Time Sections */}
            <View className="space-y-3">
              <DateTimeSelectorCard
                type="date"
                value={selectedDate}
                onEdit={() => {}}
                label={t('bodyMetrics.addEntry.date')}
                formattedValue={formatDate(selectedDate)}
              />
              <DateTimeSelectorCard
                type="time"
                value={selectedTime}
                onEdit={() => {}}
                label={t('bodyMetrics.addEntry.time')}
                formattedValue={formatTime(selectedTime)}
              />
            </View>

            {/* Mood Slider Section */}
            <GenericCard variant="card" size="default">
              <View className="p-4">
                <View className="mb-6 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Smile size={theme.iconSize.xl} color={theme.colors.text.tertiary} />
                    <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {t('bodyMetrics.addEntry.moodQuestion')}
                    </Text>
                  </View>
                  <View
                    className="rounded px-2 py-0.5"
                    style={{ backgroundColor: theme.colors.accent.primary10 }}>
                    <Text className="text-xs font-bold text-accent-primary">
                      {t(`bodyMetrics.addEntry.moods.${mood}`)}
                    </Text>
                  </View>
                </View>

                {/* Slider */}
                <View className="relative px-2">
                  <Slider
                    value={mood}
                    min={0}
                    max={4}
                    step={1}
                    onChange={setMood}
                    variant="solid"
                    trackColor={theme.colors.background.cardElevated}
                    solidColor={theme.colors.accent.primary}
                    thumbColor={theme.colors.accent.primary}
                    useGradient={false}
                  />

                  {/* Mood Labels */}
                  <View className="mt-4 flex-row justify-between px-1">
                    {[0, 1, 2, 3, 4].map((moodValue) => {
                      const isSelected = mood === moodValue;
                      const moodEmojis = ['😫', '😔', '😐', '😊', '🤩'];
                      return (
                        <View key={moodValue} className="flex-col items-center gap-1">
                          <Text className="text-xl">{moodEmojis[moodValue]}</Text>
                          <Text
                            className={`text-[10px] font-bold uppercase ${
                              isSelected ? 'text-accent-primary' : 'text-text-tertiary'
                            }`}
                            style={{ opacity: isSelected ? 1 : 0.4 }}>
                            {t(`bodyMetrics.addEntry.moods.${moodValue}`)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </GenericCard>
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
    </SafeAreaView>
  );
}
