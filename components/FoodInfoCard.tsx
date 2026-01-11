import React, { useState, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type FoodInfoCardProps = {
  food: {
    name: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

export function FoodInfoCard({ food }: FoodInfoCardProps) {
  const { t } = useTranslation();
  const [macroViewIndex, setMacroViewIndex] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

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

  return (
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
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width > 0 && width !== scrollViewWidth) {
              setScrollViewWidth(width);
            }
          }}
          onMomentumScrollEnd={(e) => {
            const pageWidth = e.nativeEvent.layoutMeasurement.width;
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / pageWidth);
            setMacroViewIndex(index);
          }}
          onScroll={(e) => {
            const pageWidth = e.nativeEvent.layoutMeasurement.width;
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / pageWidth);
            if (index !== macroViewIndex && index >= 0 && index <= 1) {
              setMacroViewIndex(index);
            }
          }}
          scrollEventThrottle={16}
          className="mb-4">
          {/* Grid View */}
          <View className="flex-none" style={{ width: scrollViewWidth || '100%' }}>
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
          <View className="flex-none" style={{ width: scrollViewWidth || '100%' }}>
            <View className="flex-row items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-3">
              <View className="h-24 w-24 flex-none">
                {/* Circular Chart - Using SVG */}
                <Svg width={theme.size['24']} height={theme.size['24']} viewBox="0 0 36 36">
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
                      stroke={theme.colors.macros.protein.bg}
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
                      stroke={theme.colors.macros.fat.bg}
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
                      stroke={theme.colors.macros.carbs.bg}
                      strokeWidth="6"
                      strokeDasharray={carbsDashArray}
                      strokeDashoffset={carbsDashOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  )}
                </Svg>
                <View className="pointer-events-none absolute inset-0 items-center justify-center">
                  <Text className="text-[10px] font-bold text-white/50">
                    {t('foodDetails.macro')}
                  </Text>
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
              backgroundColor:
                macroViewIndex === 0 ? theme.colors.text.primary : theme.colors.text.primary20,
            }}
          />
          <View
            className="h-1.5 rounded-full"
            style={{
              width: macroViewIndex === 1 ? 6 : 6,
              backgroundColor:
                macroViewIndex === 1 ? theme.colors.text.primary : theme.colors.text.primary20,
            }}
          />
        </View>
      </View>
    </View>
  );
}
