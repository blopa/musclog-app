import { CheckCircle, Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { MoodSelectorCard } from '@/components/cards/MoodSelectorCard';
import { PagerView, type PagerViewRef } from '@/components/PagerView/PagerView';
import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { TextInput } from '@/components/theme/TextInput';
import { useSnackbar } from '@/context/SnackbarContext';
import { database } from '@/database';
import { encryptUserMetricFields } from '@/database/encryptionHelpers';
import UserMetric, { UserMetricType } from '@/database/models/UserMetric';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { captureException } from '@/utils/sentry';
import { cmToDisplay, displayToCm, displayToKg, kgToDisplay } from '@/utils/unitConversion';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

// UI metric type - subset of UserMetricType for this modal
type MetricType = Extract<UserMetricType, 'weight' | 'body_fat' | 'height'>;

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
  onSave?: () => void;
};

// Map metric types to page indices
const metricToPageIndex: Record<MetricType, number> = {
  weight: 0,
  body_fat: 1,
  height: 2,
};

const DEFAULT_WEIGHT_KG = 70;
const DEFAULT_HEIGHT_CM = 170;

export default function AddUserMetricEntryModal({
  visible,
  onClose,
  onSave: onSaveCallback,
}: AddUserMetricEntryModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { units } = useSettings();
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const pagerRef = useRef<PagerViewRef>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('weight');
  const [weight, setWeight] = useState(DEFAULT_WEIGHT_KG);
  const [bodyFat, setBodyFat] = useState(15.0);
  const [height, setHeight] = useState(DEFAULT_HEIGHT_CM);
  const [mood, setMood] = useState(3); // 0-4: Poor, Low, Okay, Good, Great
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDayDate(new Date()));
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [note, setNote] = useState('');
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [pagerHeight, setPagerHeight] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pageIndexToMetric: MetricType[] = ['weight', 'body_fat', 'height'];

  const metricOptions = [
    { label: t('bodyMetrics.metrics.weight'), value: 'weight' },
    { label: t('bodyMetrics.metrics.bodyFat'), value: 'body_fat' },
    { label: t('bodyMetrics.metrics.height'), value: 'height' },
  ];

  const metricConfigs: Record<MetricType, MetricConfig> = useMemo(() => {
    const weightDefault =
      units === 'imperial' ? kgToDisplay(DEFAULT_WEIGHT_KG, units) : DEFAULT_WEIGHT_KG;
    const heightDefault =
      units === 'imperial' ? cmToDisplay(DEFAULT_HEIGHT_CM, units) : DEFAULT_HEIGHT_CM;

    return {
      weight: {
        label: t('bodyMetrics.addEntry.enterWeight'),
        unit: units === 'imperial' ? 'lbs' : 'kg',
        defaultValue: weightDefault,
        quickIncrements: units === 'imperial' ? [1, 2, 10] : [0.5, 1.0, 5.0],
        step: units === 'imperial' ? 1 : 0.1,
      },
      body_fat: {
        label: t('bodyMetrics.addEntry.enterBodyFat'),
        unit: '%',
        defaultValue: 15.0,
        quickIncrements: [0.5, 1.0, 2.0],
        step: 0.1,
      },
      height: {
        label: t('bodyMetrics.addEntry.enterHeight'),
        unit: units === 'imperial' ? 'in' : 'cm',
        defaultValue: heightDefault,
        quickIncrements: units === 'imperial' ? [1, 2, 4] : [1, 5, 10],
        step: 1,
      },
    };
  }, [units, t]);

  // Reset weight/height to display-unit defaults when modal opens or units change
  useEffect(() => {
    if (visible) {
      setWeight(units === 'imperial' ? kgToDisplay(DEFAULT_WEIGHT_KG, units) : DEFAULT_WEIGHT_KG);
      setHeight(units === 'imperial' ? cmToDisplay(DEFAULT_HEIGHT_CM, units) : DEFAULT_HEIGHT_CM);
      setNote(''); // Reset note when modal opens
    }
  }, [visible, units]);

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

  const handleDateEdit = () => {
    setIsDatePickerVisible(true);
  };

  const handleTimeEdit = () => {
    setIsTimePickerVisible(true);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(localCalendarDayDate(date));
  };

  const handleTimeSelect = (time: Date) => {
    setSelectedTime(time);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const now = Date.now();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const dateTimestamp = localDayStartMs(selectedDate);

      const weightKg = displayToKg(weight, units);
      const heightCm = displayToCm(height, units);

      const [encWeight, encBodyFat, encHeight, encMood] = await Promise.all([
        encryptUserMetricFields({
          value: weightKg,
          unit: 'kg',
          date: dateTimestamp,
        }),
        encryptUserMetricFields({
          value: bodyFat,
          unit: '%',
          date: dateTimestamp,
        }),
        encryptUserMetricFields({
          value: heightCm,
          unit: 'cm',
          date: dateTimestamp,
        }),
        encryptUserMetricFields({
          value: mood,
          unit: '',
          date: dateTimestamp,
        }),
      ]);

      const noteText = note.trim() || undefined;

      await database.write(async () => {
        const weightMetric = await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'weight' as UserMetricType;
          metric.valueRaw = encWeight.value;
          metric.unitRaw = encWeight.unit;
          metric.date = dateTimestamp;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });

        const bodyFatMetric = await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'body_fat' as UserMetricType;
          metric.valueRaw = encBodyFat.value;
          metric.unitRaw = encBodyFat.unit;
          metric.date = dateTimestamp;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });

        const heightMetric = await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'height' as UserMetricType;
          metric.valueRaw = encHeight.value;
          metric.unitRaw = encHeight.unit;
          metric.date = dateTimestamp;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });

        const moodMetric = await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'mood' as UserMetricType;
          metric.valueRaw = encMood.value;
          metric.unitRaw = encMood.unit;
          metric.date = dateTimestamp;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });

        // TODO: do these need to be sequential?
        if (noteText) {
          await weightMetric.setNote(noteText);
          await bodyFatMetric.setNote(noteText);
          await heightMetric.setNote(noteText);
          await moodMetric.setNote(noteText);
        }
      });

      // Call onSave callback if provided
      if (onSaveCallback) {
        onSaveCallback();
      }

      onClose();
    } catch (error) {
      console.error('Error saving user metrics:', error);
      captureException(error, { data: { context: 'AddUserMetricEntryModal.handleSave' } });
      showSnackbar('error', t('bodyMetrics.addEntry.errorSaving'));
    } finally {
      setIsSaving(false);
    }
  };

  // Render full metric entry card content for a specific metric type
  const renderMetricEntry = (metric: MetricType) => {
    const config = metricConfigs[metric];
    const value = metric === 'weight' ? weight : metric === 'body_fat' ? bodyFat : height;

    const handleIncrement = (amount: number) => {
      if (metric === 'weight') {
        setWeight((prev) => Math.round((prev + amount) * 10) / 10);
      } else if (metric === 'body_fat') {
        setBodyFat((prev) => Math.round((prev + amount) * 10) / 10);
      } else {
        setHeight((prev) => Math.round((prev + amount) * 10) / 10);
      }
    };

    const handleDecrement = () => {
      if (metric === 'weight') {
        setWeight((prev) => Math.max(0, Math.round((prev - config.step) * 10) / 10));
      } else if (metric === 'body_fat') {
        setBodyFat((prev) => Math.max(0, Math.round((prev - config.step) * 10) / 10));
      } else {
        setHeight((prev) => Math.max(0, Math.round((prev - config.step) * 10) / 10));
      }
    };

    const handleIncrementAction = () => {
      if (metric === 'weight') {
        setWeight((prev) => Math.round((prev + config.step) * 10) / 10);
      } else if (metric === 'body_fat') {
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
            style={{
              maxWidth: theme.size['280'],
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <Pressable
              onPress={handleDecrement}
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: theme.colors.background.cardElevated,
                borderColor: theme.colors.background.white10,
                borderWidth: theme.borderWidth.thin,
              }}
            >
              <Minus size={theme.iconSize.xl} color={theme.colors.text.primary} />
            </Pressable>

            <View className="flex-1 items-center">
              <Text className="text-center text-6xl font-extrabold text-text-primary">
                {config.step < 1 ? formatDecimal(value, 1) : formatInteger(Math.round(value))}
              </Text>
            </View>

            <Pressable
              onPress={handleIncrementAction}
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: theme.colors.background.cardElevated,
                borderColor: theme.colors.background.white10,
                borderWidth: theme.borderWidth.thin,
              }}
            >
              <Plus size={theme.iconSize.xl} color={theme.colors.text.primary} />
            </Pressable>
          </View>

          {/* Quick Increment Buttons */}
          <View className="mb-6 flex-row justify-center" style={{ gap: theme.spacing.gap['2'] }}>
            {config.quickIncrements.map((increment) => (
              <Pressable
                key={increment}
                onPress={() => handleIncrement(increment)}
                className="rounded-full border px-3 py-1"
                style={{
                  backgroundColor: theme.colors.accent.primary10,
                  borderColor: theme.colors.accent.primary20,
                }}
              >
                <Text className="text-[10px] font-bold text-accent-primary">
                  +
                  {increment % 1 === 0
                    ? formatInteger(increment, { useGrouping: false })
                    : formatDecimal(increment, 1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View
          className="mb-6"
          style={{
            height: theme.borderWidth.thin,
            backgroundColor: theme.colors.background.white5,
          }}
        />

        {/* Date and Time Sections */}
        <View className="pb-4">
          <View style={{ gap: theme.spacing.gap.base }}>
            <DatePickerInput
              selectedDate={selectedDate}
              onPress={handleDateEdit}
              label={t('bodyMetrics.addEntry.date')}
            />
            <TimePickerInput
              selectedTime={selectedTime}
              onPress={handleTimeEdit}
              label={t('bodyMetrics.addEntry.time')}
            />
          </View>

          {/* Note Section */}
          <View className="mt-3">
            <TextInput
              label={t('bodyMetrics.addEntry.note')}
              value={note}
              onChangeText={setNote}
              placeholder={t('bodyMetrics.addEntry.notePlaceholder')}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('bodyMetrics.addEntry.title')}
      scrollable={false}
      footer={
        <Button
          label={t('bodyMetrics.addEntry.saveEntry')}
          onPress={handleSave}
          icon={CheckCircle}
          iconPosition="right"
          variant="gradientCta"
          size="md"
          width="full"
          loading={isSaving}
          disabled={isSaving}
        />
      }
    >
      <View className="flex-1">
        {/* Content */}
        <ScrollView className="flex-1 px-4 pb-12" showsVerticalScrollIndicator={false}>
          <View className="h-4" />
          <View style={{ gap: theme.spacing.gap['2xl'] }}>
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
                  }}
                >
                  {renderMetricEntry(selectedMetric)}
                </View>
                <PagerView
                  ref={pagerRef}
                  style={{ height: pagerHeight || theme.size['480'] }}
                  initialPage={metricToPageIndex[selectedMetric]}
                  onPageSelected={(e) => {
                    const pageIndex = e.nativeEvent.position;
                    handlePageChange(pageIndex);
                  }}
                  scrollEnabled={true}
                  overdrag={false}
                >
                  {/* Weight Page */}
                  <View key="weight">{renderMetricEntry('weight')}</View>
                  {/* Body Fat Page */}
                  <View key="body_fat">{renderMetricEntry('body_fat')}</View>
                  {/* Height Page */}
                  <View key="height">{renderMetricEntry('height')}</View>
                </PagerView>
              </View>
            </GenericCard>

            {/* Mood Slider Section */}
            <MoodSelectorCard value={mood} onChange={setMood} />
          </View>
          <View style={{ height: theme.spacing.padding['3xl'] * 2 }} />
        </ScrollView>
      </View>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={isTimePickerVisible}
        onClose={() => setIsTimePickerVisible(false)}
        selectedTime={selectedTime}
        title={t('timePicker.selectTime')}
        onTimeSelect={handleTimeSelect}
      />
    </FullScreenModal>
  );
}
