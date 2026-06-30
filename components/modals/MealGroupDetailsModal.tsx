import { Droplet, EggFried, Flame, type LucideIcon, Wheat, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import Food from '@/database/models/Food';
import NutritionLog from '@/database/models/NutritionLog';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import i18n from '@/lang/lang';
import { formatDisplayGrams } from '@/utils/formatDisplayWeight';
import { getMassUnitLabel } from '@/utils/unitConversion';

import { FullScreenModal } from './FullScreenModal';

type GroupEntry = {
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
};

type MealGroupDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  mealName: string;
  entries: GroupEntry[];
  totalNutrients: { calories: number; protein: number; carbs: number; fat: number };
};

function MacroRow({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
}) {
  const theme = useTheme();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  return (
    <View className="flex-row items-center gap-2">
      <Icon size={14} color={theme.colors.text.secondary} />
      <Text className="flex-1 text-sm text-text-secondary">{label}</Text>
      <Text className="text-sm font-semibold text-text-primary">
        {unit === 'kcal'
          ? formatInteger(Math.round(value), { useGrouping: false })
          : formatRoundedDecimal(value, 1)}{' '}
        {unit}
      </Text>
    </View>
  );
}

export function MealGroupDetailsModal({
  visible,
  onClose,
  mealName,
  entries,
  totalNutrients,
}: MealGroupDetailsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units, intuitiveEatingMode } = useSettings();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const massUnit = getMassUnitLabel(units);

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={mealName} scrollable={false}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: theme.spacing.padding.base, paddingBottom: 40 }}
      >
        {/* Totals summary card */}
        <GenericCard variant="highlighted" backgroundVariant="gradient">
          <View className="p-5">
            <Text className="mb-4 text-xs font-medium uppercase tracking-wider text-text-secondary">
              {t('food.mealGroup.totalNutrients')}
            </Text>
            <View className="gap-2">
              <MacroRow
                icon={Flame}
                label={t('food.calories')}
                value={totalNutrients.calories}
                unit="kcal"
              />
              <MacroRow
                icon={Zap}
                label={t('food.macros.protein')}
                value={totalNutrients.protein}
                unit="g"
              />
              <MacroRow
                icon={Wheat}
                label={t('food.macros.carbs')}
                value={totalNutrients.carbs}
                unit="g"
              />
              <MacroRow
                icon={Droplet}
                label={t('food.macros.fat')}
                value={totalNutrients.fat}
                unit="g"
              />
            </View>
          </View>
        </GenericCard>

        {/* Individual food items */}
        <Text className="mb-3 mt-6 text-xs font-medium uppercase tracking-wider text-text-secondary">
          {t('food.mealGroup.ingredients')}
        </Text>

        <View className="gap-3">
          {entries.map((entry) => {
            const formattedGrams = formatDisplayGrams(locale, units, entry.gramWeight);

            return (
              <GenericCard key={entry.log.id} variant="default">
                <View className="flex-row items-center gap-3 p-4">
                  <View
                    className="h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: theme.colors.accent.primary10 }}
                  >
                    <EggFried size={18} color={theme.colors.accent.primary} />
                  </View>

                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                      {entry.displayName}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      {intuitiveEatingMode ? `— ${massUnit}` : `${formattedGrams} ${massUnit}`}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-sm font-semibold text-text-primary">
                      {intuitiveEatingMode
                        ? '—'
                        : formatInteger(Math.round(entry.nutrients.calories), {
                            useGrouping: false,
                          })}{' '}
                      kcal
                    </Text>
                    <Text className="text-xs text-text-secondary">
                      {intuitiveEatingMode
                        ? '—'
                        : `${formatRoundedDecimal(entry.nutrients.protein, 1)}g ${t('food.macros.proteinShort')}`}
                    </Text>
                  </View>
                </View>
              </GenericCard>
            );
          })}
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}
