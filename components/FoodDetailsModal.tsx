import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import {
  ArrowLeft,
  MoreVertical,
  BookmarkPlus,
  Minus,
  Plus,
  Calendar,
  Edit,
  PlusCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { FilterTabs } from './FilterTabs';

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
  onAddFood?: (data: {
    servingSize: number;
    meal: string;
    date: Date;
  }) => void;
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
  const [macroViewIndex, setMacroViewIndex] = useState(0);

  const mealTabs = [
    { id: 'breakfast', label: t('food.meals.breakfast') },
    { id: 'lunch', label: t('food.meals.lunch') },
    { id: 'dinner', label: t('food.meals.dinner') },
    { id: 'snack', label: t('food.meals.snacks') },
    { id: 'other', label: t('food.meals.trackOther') },
  ];

  const quickServingSizes = [
    { label: '50g', value: 50 },
    { label: '100g', value: 100 },
    { label: '200g', value: 200 },
    { label: '1 cup', value: 240 },
  ];

  const handleDecrease = () => {
    setServingSize((prev) => Math.max(0, prev - 10));
  };

  const handleIncrease = () => {
    setServingSize((prev) => prev + 10);
  };

  const handleAddFood = () => {
    onAddFood?.({
      servingSize,
      meal: selectedMeal,
      date: selectedDate,
    });
    onClose();
  };

  // Calculate macro percentages for circular chart
  const totalMacros = food.protein + food.carbs + food.fat;
  const proteinPercent = totalMacros > 0 ? (food.protein / totalMacros) * 100 : 0;
  const carbsPercent = totalMacros > 0 ? (food.carbs / totalMacros) * 100 : 0;
  const fatPercent = totalMacros > 0 ? (food.fat / totalMacros) * 100 : 0;

  // Calculate dash array for circular chart
  const radius = 15.915;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate dash arrays - each segment should be a portion of the circumference
  const proteinLength = (proteinPercent / 100) * circumference;
  const fatLength = (fatPercent / 100) * circumference;
  const carbsLength = (carbsPercent / 100) * circumference;
  
  // Dash arrays: [visible length, gap length]
  const proteinDashArray = `${proteinLength} ${circumference}`;
  const fatDashArray = `${fatLength} ${circumference}`;
  const carbsDashArray = `${carbsLength} ${circumference}`;
  
  // Dash offsets: where each segment starts (negative to move clockwise from top)
  const proteinDashOffset = 0;
  const fatDashOffset = -proteinLength;
  const carbsDashOffset = -(proteinLength + fatLength);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth - theme.spacing.padding.xl * 2 - theme.spacing.padding.md * 2;

  const headerRight = (
    <Pressable className="rounded-full p-2" onPress={() => {}}>
      <MoreVertical size={theme.iconSize.md} color={theme.colors.text.primary} />
    </Pressable>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('foodDetails.title')}
      headerRight={headerRight}
      scrollable={true}>
      <View className="flex-1 px-4 pb-32">
        {/* Food Info Card */}
        <View className="mb-6 overflow-hidden rounded-xl border border-white/5 bg-bg-cardDark p-5">
          {/* Background Blobs */}
          <View
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          />
          <View
            className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: theme.colors.accent.secondary10 }}
          />

          <View className="relative z-10">
            {/* Header */}
            <View className="mb-6 flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="mb-1 text-2xl font-bold text-text-primary">{food.name}</Text>
                <Text className="text-sm text-text-secondary">{food.category}</Text>
              </View>
              <View className="items-end">
                <Text className="text-4xl font-black tracking-tight text-accent-primary">
                  {food.calories}
                </Text>
                <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  {t('food.common.kcal')}
                </Text>
              </View>
            </View>

            {/* Macro Views - Swipeable */}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                setMacroViewIndex(index);
              }}
              className="mb-4"
              style={{ width: cardWidth }}>
              {/* Grid View */}
              <View className="flex-none" style={{ width: cardWidth }}>
                <View className="mb-2 flex-row gap-3">
                  <View className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3">
                    <View className="absolute bottom-0 left-0 h-1 w-full bg-indigo-500 opacity-50" />
                    <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                      {t('food.macros.protein')}
                    </Text>
                    <Text className="text-xl font-bold text-text-primary">{food.protein}g</Text>
                  </View>
                  <View className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3">
                    <View className="absolute bottom-0 left-0 h-1 w-full bg-emerald-500 opacity-50" />
                    <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                      {t('food.macros.carbs')}
                    </Text>
                    <Text className="text-xl font-bold text-text-primary">{food.carbs}g</Text>
                  </View>
                  <View className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3">
                    <View className="absolute bottom-0 left-0 h-1 w-full bg-yellow-500 opacity-50" />
                    <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                      {t('food.macros.fat')}
                    </Text>
                    <Text className="text-xl font-bold text-text-primary">{food.fat}g</Text>
                  </View>
                </View>
              </View>

              {/* Circular Chart View */}
              <View className="flex-none" style={{ width: cardWidth }}>
                <View className="flex-row items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-3">
                  <View className="h-24 w-24 flex-none">
                    {/* Circular Chart - Using SVG */}
                    <Svg width={96} height={96} viewBox="0 0 36 36">
                      {/* Background circle */}
                      <Circle
                        cx="18"
                        cy="18"
                        r={radius}
                        fill="none"
                        stroke={theme.colors.text.primary20}
                        strokeWidth="6"
                        transform="rotate(-90 18 18)"
                      />
                      {/* Protein circle - starts at top */}
                      {proteinPercent > 0 && (
                        <Circle
                          cx="18"
                          cy="18"
                          r={radius}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="6"
                          strokeDasharray={proteinDashArray}
                          strokeDashoffset={proteinDashOffset}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                      )}
                      {/* Fat circle - continues after protein */}
                      {fatPercent > 0 && (
                        <Circle
                          cx="18"
                          cy="18"
                          r={radius}
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="6"
                          strokeDasharray={fatDashArray}
                          strokeDashoffset={fatDashOffset}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                      )}
                      {/* Carbs circle - continues after fat */}
                      {carbsPercent > 0 && (
                        <Circle
                          cx="18"
                          cy="18"
                          r={radius}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="6"
                          strokeDasharray={carbsDashArray}
                          strokeDashoffset={carbsDashOffset}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                      )}
                    </Svg>
                    <View className="absolute inset-0 items-center justify-center pointer-events-none">
                      <Text className="text-[10px] font-bold text-white/50">{t('foodDetails.macro')}</Text>
                    </View>
                  </View>
                  <View className="flex-1 gap-2">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="h-2 w-2 rounded-full bg-indigo-500" />
                        <Text className="text-xs text-text-secondary">
                          {t('food.macros.protein')} ({Math.round(proteinPercent)}%)
                        </Text>
                      </View>
                      <Text className="text-xs font-bold text-text-primary">{food.protein}g</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="h-2 w-2 rounded-full bg-yellow-500" />
                        <Text className="text-xs text-text-secondary">
                          {t('food.macros.fat')} ({Math.round(fatPercent)}%)
                        </Text>
                      </View>
                      <Text className="text-xs font-bold text-text-primary">{food.fat}g</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="h-2 w-2 rounded-full bg-emerald-500" />
                        <Text className="text-xs text-text-secondary">
                          {t('food.macros.carbs')} ({Math.round(carbsPercent)}%)
                        </Text>
                      </View>
                      <Text className="text-xs font-bold text-text-primary">{food.carbs}g</Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Pagination Dots */}
            <View className="flex-row justify-center gap-1.5">
              <View
                className="h-1.5 rounded-full"
                style={{
                  width: macroViewIndex === 0 ? 6 : 6,
                  backgroundColor: macroViewIndex === 0 ? theme.colors.text.primary : theme.colors.text.primary20,
                }}
              />
              <View
                className="h-1.5 rounded-full"
                style={{
                  width: macroViewIndex === 1 ? 6 : 6,
                  backgroundColor: macroViewIndex === 1 ? theme.colors.text.primary : theme.colors.text.primary20,
                }}
              />
            </View>
          </View>
        </View>

        {/* Form Sections */}
        <View className="gap-6">
          {/* Serving Size */}
          <View>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('foodDetails.servingSize')}
              </Text>
              <Pressable className="flex-row items-center gap-1">
                <BookmarkPlus size={16} color={theme.colors.accent.primary} />
                <Text className="text-xs font-medium text-accent-primary">
                  {t('foodDetails.addFavorite')}
                </Text>
              </Pressable>
            </View>
            <View className="rounded-xl border border-white/10 bg-bg-cardDark p-2">
              <View className="mb-4 flex-row items-center gap-3">
                <Pressable
                  className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-bg-overlay"
                  onPress={handleDecrease}>
                  <Minus size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </Pressable>
                <View className="flex-1 items-center justify-center py-1" style={{ minWidth: 0 }}>
                  <View className="relative flex-row items-baseline justify-center">
                    <TextInput
                      className="bg-transparent p-0 text-center text-4xl font-black text-text-primary"
                      style={{
                        color: theme.colors.text.primary,
                        width: 120,
                        maxWidth: '100%',
                      }}
                      value={String(servingSize)}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 0;
                        setServingSize(num);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.colors.text.primary20}
                    />
                    <Text className="absolute -right-6 bottom-1.5 text-lg font-bold text-text-secondary">
                      g
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs text-text-secondary">{t('foodDetails.grams')}</Text>
                </View>
                <Pressable
                  className="h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent-primary/20 bg-accent-primary/10"
                  onPress={handleIncrease}>
                  <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
                </Pressable>
              </View>
              <View className="flex-row justify-center gap-2 pb-2">
                {quickServingSizes.map((size) => (
                  <Pressable
                    key={size.label}
                    className={`rounded-full border px-4 py-1.5 ${
                      servingSize === size.value
                        ? 'border-accent-primary/20 bg-accent-primary/10'
                        : 'border-white/5 bg-bg-overlay/50'
                    }`}
                    onPress={() => setServingSize(size.value)}>
                    <Text
                      className={`text-xs font-medium ${
                        servingSize === size.value
                          ? 'font-bold text-accent-primary'
                          : 'text-text-secondary'
                      }`}>
                      {size.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

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
            <Pressable className="flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-cardDark p-4">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  }}>
                  <Calendar size={theme.iconSize.md} color={theme.colors.accent.primary} />
                </View>
                <View>
                  <Text className="font-medium text-text-primary">{t('foodDetails.today')}</Text>
                  <Text className="text-xs text-text-secondary">
                    {selectedDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
              <Edit size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bottom Floating Action Button */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-white/5 bg-bg-primary/95 p-4 pb-8">
        <Pressable
          className="w-full items-center justify-center rounded-xl py-4 shadow-lg"
          onPress={handleAddFood}
          style={{
            shadowColor: '#6366f1',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}>
          <LinearGradient
            colors={['#6366f1', '#29e08e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="absolute inset-0 rounded-xl"
          />
          <View className="flex-row items-center gap-2">
            <PlusCircle size={theme.iconSize.md} color={theme.colors.text.primary} />
            <Text className="text-lg font-bold text-text-primary">{t('foodDetails.addFood')}</Text>
          </View>
        </Pressable>
      </View>
    </FullScreenModal>
  );
}

