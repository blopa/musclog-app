import { Ruler, Scale } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { type Gender } from '@/database/models';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import {
  formatLocalCalendarDayIso,
  getLocalCalendarYear,
  localCalendarDayDate,
} from '@/utils/calendarDate';
import { parseDobDisplayStringToPickerDate } from '@/utils/fitnessProfilePersistence';
import { cmToDisplay, displayToCm, displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { getHeightUnit, getWeightUnit } from '@/utils/units';

import { DatePickerInput } from './modals/DatePickerInput';
import { DatePickerModal } from './modals/DatePickerModal';
import { SegmentedControl } from './theme/SegmentedControl';
import { StepperInlineInput } from './theme/StepperInlineInput';
import { TextInput } from './theme/TextInput';

export type PhysicalStats = {
  dob: string;
  gender: Gender;
  weight: string;
  height: string;
  fatPercentage?: number;
  units: 'imperial' | 'metric';
};

type EditPhysicalStatsBodyProps = {
  initialData?: Partial<PhysicalStats>;
  units: 'imperial' | 'metric';
  onFormChange?: (data: PhysicalStats) => void;
  onUnitsChange?: (units: 'imperial' | 'metric') => void;
};

export function EditPhysicalStatsBody({
  initialData,
  units,
  onFormChange,
  onUnitsChange,
}: EditPhysicalStatsBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatDecimal } = useFormatAppNumber();
  const [dob, setDob] = useState(initialData?.dob ?? '');
  const [gender, setGender] = useState<Gender>(initialData?.gender ?? 'other');
  const [weight, setWeight] = useState(() =>
    formatDecimal(parseFloat(initialData?.weight || '0'), 2)
  );
  const [height, setHeight] = useState(initialData?.height ?? '0');
  const [fatPercentage, setFatPercentage] = useState<number | null>(
    initialData?.fatPercentage ?? null
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const prevUnitsRef = useRef<'imperial' | 'metric'>(units);

  useEffect(() => {
    const prevUnits = prevUnitsRef.current;
    if (prevUnits === units) {
      return;
    }
    prevUnitsRef.current = units;

    const weightNum = parseFloat(weight) || 0;
    const newWeight = kgToDisplay(displayToKg(weightNum, prevUnits), units);
    setWeight(formatDecimal(newWeight, 2));

    const heightNum = parseFloat(height) || 0;
    const newHeight = cmToDisplay(displayToCm(heightNum, prevUnits), units);
    setHeight(String(Math.round(newHeight * 100) / 100));
  }, [units]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateSelect = useCallback((date: Date) => {
    setDob(formatLocalCalendarDayIso(localCalendarDayDate(date)));
  }, []);

  useEffect(() => {
    onFormChange?.({
      dob,
      gender,
      weight,
      height,
      fatPercentage: fatPercentage ?? undefined,
      units,
    });
  }, [dob, gender, weight, height, fatPercentage, units, onFormChange]);

  return (
    <>
      <View className="gap-8 px-4 pb-6 pt-2">
        {/* Units */}
        <View className="gap-2">
          <Text className="ml-1 text-sm font-semibold text-text-tertiary">
            {t('editFitnessDetails.units')}
          </Text>
          <SegmentedControl
            options={[
              {
                label: t('editFitnessDetails.imperial'),
                value: 'imperial',
                icon: (
                  <Scale
                    size={theme.iconSize.md}
                    color={
                      units === 'imperial'
                        ? theme.colors.accent.primary
                        : theme.colors.text.tertiary
                    }
                  />
                ),
              },
              {
                label: t('editFitnessDetails.metric'),
                value: 'metric',
                icon: (
                  <Ruler
                    size={theme.iconSize.md}
                    color={
                      units === 'metric' ? theme.colors.accent.primary : theme.colors.text.tertiary
                    }
                  />
                ),
              },
            ]}
            value={units}
            onValueChange={(val) => onUnitsChange?.(val as 'imperial' | 'metric')}
          />
        </View>

        {/* Date of Birth */}
        <View className="gap-2">
          <Text className="ml-1 text-sm font-semibold text-text-tertiary">
            {t('editPersonalInfo.dateOfBirth')}
          </Text>
          <DatePickerInput
            hideLabel
            unset={!dob}
            unsetPlaceholder={t('editPersonalInfo.dateOfBirthPlaceholder')}
            selectedDate={parseDobDisplayStringToPickerDate(dob)}
            onPress={() => setIsDatePickerVisible(true)}
          />
        </View>

        {/* Gender */}
        <View className="gap-2">
          <Text className="ml-1 text-sm font-semibold text-text-tertiary">
            {t('editFitnessDetails.gender')}
          </Text>
          <SegmentedControl
            options={[
              { label: t('editFitnessDetails.male'), value: 'male' },
              { label: t('editFitnessDetails.female'), value: 'female' },
              { label: t('editFitnessDetails.other'), value: 'other' },
            ]}
            value={gender}
            onValueChange={(val) => setGender(val as Gender)}
          />
        </View>

        {/* Body Stats */}
        <View className="gap-4">
          <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
            {t('editFitnessDetails.bodyStats')}
          </Text>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <TextInput
                label={t('editFitnessDetails.currentWeight')}
                value={weight}
                onChangeText={setWeight}
                placeholder="0.0"
                keyboardType="numeric"
                selectTextOnFocus={true}
                icon={
                  <Text className="text-center text-sm font-medium text-text-tertiary">
                    {getWeightUnit(units)}
                  </Text>
                }
              />
            </View>
            <View className="flex-1">
              <TextInput
                label={t('editFitnessDetails.height')}
                value={height}
                onChangeText={(text) => {
                  const dotIndex = text.indexOf('.');
                  if (dotIndex !== -1 && text.length - dotIndex > 3) {
                    return;
                  }
                  setHeight(text);
                }}
                placeholder="0"
                keyboardType="numeric"
                selectTextOnFocus={true}
                icon={
                  <Text className="text-center text-sm font-medium text-text-tertiary">
                    {getHeightUnit(units)}
                  </Text>
                }
              />
            </View>
          </View>

          {/* Fat Percentage */}
          <View className="mt-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-text-secondary">
                {t('editFitnessDetails.fatPercentage')}
              </Text>
              {fatPercentage === null ? (
                <Pressable onPress={() => setFatPercentage(20)} className="active:opacity-70">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    {t('editFitnessDetails.fatPercentageNotSet')}
                  </Text>
                </Pressable>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={() => setFatPercentage(null)} className="active:opacity-70">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: theme.colors.text.tertiary }}
                    >
                      {t('common.clear')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
            {fatPercentage !== null ? (
              <View className="mt-3">
                <StepperInlineInput
                  label={t('editFitnessDetails.fatPercentage')}
                  value={fatPercentage}
                  maxFractionDigits={1}
                  onIncrement={() => setFatPercentage((prev) => Math.min(50, (prev ?? 20) + 0.5))}
                  onDecrement={() => setFatPercentage((prev) => Math.max(5, (prev ?? 20) - 0.5))}
                  onChangeValue={(value) => setFatPercentage(Math.min(50, Math.max(5, value)))}
                  unit="%"
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={parseDobDisplayStringToPickerDate(dob)}
        onDateSelect={handleDateSelect}
        minYear={1900}
        maxYear={getLocalCalendarYear(new Date())}
      />
    </>
  );
}
