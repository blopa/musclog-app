import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { AI_COACH_AVATAR } from '@/hooks/useChatMessages';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

type ChatMealPlanCarouselProps = {
  meals: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }[];
  onSeeAll?: () => void;
};

const MAX_VISIBLE_MEALS = 4;

/** Fixed card width to match coach chat mocks (compact horizontal carousel). */
const MEAL_CARD_WIDTH = 156;
const SEE_ALL_CARD_WIDTH = 88;

export function ChatMealPlanCarousel({ meals, onSeeAll }: ChatMealPlanCarouselProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { width: screenWidth } = useWindowDimensions();

  if (!meals || meals.length === 0) {
    return null;
  }

  const visibleMeals = meals.slice(0, MAX_VISIBLE_MEALS);
  const hasMoreMeals = meals.length > MAX_VISIBLE_MEALS;

  return (
    <View className="mt-2" style={{ width: screenWidth, marginLeft: -theme.spacing.padding.base }}>
      {/* Avatar at the top */}
      <View className="mb-2 flex-row items-center gap-2 px-4">
        <View
          className="rounded-full"
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderWidth: theme.borderWidth.medium,
            borderColor: theme.colors.accent.primary40,
            overflow: 'hidden',
          }}
        >
          <Image
            source={AI_COACH_AVATAR}
            style={{ width: theme.size['8'], height: theme.size['8'] }}
            resizeMode="cover"
          />
        </View>
        <Text className="text-xs font-medium" style={{ color: theme.colors.text.secondary }}>
          {t('coach.name')}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingLeft: theme.spacing.padding.base,
          paddingRight: theme.spacing.padding.base,
          gap: theme.spacing.gap.md,
          marginRight: theme.spacing.padding.base,
        }}
      >
        {visibleMeals.map((meal) => (
          <View
            key={meal.id}
            className="rounded-xl border px-2 py-2"
            style={{
              backgroundColor: theme.colors.background.card,
              borderColor: theme.colors.border.light,
              width: MEAL_CARD_WIDTH,
            }}
          >
            <View className="items-center">
              <Text
                className="mb-1 text-center text-[11px] font-semibold leading-[14px] text-text-primary"
                numberOfLines={4}
              >
                {meal.name}
              </Text>

              <View className="mb-1 flex-row flex-wrap items-baseline justify-center gap-0.5">
                <Text
                  className="text-base font-bold leading-none"
                  style={{ color: theme.colors.text.primary }}
                >
                  {formatRoundedDecimal(meal.calories, 2)}
                </Text>
                <Text
                  className="text-[10px] font-medium leading-none"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  {t('common.kcal')}
                </Text>
              </View>

              <View className="w-full flex-row items-center justify-between gap-0.5">
                <View className="flex-1 flex-row flex-wrap items-baseline justify-center gap-0.5">
                  <Text
                    className="text-[9px] font-semibold"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    P:
                  </Text>
                  <Text
                    className="text-[10px] font-bold leading-none"
                    style={{ color: theme.colors.accent.primary }}
                  >
                    {t('common.weightFormatG', {
                      value: formatRoundedDecimal(meal.protein, 2),
                    })}
                  </Text>
                </View>
                <View className="flex-1 flex-row flex-wrap items-baseline justify-center gap-0.5">
                  <Text
                    className="text-[9px] font-semibold"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    {t('food.macros.carbsShort')}:
                  </Text>
                  <Text
                    className="text-[10px] font-bold leading-none"
                    style={{ color: theme.colors.status.indigo }}
                  >
                    {t('common.weightFormatG', {
                      value: formatRoundedDecimal(meal.carbs, 2),
                    })}
                  </Text>
                </View>
                <View className="flex-1 flex-row flex-wrap items-baseline justify-center gap-0.5">
                  <Text
                    className="text-[9px] font-semibold"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    {t('food.macros.fatShort')}:
                  </Text>
                  <Text
                    className="text-[10px] font-bold leading-none"
                    style={{ color: theme.colors.status.warning }}
                  >
                    {t('common.weightFormatG', {
                      value: formatRoundedDecimal(meal.fats, 2),
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        {onSeeAll && hasMoreMeals ? (
          <Pressable
            onPress={onSeeAll}
            className="items-center justify-center rounded-xl border px-1.5 py-2 active:opacity-70"
            style={{
              backgroundColor: theme.colors.background.card,
              borderColor: theme.colors.border.light,
              width: SEE_ALL_CARD_WIDTH,
            }}
          >
            <View
              className="mb-1 h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.background.primary }}
            >
              <ArrowRight size={16} color={theme.colors.accent.primary} />
            </View>
            <Text
              className="text-center text-[10px] font-bold leading-tight text-text-primary"
              numberOfLines={2}
            >
              {t('common.seeAll')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
