import {
  Apple,
  Battery,
  Beaker,
  Carrot,
  ChevronDown,
  Droplet,
  FlaskConical,
  Heart,
  IceCream,
  Pill,
  Shield,
  Sparkles,
  Stethoscope,
  Sun,
  TestTube,
  Thermometer,
  Waves,
  Wine,
  Zap,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { MicrosData } from '@/database/models/Food';
import { useTheme } from '@/hooks/useTheme';
import { formatAppRoundedDecimal } from '@/utils/formatAppNumber';
import {
  parseLocalizedDecimalString,
  sanitizeLocalizedDecimalInput,
} from '@/utils/localizedDecimalInput';

import { MacroInput } from './MacroInput';

export const MICRONUTRIENT_FORM_KEYS = [
  'sugar',
  'alcohol',
  'monoFat',
  'polyFat',
  'monounsaturatedFat',
  'saturatedFat',
  'transFat',
  'unsaturatedFat',
  'zinc',
  'vitaminK',
  'vitaminC',
  'vitaminB12',
  'vitaminA',
  'vitaminE',
  'thiamin',
  'selenium',
  'vitaminB6',
  'pantothenicAcid',
  'niacin',
  'calcium',
  'iodine',
  'molybdenum',
  'vitaminD',
  'manganese',
  'magnesium',
  'folicAcid',
  'copper',
  'iron',
  'chromium',
  'caffeine',
  'cholesterol',
  'phosphorus',
  'chloride',
  'folate',
  'biotin',
  'sodium',
  'riboflavin',
  'potassium',
] as const satisfies readonly (keyof MicrosData)[];

export type MicronutrientFormKey = (typeof MICRONUTRIENT_FORM_KEYS)[number];

export type MicronutrientFormStrings = Record<MicronutrientFormKey, string>;

export function createEmptyMicronutrientFormStrings(): MicronutrientFormStrings {
  return Object.fromEntries(
    MICRONUTRIENT_FORM_KEYS.map((k) => [k, ''])
  ) as MicronutrientFormStrings;
}

export function micronutrientFormStringsFromMicros(
  micros: MicrosData | undefined,
  locale: string
): MicronutrientFormStrings {
  const next = createEmptyMicronutrientFormStrings();
  if (!micros) {
    return next;
  }
  for (const key of MICRONUTRIENT_FORM_KEYS) {
    const v = micros[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      next[key] = formatAppRoundedDecimal(locale, v, 2);
    }
  }
  return next;
}

/** Parsed micronutrient overrides: only keys with non-empty trimmed input (cleared field = omit = fall back to base). */
export function parseMicronutrientFormStringsToPartial(
  form: MicronutrientFormStrings,
  decimalSeparator: ',' | '.'
): Partial<MicrosData> {
  const out: Partial<MicrosData> = {};
  for (const key of MICRONUTRIENT_FORM_KEYS) {
    const trimmed = form[key].trim();
    if (trimmed === '') {
      continue;
    }
    const n = parseLocalizedDecimalString(trimmed, decimalSeparator);
    if (Number.isFinite(n)) {
      out[key] = n;
    }
  }
  return out;
}

type MicronutrientsExpandableSectionProps = {
  microOpen: boolean;
  onToggleMicro: () => void;
  values: MicronutrientFormStrings;
  onMicronutrientChange: (key: MicronutrientFormKey, value: string) => void;
  decimalSeparator: ',' | '.';
};

export function MicronutrientsExpandableSection({
  microOpen,
  onToggleMicro,
  values,
  onMicronutrientChange,
  decimalSeparator,
}: MicronutrientsExpandableSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleMicronutrientChange = (key: MicronutrientFormKey, value: string) => {
    onMicronutrientChange(key, sanitizeLocalizedDecimalInput(value, decimalSeparator, 2));
  };

  const micronutrientsData = useMemo(
    () => [
      {
        key: 'sugar' as const,
        label: t('food.newCustomFood.sugar'),
        value: values.sugar,
        icon: IceCream,
        iconColor: theme.colors.status.pink500,
        variant: 'accent' as const,
      },
      {
        key: 'alcohol' as const,
        label: t('food.newCustomFood.alcohol'),
        value: values.alcohol,
        icon: Wine,
        iconColor: theme.colors.status.indigo,
        variant: 'info' as const,
      },
      {
        key: 'monoFat' as const,
        label: t('food.newCustomFood.monounsatFat'),
        value: values.monoFat,
        icon: Droplet,
        iconColor: theme.colors.status.teal400,
        variant: 'success' as const,
      },
      {
        key: 'polyFat' as const,
        label: t('food.newCustomFood.polyunsatFat'),
        value: values.polyFat,
        icon: Waves,
        iconColor: theme.colors.status.violet500,
        variant: 'warning' as const,
      },
      {
        key: 'monounsaturatedFat' as const,
        label: t('food.newCustomFood.monounsatFat'),
        value: values.monounsaturatedFat,
        icon: Droplet,
        iconColor: theme.colors.status.emerald,
        variant: 'success' as const,
      },
      {
        key: 'saturatedFat' as const,
        label: 'Saturated Fat',
        value: values.saturatedFat,
        icon: Heart,
        iconColor: theme.colors.status.red400,
        variant: 'error' as const,
      },
      {
        key: 'transFat' as const,
        label: 'Trans Fat',
        value: values.transFat,
        icon: Zap,
        iconColor: theme.colors.status.amber,
        variant: 'warning' as const,
      },
      {
        key: 'unsaturatedFat' as const,
        label: 'Unsaturated Fat',
        value: values.unsaturatedFat,
        icon: Waves,
        iconColor: theme.colors.status.teal400,
        variant: 'success' as const,
      },
      {
        key: 'zinc' as const,
        label: 'Zinc',
        value: values.zinc,
        icon: Shield,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'vitaminK' as const,
        label: 'Vitamin K',
        value: values.vitaminK,
        icon: Pill,
        iconColor: theme.colors.status.purple400,
        variant: 'accent' as const,
      },
      {
        key: 'vitaminC' as const,
        label: 'Vitamin C',
        value: values.vitaminC,
        icon: Sun,
        iconColor: theme.colors.status.amber,
        variant: 'warning' as const,
      },
      {
        key: 'vitaminB12' as const,
        label: 'Vitamin B12',
        value: values.vitaminB12,
        icon: Thermometer,
        iconColor: theme.colors.status.pink500,
        variant: 'accent' as const,
      },
      {
        key: 'vitaminA' as const,
        label: 'Vitamin A',
        value: values.vitaminA,
        icon: Carrot,
        iconColor: theme.colors.status.amber,
        variant: 'warning' as const,
      },
      {
        key: 'vitaminE' as const,
        label: 'Vitamin E',
        value: values.vitaminE,
        icon: Sparkles,
        iconColor: theme.colors.status.yellow,
        variant: 'warning' as const,
      },
      {
        key: 'thiamin' as const,
        label: 'Thiamin',
        value: values.thiamin,
        icon: Pill,
        iconColor: theme.colors.status.indigo,
        variant: 'info' as const,
      },
      {
        key: 'selenium' as const,
        label: 'Selenium',
        value: values.selenium,
        icon: Beaker,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'vitaminB6' as const,
        label: 'Vitamin B6',
        value: values.vitaminB6,
        icon: Thermometer,
        iconColor: theme.colors.status.purple400,
        variant: 'accent' as const,
      },
      {
        key: 'pantothenicAcid' as const,
        label: 'Pantothenic Acid',
        value: values.pantothenicAcid,
        icon: Apple,
        iconColor: theme.colors.status.teal400,
        variant: 'success' as const,
      },
      {
        key: 'niacin' as const,
        label: 'Niacin',
        value: values.niacin,
        icon: Pill,
        iconColor: theme.colors.status.indigo,
        variant: 'info' as const,
      },
      {
        key: 'calcium' as const,
        label: 'Calcium',
        value: values.calcium,
        icon: Battery,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'iodine' as const,
        label: 'Iodine',
        value: values.iodine,
        icon: TestTube,
        iconColor: theme.colors.status.purple400,
        variant: 'accent' as const,
      },
      {
        key: 'molybdenum' as const,
        label: 'Molybdenum',
        value: values.molybdenum,
        icon: Beaker,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'vitaminD' as const,
        label: 'Vitamin D',
        value: values.vitaminD,
        icon: Sun,
        iconColor: theme.colors.status.amber,
        variant: 'warning' as const,
      },
      {
        key: 'manganese' as const,
        label: 'Manganese',
        value: values.manganese,
        icon: Beaker,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'magnesium' as const,
        label: 'Magnesium',
        value: values.magnesium,
        icon: Battery,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'folicAcid' as const,
        label: 'Folic Acid',
        value: values.folicAcid,
        icon: Pill,
        iconColor: theme.colors.status.pink500,
        variant: 'accent' as const,
      },
      {
        key: 'copper' as const,
        label: 'Copper',
        value: values.copper,
        icon: Battery,
        iconColor: theme.colors.status.amber,
        variant: 'warning' as const,
      },
      {
        key: 'iron' as const,
        label: 'Iron',
        value: values.iron,
        icon: Battery,
        iconColor: theme.colors.status.red400,
        variant: 'error' as const,
      },
      {
        key: 'chromium' as const,
        label: 'Chromium',
        value: values.chromium,
        icon: Beaker,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'caffeine' as const,
        label: 'Caffeine',
        value: values.caffeine,
        icon: Zap,
        iconColor: theme.colors.status.amber,
        variant: 'warning' as const,
      },
      {
        key: 'cholesterol' as const,
        label: 'Cholesterol',
        value: values.cholesterol,
        icon: Heart,
        iconColor: theme.colors.status.red400,
        variant: 'error' as const,
      },
      {
        key: 'phosphorus' as const,
        label: 'Phosphorus',
        value: values.phosphorus,
        icon: Battery,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'chloride' as const,
        label: 'Chloride',
        value: values.chloride,
        icon: TestTube,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'folate' as const,
        label: 'Folate',
        value: values.folate,
        icon: Pill,
        iconColor: theme.colors.status.greenDark,
        variant: 'success' as const,
      },
      {
        key: 'biotin' as const,
        label: 'Biotin',
        value: values.biotin,
        icon: Stethoscope,
        iconColor: theme.colors.status.purple400,
        variant: 'accent' as const,
      },
      {
        key: 'sodium' as const,
        label: 'Sodium',
        value: values.sodium,
        icon: Battery,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
      {
        key: 'riboflavin' as const,
        label: 'Riboflavin',
        value: values.riboflavin,
        icon: Pill,
        iconColor: theme.colors.status.indigo,
        variant: 'info' as const,
      },
      {
        key: 'potassium' as const,
        label: 'Potassium',
        value: values.potassium,
        icon: Battery,
        iconColor: theme.colors.status.emeraldVeryLight,
        variant: 'default' as const,
      },
    ],
    [t, theme, values]
  );

  return (
    <View>
      <Pressable className="flex-row items-center justify-between py-4" onPress={onToggleMicro}>
        <View className="flex-row items-center gap-2">
          <FlaskConical size={theme.iconSize.lg} color={theme.colors.accent.primary} />
          <Text className="text-text-primary text-xl font-bold">
            {t('food.newCustomFood.micronutrients')}
          </Text>
        </View>
        <ChevronDown
          size={theme.iconSize.lg}
          color={theme.colors.text.tertiary}
          style={{
            transform: [{ rotate: microOpen ? '180deg' : '0deg' }],
          }}
        />
      </Pressable>

      {microOpen ? (
        <View className="flex-row flex-wrap gap-4">
          {micronutrientsData.map((nutrient) => (
            <MacroInput
              key={nutrient.key}
              label={nutrient.label}
              value={nutrient.value}
              onChange={(value: string) => handleMicronutrientChange(nutrient.key, value)}
              allowDecimals
              topRightElement={
                <nutrient.icon size={theme.iconSize.sm} color={nutrient.iconColor} />
              }
              variant={nutrient.variant}
              size="half"
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
