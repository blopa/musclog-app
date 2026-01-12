import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus, Scale, Percent, Activity, Dumbbell, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { theme } from '../theme';
import { Slider } from '../components/theme/Slider';
import { Button } from '../components/theme/Button';
import Svg, { Circle } from 'react-native-svg';

export default function NutritionGoalsScreen() {
  const router = useRouter();

  // Macro states
  const [protein, setProtein] = useState(180);
  const [carbs, setCarbs] = useState(250);
  const [fats, setFats] = useState(80);

  // Body metrics states
  const [targetWeight, setTargetWeight] = useState(75);
  const [targetBodyFat, setTargetBodyFat] = useState(12);
  const [targetBMI, setTargetBMI] = useState(23.5);
  const [targetFFMI, setTargetFFMI] = useState(21.0);

  // Calculate total calories
  const totalCalories = protein * 4 + carbs * 4 + fats * 9;

  // Calculate percentages for chart
  const proteinCalories = protein * 4;
  const carbsCalories = carbs * 4;
  const fatsCalories = fats * 9;
  const proteinPercent = (proteinCalories / totalCalories) * 100;
  const carbsPercent = (carbsCalories / totalCalories) * 100;
  const fatsPercent = (fatsCalories / totalCalories) * 100;

  // SVG circle calculations
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const proteinDash = (circumference * proteinPercent) / 100;
  const carbsDash = (circumference * carbsPercent) / 100;
  const fatsDash = (circumference * fatsPercent) / 100;
  const carbsOffset = -proteinDash;
  const fatsOffset = -(proteinDash + carbsDash);

  const MacroCard = ({
    label,
    value,
    setValue,
    kcalPerGram,
    color,
    max,
    min = 0,
  }: {
    label: string;
    value: number;
    setValue: (value: number) => void;
    kcalPerGram: number;
    color: string;
    max: number;
    min?: number;
  }) => (
    <View className="rounded-xl border border-emerald-900/20 bg-bg-card p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-8 w-2 rounded-full" style={{ backgroundColor: color }} />
          <View>
            <Text className="font-semibold text-white">{label}</Text>
            <Text className="text-xs text-gray-500">{kcalPerGram} kcal/g</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            className="border-primary/20 h-10 w-10 items-center justify-center rounded-full border active:opacity-70"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }}
            onPress={() => setValue(Math.max(min, value - 1))}>
            <Minus size={20} color={theme.colors.status.emeraldLight} />
          </Pressable>
          <Text className="w-12 text-center text-xl font-bold text-white">{value}g</Text>
          <Pressable
            className="border-primary/20 h-10 w-10 items-center justify-center rounded-full border active:opacity-70"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }}
            onPress={() => setValue(Math.min(max, value + 1))}>
            <Plus size={20} color={theme.colors.status.emeraldLight} />
          </Pressable>
        </View>
      </View>
      <Slider
        value={value}
        min={min}
        max={max}
        onChange={setValue}
        trackColor="rgba(16, 185, 129, 0.3)"
        thumbColor={theme.colors.status.emeraldLight}
        variant="solid"
        solidColor={theme.colors.status.emeraldLight}
      />
    </View>
  );

  const BodyMetricCard = ({
    icon: Icon,
    label,
    value,
    setValue,
    unit,
    subtitle,
    min = 0,
    max = 200,
    step = 1,
  }: {
    icon: any;
    label: string;
    value: number;
    setValue: (value: number) => void;
    unit: string;
    subtitle: string;
    min?: number;
    max?: number;
    step?: number;
  }) => (
    <View className="rounded-xl border border-emerald-900/20 bg-bg-card p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}>
            <Icon size={20} color={theme.colors.status.emeraldLight} />
          </View>
          <View>
            <Text className="font-semibold text-white">{label}</Text>
            <Text className="text-xs text-gray-500">{subtitle}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            className="border-primary/20 h-10 w-10 items-center justify-center rounded-full border active:opacity-70"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }}
            onPress={() => setValue(Math.max(min, value - step))}>
            <Minus size={20} color={theme.colors.status.emeraldLight} />
          </Pressable>
          <View className="w-16 items-center">
            <Text className="text-xl font-bold text-white">
              {step === 0.1 ? value.toFixed(1) : value}
            </Text>
            <Text className="text-xs text-gray-500">{unit}</Text>
          </View>
          <Pressable
            className="border-primary/20 h-10 w-10 items-center justify-center rounded-full border active:opacity-70"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }}
            onPress={() => setValue(Math.min(max, value + step))}>
            <Plus size={20} color={theme.colors.status.emeraldLight} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View className="px-6 pb-2 pt-4">
          <Text className="text-2xl font-bold tracking-tight text-white">
            Set Nutrition & Body Goals
          </Text>
          <Text className="mt-1 text-sm text-gray-400">
            Define your targets for nutrition and body composition.
          </Text>
        </View>
      </SafeAreaView>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-2 pb-36" style={{ gap: theme.spacing.gap.base }}>
          {/* Total Daily Calories Card */}
          <View className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-900/30 bg-bg-card/50 p-6">
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.05)', 'rgba(41, 224, 142, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
              Total Daily Calories
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-5xl font-extrabold tracking-tighter text-white">
                {totalCalories.toLocaleString()}
              </Text>
              <Text className="text-primary text-lg font-semibold uppercase">kcal</Text>
            </View>
          </View>

          {/* Daily Macro Targets */}
          <Text className="mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-white/60">
            Daily Macro Targets
          </Text>
          <View style={{ gap: theme.spacing.gap.base }}>
            <MacroCard
              label="Protein"
              value={protein}
              setValue={setProtein}
              kcalPerGram={4}
              color={theme.colors.status.emerald}
              max={300}
            />
            <MacroCard
              label="Carbohydrates"
              value={carbs}
              setValue={setCarbs}
              kcalPerGram={4}
              color={theme.colors.status.indigo}
              max={500}
            />
            <MacroCard
              label="Fats"
              value={fats}
              setValue={setFats}
              kcalPerGram={9}
              color={theme.colors.status.amber}
              max={150}
            />
          </View>

          {/* Macros Distribution */}
          <View className="py-10">
            <Text className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-white opacity-60">
              Macros Distribution
            </Text>
            <View className="relative h-48 w-48 items-center justify-center self-center">
              <View style={{ transform: [{ rotate: '-90deg' }] }}>
                <Svg width="192" height="192" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <Circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={theme.colors.background.card}
                    strokeWidth="12"
                  />
                  {/* Protein */}
                  <Circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={theme.colors.status.emerald}
                    strokeDasharray={`${proteinDash} ${circumference}`}
                    strokeDashoffset="0"
                    strokeWidth="12"
                  />
                  {/* Carbs */}
                  <Circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={theme.colors.status.indigo}
                    strokeDasharray={`${carbsDash} ${circumference}`}
                    strokeDashoffset={carbsOffset}
                    strokeWidth="12"
                  />
                  {/* Fats */}
                  <Circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={theme.colors.status.amber}
                    strokeDasharray={`${fatsDash} ${circumference}`}
                    strokeDashoffset={fatsOffset}
                    strokeWidth="12"
                  />
                </Svg>
              </View>
              <View className="absolute items-center">
                <Text className="text-[10px] font-bold uppercase text-gray-400">Balance</Text>
                <Text className="text-lg font-bold text-white">Optimal</Text>
              </View>
            </View>
            <View className="mt-8 flex-row justify-center gap-6">
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-emerald-400" />
                <Text className="text-xs text-gray-400">{Math.round(proteinPercent)}% P</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-indigo-400" />
                <Text className="text-xs text-gray-400">{Math.round(carbsPercent)}% C</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-amber-400" />
                <Text className="text-xs text-gray-400">{Math.round(fatsPercent)}% F</Text>
              </View>
            </View>
          </View>

          {/* Target Body Metrics */}
          <Text className="mb-2 mt-8 text-[10px] font-bold uppercase tracking-widest text-white/60">
            Target Body Metrics
          </Text>
          <View style={{ gap: theme.spacing.gap.base }}>
            <BodyMetricCard
              icon={Scale}
              label="Target Weight"
              value={targetWeight}
              setValue={setTargetWeight}
              unit="kg"
              subtitle="kg/lbs"
              min={30}
              max={200}
            />
            <BodyMetricCard
              icon={Percent}
              label="Target Body Fat"
              value={targetBodyFat}
              setValue={setTargetBodyFat}
              unit="%"
              subtitle="% percentage"
              min={0}
              max={50}
            />
            <BodyMetricCard
              icon={Activity}
              label="Target BMI"
              value={targetBMI}
              setValue={setTargetBMI}
              unit="index"
              subtitle="Body Mass Index"
              min={10}
              max={50}
              step={0.1}
            />
            <BodyMetricCard
              icon={Dumbbell}
              label="Target FFMI"
              value={targetFFMI}
              setValue={setTargetFFMI}
              unit="index"
              subtitle="Fat-Free Mass Index"
              min={10}
              max={30}
              step={0.1}
            />
          </View>
        </View>
      </ScrollView>

      {/* Footer - Fixed Bottom */}
      <View className="absolute bottom-0 left-0 right-0">
        <LinearGradient
          colors={[theme.colors.background.primary, theme.colors.background.primary, 'transparent']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={{ paddingTop: theme.spacing.padding['3xl'] }}>
          <SafeAreaView edges={['bottom']}>
            <View className="px-6 pb-6">
              <Button
                label="Save Goals"
                onPress={() => {
                  // Handle save goals
                  console.log('Save goals');
                  router.push('/');
                }}
                icon={ChevronRight}
                iconPosition="right"
                variant="gradientCta"
                size="lg"
                width="full"
                style={{
                  ...theme.shadows.lg,
                  shadowColor: theme.colors.status.emeraldLight,
                  shadowOpacity: 0.15,
                }}
              />
              <Text className="mt-4 text-center text-[10px] text-gray-500">
                You can change these values anytime in Settings.
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </View>
  );
}
