import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Minus,
  Plus,
  Scale,
  Percent,
  TrendingUp,
  Activity,
  ChevronRight,
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';
import { Button } from './theme/Button';
import { Slider } from './theme/Slider';

export type NutritionGoals = {
  totalCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  targetWeight: number;
  targetBodyFat: number;
  targetBMI: number;
  targetFFMI: number;
};

type NutritionGoalsModalBodyProps = {
  onSave?: (goals: NutritionGoals) => void;
  initialGoals?: Partial<NutritionGoals>;
  showSaveButton?: boolean;
  showSubtitle?: boolean;
};

type MacroCardProps = {
  label: string;
  kcalPerGram: string;
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (value: number) => void;
};

function MacroCard({ label, kcalPerGram, value, min, max, color, onChange }: MacroCardProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - 5));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + 5));
  };

  // Web-specific styles to allow horizontal gestures on slider area
  const webSliderContainerStyle =
    Platform.OS === 'web'
      ? ({
          // Allow horizontal panning for slider, preventing browser swipe gesture
          touchAction: 'pan-x pan-y',
        } as any)
      : {};

  return (
    <View
      className="rounded-xl border bg-bg-card p-5"
      style={{ borderColor: theme.colors.border.emerald }}>
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-8 w-0.5 rounded-full" style={{ backgroundColor: color }} />
          <View>
            <Text className="font-semibold text-text-primary">{label}</Text>
            <Text className="text-xs text-text-secondary">{kcalPerGram}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleDecrement}>
            <Minus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
          <Text className="w-12 text-center text-xl font-bold text-text-primary">{value}g</Text>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleIncrement}>
            <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
        </View>
      </View>
      {/* Slider */}
      <View style={webSliderContainerStyle}>
        <Slider value={value} min={min} max={max} onChange={onChange} />
      </View>
    </View>
  );
}

type BodyMetricCardProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  sublabel: string;
  value: number;
  unit: string;
  unitLabel: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

function BodyMetricCard({
  icon: Icon,
  label,
  sublabel,
  value,
  unit,
  unitLabel,
  min,
  max,
  step = 1,
  onChange,
}: BodyMetricCardProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  return (
    <View
      className="rounded-xl border bg-bg-card p-5"
      style={{ borderColor: theme.colors.border.emerald }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: theme.colors.accent.primary10 }}>
            <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </View>
          <View>
            <Text className="font-semibold text-text-primary">{label}</Text>
            <Text className="text-xs text-text-secondary">{sublabel}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleDecrement}>
            <Minus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
          <View className="w-16 items-center">
            <Text className="text-xl font-bold text-text-primary">
              {unit === 'index' ? value.toFixed(1) : value}
            </Text>
            <Text className="text-xs text-text-secondary">{unitLabel}</Text>
          </View>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: `${theme.colors.accent.primary}33`,
            }}
            onPress={handleIncrement}>
            <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MacrosDistributionChart({
  protein,
  carbs,
  fats,
}: {
  protein: number;
  carbs: number;
  fats: number;
}) {
  const total = protein + carbs + fats;
  const proteinPercentage = (protein / total) * 100;
  const carbsPercentage = (carbs / total) * 100;
  const fatsPercentage = (fats / total) * 100;

  // Calculate stroke-dasharray for each segment
  const circumference = 2 * Math.PI * 40; // radius is 40
  const proteinDashArray = (proteinPercentage / 100) * circumference;
  const carbsDashArray = (carbsPercentage / 100) * circumference;
  const fatsDashArray = (fatsPercentage / 100) * circumference;

  // Calculate stroke-dashoffset for each segment
  const proteinOffset = 0;
  const carbsOffset = -proteinDashArray;
  const fatsOffset = -(proteinDashArray + carbsDashArray);

  return (
    <View className="items-center py-10">
      <Text className="mb-6 text-sm font-semibold uppercase tracking-widest text-text-secondary opacity-60">
        Macros Distribution
      </Text>
      <View className="relative h-48 w-48 items-center justify-center">
        <Svg
          width={192}
          height={192}
          viewBox="0 0 100 100"
          style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Background circle */}
          <Circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={theme.colors.background.cardDark}
            strokeWidth="12"
          />
          {/* Protein (green/emerald) */}
          <Circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={theme.colors.macros.carbs.bg}
            strokeWidth="12"
            strokeDasharray={`${proteinDashArray} ${circumference}`}
            strokeDashoffset={proteinOffset}
          />
          {/* Carbs (purple/indigo) */}
          <Circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={theme.colors.macros.protein.bg}
            strokeWidth="12"
            strokeDasharray={`${carbsDashArray} ${circumference}`}
            strokeDashoffset={carbsOffset}
          />
          {/* Fats (amber) */}
          <Circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={theme.colors.macros.fat.bg}
            strokeWidth="12"
            strokeDasharray={`${fatsDashArray} ${circumference}`}
            strokeDashoffset={fatsOffset}
          />
        </Svg>
        <View className="absolute items-center">
          <Text className="text-[10px] font-bold uppercase text-text-secondary">Balance</Text>
          <Text className="text-lg font-bold text-text-primary">Optimal</Text>
        </View>
      </View>
      <View className="mt-8 flex-row gap-6">
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.colors.macros.carbs.bg }}
          />
          <Text className="text-xs text-text-secondary">{Math.round(proteinPercentage)}% P</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.colors.macros.protein.bg }}
          />
          <Text className="text-xs text-text-secondary">{Math.round(carbsPercentage)}% C</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.colors.macros.fat.bg }}
          />
          <Text className="text-xs text-text-secondary">{Math.round(fatsPercentage)}% F</Text>
        </View>
      </View>
    </View>
  );
}

