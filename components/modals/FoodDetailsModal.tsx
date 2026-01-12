import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Calendar, Edit, PlusCircle } from 'lucide-react-native';
import { format, isSameDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { FilterTabs } from '../FilterTabs';
import { DatePickerModal } from './DatePickerModal';
import { Button } from '../theme/Button';
import { FoodInfoCard } from '../cards/FoodInfoCard';
import { ServingSizeSelector } from '../ServingSizeSelector';

type FoodDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  food?: {
    name: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  onAddFood?: (data: { servingSize: number; meal: string; date: Date }) => void;
};

export function FoodDetailsModal({
  visible,
  onClose,
  food = {
    name: 'Grilled Chicken Breast',
    category: 'Lean Meat • High Protein',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
  onAddFood,
}: FoodDetailsModalProps) {
  const { t } = useTranslation();
  const [servingSize, setServingSize] = useState(100);
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  const mealTabs = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.trackOther') },
  ];

  const handleAddFood = () => {
    onAddFood?.({
      servingSize,
      meal: selectedMeal,
      date: selectedDate,
    });
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('foodDetails.title')}
      scrollable={true}
      footer={
        <View className="bg-transparent px-4 pb-6 pt-3">
          <Button
            label={t('foodDetails.addFood')}
            icon={PlusCircle}
            variant="gradientCta"
            size="lg"
            width="full"
            onPress={handleAddFood}
          />
        </View>
      }>
      <View className="flex-1 px-4 pb-6">
        {/* Food Info Card */}
        <View className="mt-6">
          <FoodInfoCard food={food} />
        </View>

        {/* Form Sections */}
        <View className="gap-6">
          {/* Serving Size */}
          <ServingSizeSelector value={servingSize} onChange={setServingSize} />

          {/* Meal Selection */}
          <View>
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('foodDetails.meal')}
            </Text>
            <FilterTabs
              tabs={mealTabs}
              activeTab={selectedMeal}
              onTabChange={setSelectedMeal}
              showContainer={false}
              scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
            />
          </View>

          {/* Date Selection */}
          <View>
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('foodDetails.date')}
            </Text>
            <Pressable
              className="flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-cardDark p-4"
              onPress={() => setIsDatePickerVisible(true)}>
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  }}>
                  <Calendar size={theme.iconSize.md} color={theme.colors.accent.primary} />
                </View>
                <View>
                  <Text className="font-medium text-text-primary">
                    {isSameDay(selectedDate, new Date())
                      ? t('foodDetails.today')
                      : format(selectedDate, 'EEEE')}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </Text>
                </View>
              </View>
              <Edit size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* footer is handled by FullScreenModal */}

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setIsDatePickerVisible(false);
        }}
      />
    </FullScreenModal>
  );
}
