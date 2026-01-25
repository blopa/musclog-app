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
    <Text className="text-[10px] font-bold uppercase" style={{ color }}>
      {label}
    </Text>
    <Text className="text-sm font-bold" style={{ color: theme.colors.text.gray300 }}>
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
            className="h-24 w-24 overflow-hidden rounded-lg"
            style={{ backgroundColor: theme.colors.background.separatorLight }}
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
            <Text className="text-[10px] font-black" style={{ color: theme.colors.text.black }}>
              {calories} {t('food.common.kcal')}
            </Text>
          </View>
        </View>
        <View className="flex-1 justify-between">
          <View>
            <Text
              className="mb-0.5 text-base font-bold"
              style={{ color: theme.colors.text.gray300 }}
            >
              {title}
            </Text>
            <Text className="text-xs font-medium" style={{ color: theme.colors.text.gray500 }}>
              {tags.join(' • ')}
            </Text>
          </View>
          <View className="flex-row items-end justify-between">
            <View className="flex-row items-center gap-x-3">
              <Macro label={t('food.macros.proteinLegend')} value={macros.protein} color={theme.colors.status.red400} />
              <View
                className="h-5 w-[1px]"
                style={{ backgroundColor: theme.colors.border.gray600 }}
              />
              <Macro label={t('food.macros.carbsLegend')} value={macros.carbs} color={theme.colors.status.teal400} />
              <View
                className="h-5 w-[1px]"
                style={{ backgroundColor: theme.colors.border.gray600 }}
              />
              <Macro label={t('food.macros.fatLegend')} value={macros.fat} color={theme.colors.status.amber} />
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
