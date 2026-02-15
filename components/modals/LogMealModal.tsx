import { Apple, Check, Coffee, Moon, Utensils } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme';
import { GenericCard } from '../cards/GenericCard';
import { OptionsSelector, type SelectorOption } from '../OptionsSelector';
import { Button } from '../theme/Button';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import type { TFunction } from 'i18next';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type LogMealModalProps = {
  visible: boolean;
  onClose: () => void;
  meal: {
    name: string;
    type: string;
    image?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  onLogMeal: (date: Date, mealType: MealType) => void;
};

// TODO: translate texts
const getMealTypeOptions = (theme: Theme, t: TFunction): SelectorOption<MealType>[] => [
  {
    id: 'breakfast',
    label: 'Breakfast',
    description: 'Start your day',
    icon: Coffee,
    iconBgColor: theme.colors.status.warning10,
    iconColor: theme.colors.status.warning,
  },
  {
    id: 'lunch',
    label: 'Lunch',
    description: 'Midday meal',
    icon: Utensils,
    iconBgColor: theme.colors.status.info10,
    iconColor: theme.colors.status.info,
  },
  {
    id: 'dinner',
    label: 'Dinner',
    description: 'Evening meal',
    icon: Moon,
    iconBgColor: theme.colors.status.purple10,
    iconColor: theme.colors.status.purple,
  },
  {
    id: 'snack',
    label: 'Snack',
    description: 'Light bite',
    icon: Apple,
    iconBgColor: theme.colors.status.success20,
    iconColor: theme.colors.status.success,
  },
];

export function LogMealModal({ visible, onClose, meal, onLogMeal }: LogMealModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [isLogging, setIsLogging] = useState(false);

  const formatDate = useCallback((date: Date) => {
    return date.toISOString().split('T')[0];
  }, []);

  const handleLogMeal = useCallback(async () => {
    setIsLogging(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      onLogMeal(selectedDate, selectedMealType);
      onClose();
    } finally {
      setIsLogging(false);
    }
  }, [onClose, onLogMeal, selectedDate, selectedMealType]);

  const footer = (
    <Button
      label={t('meals.logMeal')}
      variant="gradientCta"
      size="md"
      width="full"
      icon={Check}
      onPress={handleLogMeal}
      loading={isLogging}
      disabled={isLogging}
    />
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('meals.logMeal')}
        footer={footer}
        scrollable
      >
        <View className="mb-6 mt-6 space-y-6 px-4">
          {/* Meal Details Card */}
          <GenericCard variant="highlighted" backgroundVariant="gradient">
            <View className="relative">
              {/* Gradient decoration */}
              <View
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
                style={{ backgroundColor: theme.colors.accent.primary }}
              />

              <View className="relative z-10 px-4 py-4">
                {/* Meal Header */}
                <View className="mb-4 flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="mb-2">
                      <Text
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{
                          color: theme.colors.text.secondary,
                          backgroundColor: theme.colors.background.white5,
                          paddingHorizontal: theme.spacing.padding.xs,
                          paddingVertical: theme.spacing.padding.xsHalf,
                          borderRadius: theme.borderRadius.sm,
                          alignSelf: 'flex-start',
                        }}
                      >
                        {meal.type}
                      </Text>
                    </View>
                    <Text
                      className="mb-1 text-2xl font-bold leading-tight tracking-tight"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {meal.name}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {t('meals.customMeal')} • {t('meals.createdByYou')}
                    </Text>
                  </View>

                  {meal.image ? (
                    <Image
                      source={{ uri: meal.image }}
                      className="ml-3 h-16 w-16 rounded-lg"
                      style={{ backgroundColor: theme.colors.background.overlay }}
                    />
                  ) : null}
                </View>

                {/* Nutrition Stats */}
                <View className="mt-6 grid grid-cols-4 gap-2">
                  <View
                    className="flex-col items-center rounded-lg p-2"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="mb-1 text-xs font-medium"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      {t('food.calories')}
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {meal.calories}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      kcal
                    </Text>
                  </View>

                  <View
                    className="flex-col items-center rounded-lg p-2"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="mb-1 text-xs font-medium"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      {t('food.macros.protein')}
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      {meal.protein}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      g
                    </Text>
                  </View>

                  <View
                    className="flex-col items-center rounded-lg p-2"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="mb-1 text-xs font-medium"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      {t('food.macros.carbs')}
                    </Text>
                    <Text className="text-lg font-bold" style={{ color: '#60a5fa' }}>
                      {meal.carbs}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      g
                    </Text>
                  </View>

                  <View
                    className="flex-col items-center rounded-lg p-2"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="mb-1 text-xs font-medium"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      {t('food.macros.fat')}
                    </Text>
                    <Text className="text-lg font-bold" style={{ color: '#fbbf24' }}>
                      {meal.fat}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      g
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </GenericCard>

          {/* Date Picker */}
          <View>
            <Text
              className="mb-3 ml-1 text-sm font-semibold"
              style={{ color: theme.colors.text.primary }}
            >
              {t('food.foodDetails.date')}
            </Text>
            <Pressable
              className="flex-row items-center justify-between rounded-xl p-4"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.border.light,
                borderWidth: theme.borderWidth.thin,
              }}
              onPress={() => setShowDatePicker(true)}
            >
              <View className="flex-row items-center gap-3">
                <Coffee size={theme.iconSize.md} color={theme.colors.text.secondary} />
                <Text
                  className="text-base font-medium"
                  style={{ color: theme.colors.text.primary }}
                >
                  {formatDate(selectedDate)}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Meal Type Selector */}
          <OptionsSelector<MealType>
            title={t('meals.mealType')}
            options={getMealTypeOptions(theme, t)}
            selectedId={selectedMealType}
            onSelect={setSelectedMealType}
          />
        </View>
      </FullScreenModal>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
      />
    </>
  );
}
