import { useTranslation } from 'react-i18next';
import { Image, ImageSourcePropType, Text, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type MacroProps = {
  label: string;
  value: string;
  color: string;
};

const Macro = ({ label, value, color }: MacroProps) => {
  const theme = useTheme();

  return (
    <View className="flex-col gap-y-0.5">
      <Text
        className="font-bold uppercase"
        style={{ color, fontSize: theme.typography.fontSize.xs }}
      >
        {label}
      </Text>
      <Text
        className="font-bold"
        style={{ color: theme.colors.text.gray300, fontSize: theme.typography.fontSize.sm }}
      >
        {value}
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
  return (
    <GenericCard variant="default" containerStyle={{}}>
      <View className="flex-row gap-x-4 p-4">
        <View className="relative">
          <View
            className="overflow-hidden rounded-lg"
            style={{
              backgroundColor: theme.colors.background.separatorLight,
              height: theme.size[24],
              width: theme.size[24],
            }}
          >
            <Image source={image} className="h-full w-full" />
          </View>
          <View
            className="absolute rounded-full px-2 py-1"
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
              style={{
                color: theme.colors.text.black,
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              {formatRoundedDecimal(calories, 2)} {t('food.common.kcal')}
            </Text>
          </View>
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text
                className="mb-0.5 font-bold"
                style={{
                  color: theme.colors.text.gray300,
                  fontSize: theme.typography.fontSize.base,
                }}
              >
                {title}
              </Text>
              <Text
                className="font-medium"
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {tags.join(' • ')}
              </Text>
            </View>
            <MenuButton size="sm" onPress={onMenuPress} color={theme.colors.text.secondary} />
          </View>
          <View className="flex-row items-center gap-x-3 pt-2">
            <Macro
              label={t('food.macros.proteinLegend')}
              value={macros.protein}
              color={theme.colors.status.red400}
            />
            <View
              className="w-[1px]"
              style={{
                backgroundColor: theme.colors.border.gray600,
                height: theme.size[5],
              }}
            />
            <Macro
              label={t('food.macros.carbsLegend')}
              value={macros.carbs}
              color={theme.colors.status.teal400}
            />
            <View
              className="w-[1px]"
              style={{
                backgroundColor: theme.colors.border.gray600,
                height: theme.size[5],
              }}
            />
            <Macro
              label={t('food.macros.fatLegend')}
              value={macros.fat}
              color={theme.colors.status.amber}
            />
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
