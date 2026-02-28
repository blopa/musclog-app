import { Minus, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useFoodPortions } from '../hooks/useFoodPortions';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { displayToGrams, getMassUnitLabel, gramsToDisplay } from '../utils/unitConversion';

type ServingSizeSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  quickSizes?: { label: string; value: number }[];
};

const STEP_GRAMS = 10;
const STEP_OZ = 0.5;

export function ServingSizeSelector({ value, onChange, quickSizes }: ServingSizeSelectorProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();

  // value is always in grams (from parent). Display in g or oz based on units.
  const displayValue = gramsToDisplay(value, units);
  const massUnit = getMassUnitLabel(units);
  const stepAmount = units === 'imperial' ? displayToGrams(STEP_OZ, units) : STEP_GRAMS;

  // Load food portions from database
  const { portions, isLoading } = useFoodPortions({
    mode: 'all',
  });

  // Transform database portions to quick sizes format (label in display unit, value stays in grams)
  const databaseQuickSizes = useMemo(() => {
    return portions.map((portion) => {
      const display = gramsToDisplay(portion.gramWeight, units);
      const labelVal = display % 1 === 0 ? display : Math.round(display * 10) / 10;
      return {
        label: `${portion.name} (${labelVal} ${massUnit})`, // TODO: use i18n
        value: portion.gramWeight,
      };
    });
  }, [portions, units, massUnit]);

  const effectiveQuickSizes = quickSizes || databaseQuickSizes;

  const handleDecrease = () => {
    onChange(Math.max(0, value - stepAmount));
  };

  const handleIncrease = () => {
    onChange(value + stepAmount);
  };

  const handleTextChange = (text: string) => {
    const parsed = parseFloat(text) || 0;
    onChange(displayToGrams(parsed, units));
  };

  return (
    <View className="mt-6 w-full">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {t('food.foodDetails.servingSize')}
        </Text>
      </View>
      <View
        className="rounded-xl border bg-bg-cardDark p-2"
        style={{ borderColor: theme.colors.background.white10 }}
      >
        <View className="mb-4 flex-row items-center gap-3">
          <Pressable
            className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-bg-overlay"
            style={{ borderColor: theme.colors.background.white5 }}
            onPress={handleDecrease}
          >
            <Minus size={theme.iconSize.md} color={theme.colors.text.secondary} />
          </Pressable>
          <View className="flex-1 items-center justify-center py-1" style={{ minWidth: 0 }}>
            <View className="relative flex-row items-baseline justify-center">
              <TextInput
                className="bg-transparent p-0 text-center text-4xl font-black text-text-primary"
                style={{
                  color: theme.colors.text.primary,
                  width: theme.size['30'],
                  maxWidth: '100%',
                }}
                value={String(
                  displayValue % 1 === 0 ? displayValue : Math.round(displayValue * 10) / 10
                )}
                onChangeText={handleTextChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.text.primary20}
                selectTextOnFocus={true}
              />
              <Text className="absolute -right-6 bottom-1.5 text-lg font-bold text-text-secondary">
                {massUnit}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-text-secondary">
              {massUnit === 'g' ? t('food.foodDetails.grams') : t('food.foodDetails.unitOz', 'oz')}
            </Text>
          </View>
          <Pressable
            className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent-primary/20 bg-accent-primary/10"
            onPress={handleIncrease}
          >
            <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
          className="flex-row gap-4 pb-2"
        >
          {effectiveQuickSizes.map((size) => (
            <Pressable
              key={size.label}
              className={`rounded-full border px-4 ${
                value === size.value
                  ? 'border-accent-primary/20 bg-accent-primary/10'
                  : 'bg-bg-overlay/50'
              }`}
              style={{
                paddingVertical: theme.spacing.padding['1half'],
                marginHorizontal: 4,
                borderColor:
                  value === size.value
                    ? theme.colors.accent.primary20
                    : theme.colors.background.white5,
              }}
              onPress={() => onChange(size.value)}
            >
              <Text
                className={`text-xs font-medium ${
                  value === size.value ? 'font-bold text-accent-primary' : 'text-text-secondary'
                }`}
              >
                {size.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
