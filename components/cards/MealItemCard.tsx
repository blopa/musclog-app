import React from 'react';
import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type MacroProps = {
  label: string;
  value: string;
  color: string;
};

const Macro = ({ label, value, color }: MacroProps) => (
  <View className="gap-0.5">
    <Text
      style={{
        fontSize: theme.typography.fontSize['10'],
        fontWeight: theme.typography.fontWeight.bold,
        color,
        textTransform: 'uppercase',
      }}>
      {label}
    </Text>
    <Text
      style={{
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
      }}>
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
  image: ImageSourcePropType;
  onTrackPress?: () => void;
};

export function MealItemCard({
  title,
  tags,
  calories,
  macros,
  image,
  onTrackPress,
}: MealItemCardProps) {
  const { t } = useTranslation();
  return (
    <GenericCard variant="highlighted">
      <View
        style={{
          flexDirection: 'row',
          padding: theme.spacing.padding.md,
          gap: theme.spacing.gap.base,
        }}>
        {/* Image Container */}
        <View style={{ position: 'relative' }}>
          <View
            style={{
              width: theme.size['100'],
              height: theme.size['100'],
              borderRadius: theme.borderRadius.lg,
              overflow: 'hidden',
              backgroundColor: theme.colors.background.cardDark,
            }}>
            <Image source={image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          {/* Calories Badge */}
          <View
            style={{
              position: 'absolute',
              bottom: theme.offset.badge,
              right: theme.offset.badge,
              backgroundColor: theme.colors.accent.primary,
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding.xs,
              borderRadius: theme.borderRadius.full,
              borderWidth: theme.borderWidth.medium,
              borderColor: theme.colors.background.card,
            }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize['10'],
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.black,
              }}>
              {calories} {t('common.kcal')}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View>
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
                marginBottom: theme.spacing.padding.xs,
              }}>
              {title}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.accent,
                fontWeight: theme.typography.fontWeight.medium,
              }}>
              {tags.join(' • ')}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.gap.md }}>
              <Macro
                label={t('food.macros.proteinLegend')}
                value={macros.protein}
                color={theme.colors.macros.protein.text}
              />
              <View
                style={{
                  width: theme.borderWidth.thin,
                  height: theme.size['20'],
                  backgroundColor: theme.colors.border.light,
                  alignSelf: 'center',
                }}
              />
              <Macro
                label={t('food.macros.carbsLegend')}
                value={macros.carbs}
                color={theme.colors.macros.carbs.text}
              />
              <View
                style={{
                  width: theme.borderWidth.thin,
                  height: theme.size['20'],
                  backgroundColor: theme.colors.border.light,
                  alignSelf: 'center',
                }}
              />
              <Macro
                label={t('food.macros.fatLegend')}
                value={macros.fat}
                color={theme.colors.macros.fat.text}
              />
            </View>

            <Pressable
              onPress={onTrackPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.accent.primary10,
                paddingHorizontal: theme.spacing.padding.md,
                paddingVertical: theme.spacing.padding['1half'],
                borderRadius: theme.borderRadius.full,
                gap: theme.spacing.gap.xs,
                opacity: pressed ? theme.colors.opacity.medium70 : theme.colors.opacity.full,
              })}>
              <Plus
                size={theme.iconSize.xs}
                color={theme.colors.accent.primary}
                strokeWidth={theme.strokeWidth.thick}
              />
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.accent.primary,
                }}>
                {t('mealItemCard.track')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
