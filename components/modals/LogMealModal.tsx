import { Apple,Check, Coffee, Moon, Utensils } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from '../cards/GenericCard';
import { OptionsSelector, type SelectorOption } from '../OptionsSelector';
import { Button } from '../theme/Button';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

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

const mealTypeOptions: SelectorOption<MealType>[] = [
  {
    id: 'breakfast',
    label: 'Breakfast',
    description: 'Start your day',
    icon: Coffee,
    iconBgColor: '#fed7aa',
    iconColor: '#ea580c',
  },
  {
    id: 'lunch',
    label: 'Lunch',
    description: 'Midday meal',
    icon: Utensils,
    iconBgColor: '#dbeafe',
    iconColor: '#2563eb',
  },
  {
    id: 'dinner',
    label: 'Dinner',
    description: 'Evening meal',
    icon: Moon,
    iconBgColor: '#e9d5ff',
    iconColor: '#7c3aed',
  },
  {
    id: 'snack',
    label: 'Snack',
    description: 'Light bite',
    icon: Apple,
    iconBgColor: '#d1fae5',
    iconColor: '#059669',
  },
];

export function LogMealModal({
  visible,
  onClose,
  meal,
  onLogMeal,
}: LogMealModalProps) {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleLogMeal = () => {
    onLogMeal(selectedDate, selectedMealType);
    onClose();
  };

  const footer = (
    <Button
      label="Log Meal"
      variant="gradientCta"
      size="md"
      width="full"
      icon={Check}
      onPress={handleLogMeal}
    />
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title="Log Meal"
        footer={footer}
        scrollable
      >
        <View className="px-4 space-y-6 mb-6 mt-6">
          {/* Meal Details Card */}
          <GenericCard variant="highlighted" backgroundVariant="gradient">
            <View className="relative">
              {/* Gradient decoration */}
              <View
                className="absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-20"
                style={{ backgroundColor: theme.colors.accent.primary }}
              />
              
              <View className="relative z-10 px-4 py-4">
                {/* Meal Header */}
                <View className="flex-row items-start justify-between mb-4">
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
                      className="text-2xl font-bold leading-tight tracking-tight mb-1"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {meal.name}
                    </Text>
                    <Text
                      className="text-sm"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Custom Meal • Created by you
                    </Text>
                  </View>
                  
                  {meal.image ? <Image
                      source={{ uri: meal.image }}
                      className="w-16 h-16 rounded-lg ml-3"
                      style={{ backgroundColor: theme.colors.background.overlay }}
                  /> : null}
                </View>

                {/* Nutrition Stats */}
                <View className="grid grid-cols-4 gap-2 mt-6">
                  <View
                    className="flex-col items-center p-2 rounded-lg"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="text-xs font-medium mb-1"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Calories
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {meal.calories}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      kcal
                    </Text>
                  </View>

                  <View
                    className="flex-col items-center p-2 rounded-lg"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="text-xs font-medium mb-1"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Protein
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      {meal.protein}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      g
                    </Text>
                  </View>

                  <View
                    className="flex-col items-center p-2 rounded-lg"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="text-xs font-medium mb-1"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Carbs
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: '#60a5fa' }}
                    >
                      {meal.carbs}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      g
                    </Text>
                  </View>

                  <View
                    className="flex-col items-center p-2 rounded-lg"
                    style={{
                      backgroundColor: theme.colors.background.white5,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      className="text-xs font-medium mb-1"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Fat
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: '#fbbf24' }}
                    >
                      {meal.fat}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: theme.colors.text.secondary }}
                    >
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
              className="text-sm font-semibold mb-3 ml-1"
              style={{ color: theme.colors.text.primary }}
            >
              Date
            </Text>
            <Pressable
              className="flex-row items-center justify-between p-4 rounded-xl"
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
            title="Meal Type"
            options={mealTypeOptions}
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
