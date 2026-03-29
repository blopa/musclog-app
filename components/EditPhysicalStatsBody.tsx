import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { type Gender } from '../database/models';
import { useFormatAppNumber } from '../hooks/useFormatAppNumber';
import { useTheme } from '../hooks/useTheme';
import { getHeightUnit, getWeightUnit } from '../utils/units';
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
};

type EditPhysicalStatsBodyProps = {
  initialData?: Partial<PhysicalStats>;
  units?: 'imperial' | 'metric';
  onFormChange?: (data: PhysicalStats) => void;
};

function parseDobToDate(dobString: string): Date {
  if (!dobString) {
    return new Date();
  }
  const parts = dobString.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
  }
  return new Date();
}

function formatDateToDob(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export function EditPhysicalStatsBody({
  initialData,
  units = 'metric',
  onFormChange,
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

  const handleDateSelect = useCallback((date: Date) => {
    setDob(formatDateToDob(date));
  }, []);

  useEffect(() => {
    onFormChange?.({
      dob,
      gender,
      weight,
      height,
      fatPercentage: fatPercentage ?? undefined,
    });
  }, [dob, gender, weight, height, fatPercentage, onFormChange]);

  return (
    <>
      <View className="gap-8 px-4 pb-6 pt-2">
        {/* Date of Birth */}
        <View className="gap-2">
          <Text className="ml-1 text-sm font-semibold text-text-tertiary">
            {t('editPersonalInfo.dateOfBirth')}
          </Text>
          <DatePickerInput
            hideLabel
            unset={!dob}
            unsetPlaceholder={t('editPersonalInfo.dateOfBirthPlaceholder')}
            selectedDate={parseDobToDate(dob)}
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
                onChangeText={setHeight}
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
        selectedDate={parseDobToDate(dob)}
        onDateSelect={handleDateSelect}
        minYear={1900}
        maxYear={new Date().getFullYear()}
      />
    </>
  );
}
