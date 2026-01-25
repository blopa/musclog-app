import React from 'react';
import { View, Text, Image } from 'react-native';
import { Button } from '../theme/Button';
import { GenericCard } from './GenericCard';
import { theme } from '../../theme';
import { useTranslation } from 'react-i18next';

type MacroProps = {
  label: string;
  value: string;
  color: string;
};

const Macro = ({ label, value, color }: MacroProps) => (
  <View className="flex-col gap-y-0.5">
    <Text className="font-bold uppercase" style={{ color, fontSize: theme.typography.fontSize.xs }}>
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

type MealItemCardProps = {
  title: string;
  tags: string[];
  calories: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  imageUrl?: string;
  onTrackPress: () => void;
};

export function MealItemCard({
  title,
  tags,
  calories,
  macros,
  imageUrl,
  onTrackPress,
}: MealItemCardProps) {
  const { t } = useTranslation();

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
            <Image
              source={{ uri: imageUrl }}
              className="h-full w-full"
            />
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
              {calories} {t('food.common.kcal')}
            </Text>
          </View>
        </View>
        <View className="flex-1 justify-between">
          <View>
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
          <View className="flex-row items-end justify-between">
            <View className="flex-row items-center gap-x-3">
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
            <Button
              label={t('food.actions.track')}
              onPress={onTrackPress}
              size="sm"
              width="auto"
              variant="accent"
            />
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
