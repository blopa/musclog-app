import { format, isToday, isYesterday } from 'date-fns';
import { TFunction } from 'i18next';
import { Clock, Layers, LucideScale, Tag, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { FoodNutritionSectionCard } from '@/components/cards/FoodNutritionSectionCard';
import { GenericCard } from '@/components/cards/GenericCard';
import type { MealType } from '@/database/models';
import type { FoodLabels } from '@/database/models/Food';
import Food from '@/database/models/Food';
import NutritionLog from '@/database/models/NutritionLog';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import i18n from '@/lang/lang';
import { formatDisplayGrams } from '@/utils/formatDisplayWeight';
import { getMassUnitLabel } from '@/utils/unitConversion';

import { FullScreenModal } from './FullScreenModal';

type LogEntry = {
  log: NutritionLog;
  food: Food | null;
  nutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    alcohol: number;
  };
  gramWeight: number;
  displayName: string;
  mealType: MealType;
};

type FoodMealDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  entry: LogEntry | null;
};

function getMealTypeLabel(mealType: MealType, t: TFunction): string {
  switch (mealType) {
    case 'breakfast':
      return t('food.meals.breakfast');
    case 'lunch':
      return t('food.meals.lunch');
    case 'dinner':
      return t('food.meals.dinner');
    case 'snack':
      return t('food.meals.snack');
    default:
      return t('food.meals.other');
  }
}

function formatLogDateTime(createdAt: number, t: ReturnType<typeof useTranslation>['t']): string {
  const date = new Date(createdAt);
  const timeStr = format(date, 'h:mm a');
  if (isToday(date)) {
    return `${t('food.header.today')}, ${timeStr}`;
  }
  if (isYesterday(date)) {
    return `${t('common.yesterday')}, ${timeStr}`;
  }
  return `${format(date, 'MMM d')}, ${timeStr}`;
}

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
];

function ScoreCard({ label, score }: { label: string; score: string }) {
  const theme = useTheme();
  const normalized = score.toLowerCase();
  const colors = GRADE_COLORS[normalized] ?? { bg: '#6B8070', text: '#ffffff' };

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

      <View className="flex-1 flex-row flex-wrap gap-2">
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
      </View>
    </View>
  );
}

export function FoodMealDetailsModal({ visible, onClose, entry }: FoodMealDetailsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units, intuitiveEatingMode } = useSettings();

  if (!entry) {
    return null;
  }

  const { log, food, nutrients, gramWeight, displayName, mealType } = entry;

  const scale = gramWeight > 0 ? 100 / gramWeight : 1;
  const per100gCalories = food ? food.calories : nutrients.calories * scale;
  const per100gProtein = food ? food.protein : nutrients.protein * scale;
  const per100gCarbs = food ? food.carbs : nutrients.carbs * scale;
  const per100gFat = food ? food.fat : nutrients.fat * scale;
  const per100gFiber = food ? food.fiber : nutrients.fiber * scale;

  const micros = food?.micros ?? {};

  const foodData = {
    name: displayName,
    category: food?.brand ?? getMealTypeLabel(mealType, t),
    calories: per100gCalories,
    protein: per100gProtein,
    carbs: per100gCarbs,
    fat: per100gFat,
    source: food?.source as 'openfood' | 'usda' | 'local' | 'ai' | 'musclog' | undefined,
  };

  const nutritionalData = {
    fiber: per100gFiber,
    sugar: micros.sugar,
    saturatedFat: micros.saturatedFat ?? 0,
    sodium: micros.sodium ?? 0,
    alcohol: micros.alcohol,
    potassium: micros.potassium,
    magnesium: micros.magnesium,
    zinc: micros.zinc,
  };

  const massUnit = getMassUnitLabel(units);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formattedGrams = formatDisplayGrams(locale, units, gramWeight);
  const dateTimeLabel = formatLogDateTime(log.createdAt, t);

  const nutriScore = log.loggedNutriscore || food?.nutriscore;
  const ecoScore = log.loggedEcoscore || food?.ecoscore;
  const novaGroup = log.loggedNovaGroup ?? food?.novaGroup;
  const foodLabels = food?.labels ?? {};
  const activeLabels = LABEL_KEYS.filter(({ key }) => foodLabels[key] === true);

  const novaDescriptions: Record<number, string> = {
    1: t('food.logDetails.nova1'),
    2: t('food.logDetails.nova2'),
    3: t('food.logDetails.nova3'),
    4: t('food.logDetails.nova4'),
  };

  const hasScores = !!nutriScore || !!ecoScore;
  const hasQualityData = hasScores || novaGroup != null || activeLabels.length > 0;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('food.logDetails.title')}
      scrollable={false}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: theme.spacing.padding.base, paddingBottom: 40 }}
      >
        <GenericCard variant="highlighted" backgroundVariant="gradient">
          <View className="p-5">
            <Text className="mb-5 text-2xl font-bold text-text-primary">{displayName}</Text>

            <View className="mb-4 flex-row gap-4">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {t('food.logDetails.mealType')}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Utensils size={theme.iconSize.md} color={theme.colors.text.primary} />
                  <Text className="text-xl font-bold text-text-primary">
                    {getMealTypeLabel(mealType, t)}
                  </Text>
                </View>
              </View>

              <View
                className="w-px self-stretch"
                style={{ backgroundColor: theme.colors.border.light }}
              />

              <View className="flex-1">
                <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {t('food.foodDetails.portionSize')}
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <LucideScale size={theme.iconSize.md} color={theme.colors.text.primary} />
                  <Text className="text-xl font-bold text-text-primary">{formattedGrams}</Text>
                  <Text className="text-sm text-text-secondary">{massUnit}</Text>
                </View>
              </View>
            </View>

            <View>
              <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                {t('food.logDetails.dateAndTime')}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-semibold text-text-primary">{dateTimeLabel}</Text>
                <Clock size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </View>
            </View>
          </View>
        </GenericCard>

        {hasQualityData ? (
          <View className="mt-3 gap-3">
            {hasScores ? (
              <View className="flex-row gap-3">
                {nutriScore ? (
                  <ScoreCard label={t('food.logDetails.nutriScore')} score={nutriScore} />
                ) : null}
                {ecoScore ? (
                  <ScoreCard label={t('food.logDetails.ecoScore')} score={ecoScore} />
                ) : null}
              </View>
            ) : null}

            {novaGroup != null ? (
              <NovaRow
                group={novaGroup}
                description={novaDescriptions[novaGroup] ?? String(novaGroup)}
              />
            ) : null}

            {activeLabels.length > 0 ? <LabelsRow activeLabels={activeLabels} /> : null}
          </View>
        ) : null}

        <FoodNutritionSectionCard
          food={foodData}
          canEdit={false}
          mode="foodLog"
          nutritionalData={nutritionalData}
          servingSize={gramWeight}
          servingBasis="per_100g"
          isLoadingDetails={false}
          intuitiveMode={intuitiveEatingMode}
          showName={false}
        />
      </ScrollView>
    </FullScreenModal>
  );
}
