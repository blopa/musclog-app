import { History, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import type { YesterdayMealData } from '@/hooks/useYesterdayMealData';
import { blurFilter } from '@/utils/blurFilter';

import { GenericCard } from './GenericCard';

type SameAsYesterdayCardProps = {
  yesterdayMealData: YesterdayMealData;
  mealLabel: string;
  onAddAllPress: () => void;
};

export function SameAsYesterdayCard({
  yesterdayMealData,
  mealLabel,
  onAddAllPress,
}: SameAsYesterdayCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { intuitiveEatingMode } = useSettings();

  return (
    <View style={{ marginTop: theme.spacing.padding.lg }}>
      <View className="mb-3 flex-row items-center gap-2 px-1">
        <History size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
        <Text className="text-text-secondary text-xs font-bold tracking-wider uppercase">
          {t('foodSearch.sameAsYesterday')}
        </Text>
      </View>
      <GenericCard
        isPressable
        onPress={onAddAllPress}
        variant="card"
        containerStyle={{
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.accent.secondary31,
          overflow: 'hidden',
        }}
      >
        <View
          className="flex-row items-center"
          style={{
            padding: theme.spacing.padding.xl,
            gap: theme.spacing.gap.xl,
          }}
        >
          {/* Content column: reserves space so it never overlaps the button */}
          <View
            className="min-w-0 flex-1"
            style={{
              paddingRight: theme.spacing.padding.md,
            }}
          >
            <View
              className="flex-row items-start justify-between"
              style={{ marginBottom: theme.spacing.padding.lg }}
            >
              <View
                style={{
                  flexShrink: 0,
                  paddingRight: theme.spacing.padding.sm,
                }}
              >
                <Text
                  className="text-xs font-bold tracking-tighter uppercase"
                  style={{
                    color: theme.colors.accent.secondary,
                    marginBottom: theme.spacing.margin['2'],
                  }}
                >
                  {t('foodSearch.yesterdayMealTitle', {
                    meal: mealLabel,
                  })}
                </Text>
                <View
                  className="flex-row flex-wrap"
                  style={{
                    gap: theme.spacing.gap.sm,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    className="text-[11px] font-bold tracking-tight"
                    style={[
                      { color: theme.colors.macros.protein.text },
                      intuitiveEatingMode ? blurFilter(4) : undefined,
                    ]}
                  >
                    {t('foodSearch.macroProtein', {
                      value: intuitiveEatingMode ? '0' : yesterdayMealData.totalProtein,
                    })}
                  </Text>
                  <Text
                    className="text-[11px] font-bold tracking-tight"
                    style={[
                      { color: theme.colors.macros.carbs.text },
                      intuitiveEatingMode ? blurFilter(4) : undefined,
                    ]}
                  >
                    {t('foodSearch.macroCarbs', {
                      value: intuitiveEatingMode ? '0' : yesterdayMealData.totalCarbs,
                    })}
                  </Text>
                  <Text
                    className="text-[11px] font-bold tracking-tight"
                    style={[
                      { color: theme.colors.macros.fat.text },
                      intuitiveEatingMode ? blurFilter(4) : undefined,
                    ]}
                  >
                    {t('foodSearch.macroFat', {
                      value: intuitiveEatingMode ? '0' : yesterdayMealData.totalFat,
                    })}
                  </Text>
                </View>
              </View>
              <Text
                className="text-text-primary text-xs font-bold"
                style={[{ flexShrink: 0 }, intuitiveEatingMode ? blurFilter(4) : undefined]}
              >
                {t('foodSearch.totalWithKcal', {
                  calories: intuitiveEatingMode ? '0' : yesterdayMealData.totalCalories,
                  kcal: t('food.common.kcal'),
                })}
              </Text>
            </View>
            <View
              style={{
                height: 1,
                width: '100%',
                marginBottom: theme.spacing.padding.lg,
                backgroundColor: theme.colors.border.light,
              }}
            />
            <View style={{ gap: theme.spacing.gap.sm }}>
              {yesterdayMealData.items.map((item, index) => (
                <View
                  key={`${item.name}-${index}`}
                  className="flex-row items-center justify-between"
                  style={{ gap: theme.spacing.gap.sm }}
                >
                  <View
                    className="min-w-0 flex-1 flex-row items-center"
                    style={{ gap: theme.spacing.gap.sm }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: theme.borderRadius.full,
                        backgroundColor: theme.colors.accent.secondary31,
                        flexShrink: 0,
                      }}
                    />
                    <Text
                      className="text-text-primary text-sm font-medium"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text
                    className="text-text-secondary text-xs"
                    style={[{ flexShrink: 0 }, intuitiveEatingMode ? blurFilter(4) : undefined]}
                  >
                    {intuitiveEatingMode ? '0' : formatInteger(Math.round(item.calories))}{' '}
                    {t('food.common.kcal')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {/* Add All button - fixed width so content never clips under it */}
          <View
            className="flex-col items-center"
            style={{
              flexShrink: 0,
              gap: theme.spacing.gap.sm,
              paddingLeft: theme.spacing.padding.sm,
            }}
          >
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                onAddAllPress();
              }}
              className="items-center justify-center rounded-full active:scale-90"
              style={{
                width: theme.size['12'],
                height: theme.size['12'],
                backgroundColor: theme.colors.accent.primary,
                ...theme.shadows.lg,
              }}
            >
              <Plus size={theme.iconSize.xl} color={theme.colors.background.primary} />
            </Pressable>
            <Text
              className="text-[9px] font-bold tracking-tighter uppercase"
              style={{ color: theme.colors.accent.secondary }}
            >
              {t('foodSearch.addAll')}
            </Text>
          </View>
        </View>
      </GenericCard>
    </View>
  );
}
