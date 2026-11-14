import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Text, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import { GenericCard } from './GenericCard';

type MacroProps = {
  label: string;
  value: string;
  color: string;
  intuitiveMode?: boolean;
  /** A hairline on the left, separating it from the macro before it. */
  divided?: boolean;
};

const Macro = ({ label, value, color, intuitiveMode = false, divided = false }: MacroProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      className={divided ? 'ml-3 flex-col gap-y-0.5 border-l pl-3' : 'flex-col gap-y-0.5'}
      style={divided ? { borderLeftColor: theme.colors.border.subtle } : undefined}
    >
      <Text className="font-bold" style={{ color, fontSize: theme.typography.fontSize.xs }}>
        {label}
      </Text>
      <Text
        className="font-bold"
        style={[
          { color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm },
          intuitiveMode ? blurFilter(4) : undefined,
        ]}
      >
        {intuitiveMode ? t('common.weightFormatG', { value: 0 }) : value}
      </Text>
    </View>
  );
};

type MealItemCardProps = {
  title: string;
  tags: string[];
  calories: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  /** optional image source (local require or remote uri) */
  image?: ImageSourcePropType;
  onMenuPress: () => void;
};

export function MealItemCard({
  title,
  tags,
  calories,
  macros,
  image,
  onMenuPress,
}: MealItemCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { intuitiveEatingMode } = useSettings();
  const { toDisplay, unitLabel } = useEnergyUnit();
  return (
    <GenericCard variant="flat">
      <View className="flex-row gap-x-4 p-4">
        <View className="relative">
          <View
            className="overflow-hidden rounded-control"
            style={{
              backgroundColor: theme.colors.background.separatorLight,
              height: theme.size[24],
              width: theme.size[24],
            }}
          >
            <Image source={image} className="h-full w-full" />
          </View>
          <View
            className="absolute rounded-tag px-2 py-1"
            style={{
              bottom: theme.offset.badge,
              right: theme.offset.badge,
              borderWidth: theme.borderWidth.medium,
              borderColor: theme.colors.background.separatorLight,
              backgroundColor: theme.colors.accent.primary,
            }}
          >
            <Text
              className="font-bold"
              style={[
                { color: theme.colors.text.onAccent, fontSize: theme.typography.fontSize.xs },
                intuitiveEatingMode ? blurFilter(4) : undefined,
              ]}
            >
              {intuitiveEatingMode ? '0' : formatRoundedDecimal(toDisplay(calories), 2)} {unitLabel}
            </Text>
          </View>
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-x-1">
            <View className="min-w-0 flex-1">
              <Text
                className="mb-0.5 font-bold"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.base,
                }}
              >
                {title}
              </Text>
              <Text
                className="font-medium"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {tags.join(' • ')}
              </Text>
            </View>
            <MenuButton size="sm" onPress={onMenuPress} color={theme.colors.text.secondary} />
          </View>
          {/* Wraps when the three do not fit beside the picture (large text, two-decimal values)
              instead of running the last one out of the card. */}
          <View className="flex-row flex-wrap gap-y-1 pt-2">
            <Macro
              label={t('food.macros.proteinLegend')}
              value={macros.protein}
              color={theme.colors.status.errorLight}
              intuitiveMode={intuitiveEatingMode}
            />
            <Macro
              label={t('food.macros.carbsLegend')}
              value={macros.carbs}
              color={theme.colors.status.brandPale}
              intuitiveMode={intuitiveEatingMode}
              divided
            />
            <Macro
              label={t('food.macros.fatLegend')}
              value={macros.fat}
              color={theme.colors.status.amber}
              intuitiveMode={intuitiveEatingMode}
              divided
            />
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