export function NutritionGoalsModalBody({
  onSave,
  initialGoals,
  showSaveButton = true,
  showSubtitle = true,
}: NutritionGoalsModalBodyProps) {
  const [totalCalories, setTotalCalories] = useState(initialGoals?.totalCalories ?? 2450);
  const [protein, setProtein] = useState(initialGoals?.protein ?? 180);
  const [carbs, setCarbs] = useState(initialGoals?.carbs ?? 250);
  const [fats, setFats] = useState(initialGoals?.fats ?? 80);
  const [targetWeight, setTargetWeight] = useState(initialGoals?.targetWeight ?? 75);
  const [targetBodyFat, setTargetBodyFat] = useState(initialGoals?.targetBodyFat ?? 12);
  const [targetBMI, setTargetBMI] = useState(initialGoals?.targetBMI ?? 23.5);
  const [targetFFMI, setTargetFFMI] = useState(initialGoals?.targetFFMI ?? 21.0);

  const handleSave = () => {
    const goals: NutritionGoals = {
      totalCalories,
      protein,
      carbs,
      fats,
      targetWeight,
      targetBodyFat,
      targetBMI,
      targetFFMI,
    };
    onSave?.(goals);
  };

  // Calculate total calories from macros (protein and carbs are 4 kcal/g, fats are 9 kcal/g)
  React.useEffect(() => {
    const calculatedCalories = protein * 4 + carbs * 4 + fats * 9;
    setTotalCalories(Math.round(calculatedCalories));
  }, [protein, carbs, fats]);

  // Web-specific ScrollView styles to prevent browser gestures
  const webScrollViewStyle =
    Platform.OS === 'web'
      ? ({
          // Allow vertical scrolling but prevent horizontal browser gestures
          touchAction: 'pan-y',
        } as any)
      : {};

  return (
    <>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={webScrollViewStyle}>
        <View className={`gap-4 px-6 pt-2 ${showSaveButton ? 'pb-36' : 'pb-6'}`}>
          {/* Subtitle */}
          {showSubtitle && (
            <Text className="mb-2 text-sm text-text-secondary">
              Define your targets for nutrition and body composition.
            </Text>
          )}

          {/* Total Daily Calories Card */}
          <View
            className="relative mb-6 overflow-hidden rounded-2xl border p-6"
            style={{
              borderColor: theme.colors.border.emerald,
              backgroundColor: theme.colors.background.cardElevated,
            }}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.05)', 'rgba(52, 211, 153, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', inset: 0 }}
            />
            <View className="relative z-10 items-center">
              <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                Total Daily Calories
              </Text>
              <View className="flex-row items-baseline gap-2">
                <Text className="text-5xl font-extrabold tracking-tighter text-text-primary">
                  {totalCalories.toLocaleString()}
                </Text>
                <Text className="text-lg font-semibold uppercase text-accent-primary">kcal</Text>
              </View>
            </View>
          </View>

          {/* Daily Macro Targets */}
          <Text className="mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Daily Macro Targets
          </Text>
          <View className="gap-4">
            <MacroCard
              label="Protein"
              kcalPerGram="4 kcal/g"
              value={protein}
              min={0}
              max={300}
              color={theme.colors.macros.carbs.bg}
              onChange={setProtein}
            />
            <MacroCard
              label="Carbohydrates"
              kcalPerGram="4 kcal/g"
              value={carbs}
              min={0}
              max={500}
              color={theme.colors.macros.protein.bg}
              onChange={setCarbs}
            />
            <MacroCard
              label="Fats"
              kcalPerGram="9 kcal/g"
              value={fats}
              min={0}
              max={150}
              color={theme.colors.macros.fat.bg}
              onChange={setFats}
            />
          </View>

          {/* Macros Distribution Chart */}
          <MacrosDistributionChart protein={protein} carbs={carbs} fats={fats} />

          {/* Target Body Metrics */}
          <Text className="mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Target Body Metrics
          </Text>
          <View className="gap-4">
            <BodyMetricCard
              icon={Scale}
              label="Target Weight"
              sublabel="kg/lbs"
              value={targetWeight}
              unit="kg"
              unitLabel="kg"
              min={30}
              max={200}
              step={1}
              onChange={setTargetWeight}
            />
            <BodyMetricCard
              icon={Percent}
              label="Target Body Fat"
              sublabel="% percentage"
              value={targetBodyFat}
              unit="%"
              unitLabel="%"
              min={5}
              max={50}
              step={1}
              onChange={setTargetBodyFat}
            />
            <BodyMetricCard
              icon={TrendingUp}
              label="Target BMI"
              sublabel="Body Mass Index"
              value={targetBMI}
              unit="index"
              unitLabel="index"
              min={15}
              max={40}
              step={0.1}
              onChange={setTargetBMI}
            />
            <BodyMetricCard
              icon={Activity}
              label="Target FFMI"
              sublabel="Fat-Free Mass Index"
              value={targetFFMI}
              unit="index"
              unitLabel="index"
              min={15}
              max={30}
              step={0.1}
              onChange={setTargetFFMI}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Fixed Button */}
      {showSaveButton && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-white/5 bg-bg-primary p-6 pt-12">
          <Button
            label="Save Goals"
            icon={ChevronRight}
            iconPosition="right"
            variant="gradientCta"
            size="md"
            width="full"
            onPress={handleSave}
          />
          <Text className="mt-4 text-center text-[10px] text-text-secondary">
            You can change these values anytime in Settings.
          </Text>
        </View>
      )}
    </>
  );
}
