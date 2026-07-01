import { Layers, Tag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView as RNScrollView, Text, View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';

import type { FoodLabels } from '@/database/models/Food';
import { useTheme } from '@/hooks/useTheme';

import {
  hasNutritionQualityData,
  normalizeNutritionQualityScore,
  type NutritionQualityInput,
  type NutritionQualityScore,
} from './nutritionQuality';

type NutritionQualityDataProps = {
  nutriScore?: NutritionQualityInput['nutriScore'];
  ecoScore?: NutritionQualityInput['ecoScore'];
  novaGroup?: number;
  labels?: NutritionQualityInput['labels'];
};

// iOS: RNGH ScrollView fights SwipeToReturnWrapper's pan gesture; RN's native UIScrollView wins correctly.
const ScrollView = Platform.OS === 'ios' ? RNScrollView : GHScrollView;

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  a: { bg: '#038141', text: '#ffffff' },
  b: { bg: '#85BB2F', text: '#ffffff' },
  c: { bg: '#FECB02', text: '#1a1a1a' },
  d: { bg: '#EE8100', text: '#ffffff' },
  e: { bg: '#E63312', text: '#ffffff' },
};

const NOVA_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#038141', text: '#ffffff' },
  2: { bg: '#85BB2F', text: '#ffffff' },
  3: { bg: '#EE8100', text: '#ffffff' },
  4: { bg: '#E63312', text: '#ffffff' },
};

const LABEL_KEYS: { key: keyof FoodLabels; translationKey: string }[] = [
  { key: 'organic', translationKey: 'food.logDetails.labelOrganic' },
  { key: 'vegan', translationKey: 'food.logDetails.labelVegan' },
  { key: 'vegetarian', translationKey: 'food.logDetails.labelVegetarian' },
  { key: 'palmOilFree', translationKey: 'food.logDetails.labelPalmOilFree' },
  { key: 'fairTrade', translationKey: 'food.logDetails.labelFairTrade' },
  { key: 'highProtein', translationKey: 'food.logDetails.labelHighProtein' },
  { key: 'highFiber', translationKey: 'food.logDetails.labelHighFiber' },
];

function ScoreCard({ label, score }: { label: string; score: NutritionQualityScore }) {
  const theme = useTheme();
  const colors = GRADE_COLORS[score.toLowerCase()] ?? { bg: '#6B8070', text: '#ffffff' };

  return (
    <View
      className="flex-1 items-center rounded-2xl py-4"
      style={{
        backgroundColor: theme.colors.background.cardElevated,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.background.white5,
      }}
    >
      <Text className="mb-4 text-xs font-bold uppercase tracking-wider text-text-secondary">
        {label}
      </Text>
      <View
        style={{
          backgroundColor: colors.bg,
          width: 68,
          height: 68,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.bg,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.55,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 38, lineHeight: 44 }}>
          {score.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function NovaRow({ group, description }: { group: number; description: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const colors = NOVA_COLORS[group] ?? { bg: '#6B8070', text: '#ffffff' };

  return (
    <View
      className="flex-row items-center gap-3 rounded-3xl px-4 py-3"
      style={{
        backgroundColor: theme.colors.background.cardElevated,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.background.white5,
      }}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
      >
        <Layers size={18} color={theme.colors.text.secondary} />
      </View>

      <Text
        className="text-xs font-bold uppercase leading-tight text-text-secondary"
        style={{ maxWidth: 48 }}
      >
        {t('food.logDetails.novaGroup').replace(' ', '\n')}
      </Text>

      <View
        style={{
          backgroundColor: colors.bg,
          width: 40,
          height: 40,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.bg,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.5,
          shadowRadius: 5,
          elevation: 4,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, lineHeight: 24 }}>
          {group}
        </Text>
      </View>

      <Text className="flex-1 text-base font-medium text-text-primary" numberOfLines={2}>
        {description}
      </Text>
    </View>
  );
}

function LabelsRow({ activeLabels }: { activeLabels: typeof LABEL_KEYS }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      className="flex-row items-center gap-3 rounded-3xl px-4 py-3"
      style={{
        backgroundColor: theme.colors.background.cardElevated,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.background.white5,
      }}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
      >
        <Tag size={18} color={theme.colors.text.secondary} />
      </View>

      <Text className="text-xs font-bold uppercase text-text-secondary">
        {t('food.logDetails.foodLabels')}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ gap: 8 }}
      >
        {activeLabels.map(({ translationKey }) => (
          <View
            key={translationKey}
            className="rounded-full px-3 py-1"
            style={{
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.status.emerald,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: theme.colors.status.emerald }}>
              {t(translationKey)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function NutritionQualityData({
  nutriScore,
  ecoScore,
  novaGroup,
  labels,
}: NutritionQualityDataProps) {
  const { t } = useTranslation();

  const normalizedNutriScore = normalizeNutritionQualityScore(nutriScore);
  const normalizedEcoScore = normalizeNutritionQualityScore(ecoScore);
  const activeLabels = LABEL_KEYS.filter(({ key }) => labels?.[key] === true);
  const hasScores = normalizedNutriScore != null || normalizedEcoScore != null;
  const hasData = hasNutritionQualityData({
    nutriScore,
    ecoScore,
    novaGroup,
    labels,
  });

  if (!hasData) {
    return null;
  }

  const novaDescriptions: Record<number, string> = {
    1: t('food.logDetails.nova1'),
    2: t('food.logDetails.nova2'),
    3: t('food.logDetails.nova3'),
    4: t('food.logDetails.nova4'),
  };

  return (
    <View className="mt-3 gap-3">
      {hasScores ? (
        <View className="flex-row gap-3">
          {normalizedNutriScore ? (
            <ScoreCard label={t('food.logDetails.nutriScore')} score={normalizedNutriScore} />
          ) : null}
          {normalizedEcoScore ? (
            <ScoreCard label={t('food.logDetails.ecoScore')} score={normalizedEcoScore} />
          ) : null}
        </View>
      ) : null}

      {novaGroup != null ? (
        <NovaRow group={novaGroup} description={novaDescriptions[novaGroup] ?? String(novaGroup)} />
      ) : null}

      {activeLabels.length > 0 ? <LabelsRow activeLabels={activeLabels} /> : null}
    </View>
  );
}
