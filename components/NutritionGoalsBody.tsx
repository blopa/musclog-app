import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Activity,
  Calendar,
  ChevronRight,
  Minus,
  Percent,
  Plus,
  Scale,
  TrendingUp,
} from 'lucide-react-native';
import { lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { theme } from '../theme';
import { DatePickerModal } from './modals/DatePickerModal';
import { MacrosPizzaChart } from './theme/MacrosPizzaChart';
import { SegmentedControl } from './theme/SegmentedControl';
import { Slider } from './theme/Slider';
import { StepperInlineInput } from './theme/StepperInlineInput';
const Button = lazy(() => import('./theme/Button').then(({ Button }) => ({ default: Button })));

export type NutritionGoals = {
  totalCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  eatingPhase: 'cut' | 'maintain' | 'bulk';
  targetWeight: number;
  targetBodyFat: number;
  targetBMI: number;
  targetFFMI: number;
  targetDate?: number | null;
};

type NutritionGoalsModalBodyProps = {
  onSave?: (goals: NutritionGoals) => void;
  onFormChange?: (goals: NutritionGoals) => void;
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
      style={{ borderColor: theme.colors.border.emerald }}
    >
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
              borderColor: theme.colors.accent.primary20,
            }}
            onPress={handleDecrement}
          >
            <Minus size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </Pressable>
          <Text className="w-12 text-center text-xl font-bold text-text-primary">{value}g</Text>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.accent.primary10,
              borderColor: theme.colors.accent.primary20,
            }}
            onPress={handleIncrement}
          >
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

function MacrosDistributionChart({
  protein,
  carbs,
  fats,
  fiber = 0,
}: {
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
}) {
  const { t } = useTranslation();
  const total = protein + carbs + fats + fiber;
  const proteinPercentage = total > 0 ? (protein / total) * 100 : 0;
  const carbsPercentage = total > 0 ? (carbs / total) * 100 : 0;
  const fatsPercentage = total > 0 ? (fats / total) * 100 : 0;
  const fiberPercentage = total > 0 ? (fiber / total) * 100 : 0;

  return (
    <View className="items-center py-10">
      <Text className="mb-6 text-sm font-semibold uppercase tracking-widest text-text-secondary opacity-60">
        {t('nutritionGoals.macrosDistribution')}
      </Text>

      <MacrosPizzaChart protein={protein} carbs={carbs} fats={fats} fiber={fiber} />

      <View className="mt-8 flex-row flex-wrap justify-center gap-x-6 gap-y-3 px-4">
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.colors.macros.protein.bg }}
          />
          <Text className="text-xs text-text-secondary">
            {Math.round(proteinPercentage)}% {t('food.macros.proteinLegend')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.colors.macros.carbs.bg }}
          />
          <Text className="text-xs text-text-secondary">
            {Math.round(carbsPercentage)}% {t('food.macros.carbsLegend')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.colors.macros.fat.bg }}
          />
          <Text className="text-xs text-text-secondary">
            {Math.round(fatsPercentage)}% {t('food.macros.fatLegend')}
          </Text>
        </View>
        {fiber > 0 ? (
          <View className="flex-row items-center gap-2">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: theme.colors.macros.fiber.bg }}
            />
            <Text className="text-xs text-text-secondary">
              {Math.round(fiberPercentage)}% {t('food.macros.fiberLegend')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function NutritionGoalsBody({
  onSave,
  onFormChange,
  initialGoals,
  showSaveButton = true,
  showSubtitle = true,
}: NutritionGoalsModalBodyProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const showIcons = screenWidth >= 415;
  const [totalCalories, setTotalCalories] = useState(initialGoals?.totalCalories ?? 2450);
  const [protein, setProtein] = useState(initialGoals?.protein ?? 180);
  const [carbs, setCarbs] = useState(initialGoals?.carbs ?? 250);
  const [fats, setFats] = useState(initialGoals?.fats ?? 80);
  const [fiber, setFiber] = useState(initialGoals?.fiber ?? 30);
  const [eatingPhase, setEatingPhase] = useState<'cut' | 'maintain' | 'bulk'>(
    initialGoals?.eatingPhase ?? 'maintain'
  );
  const [targetWeight, setTargetWeight] = useState(initialGoals?.targetWeight ?? 75);
  const [targetBodyFat, setTargetBodyFat] = useState(initialGoals?.targetBodyFat ?? 12);
  const [targetBMI, setTargetBMI] = useState(initialGoals?.targetBMI ?? 23.5);
  const [targetFFMI, setTargetFFMI] = useState(initialGoals?.targetFFMI ?? 21.0);
  const [targetDate, setTargetDate] = useState<number | null>(initialGoals?.targetDate ?? null);
  const [isTargetDatePickerVisible, setIsTargetDatePickerVisible] = useState(false);

  // Call onFormChange whenever form data changes
  useEffect(() => {
    if (onFormChange) {
      onFormChange({
        totalCalories,
        protein,
        carbs,
        fats,
        fiber,
        eatingPhase,
        targetWeight,
        targetBodyFat,
        targetBMI,
        targetFFMI,
        targetDate,
      });
    }
  }, [
    totalCalories,
    protein,
    carbs,
    fats,
    fiber,
    eatingPhase,
    targetWeight,
    targetBodyFat,
    targetBMI,
    targetFFMI,
    targetDate,
    onFormChange,
  ]);

  const handleSave = () => {
    const goals: NutritionGoals = {
      totalCalories,
      protein,
      carbs,
      fats,
      fiber,
      eatingPhase,
      targetWeight,
      targetBodyFat,
      targetBMI,
      targetFFMI,
      targetDate,
    };
    onSave?.(goals);
  };

  // Calculate total calories from macros (protein and carbs are 4 kcal/g, fats are 9 kcal/g, fiber is typically ~2 kcal/g or ignored, but we'll include it for accuracy if needed)
  useEffect(() => {
    // Note: Fiber is often included in total carbs (4kcal/g) or sometimes calculated as 2kcal/g.
    // Most food labels include fiber in the carb count.
    const calculatedCalories = protein * 4 + carbs * 4 + fats * 9 + fiber * 2;
    setTotalCalories(Math.round(calculatedCalories));
  }, [protein, carbs, fats, fiber]);

  // Web-specific ScrollView styles to prevent browser gestures
  const webScrollViewStyle =
    Platform.OS === 'web'
      ? ({
          // Allow vertical scrolling but prevent horizontal browser gestures
          touchAction: 'pan-y',
        } as any)
      : {};

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} style={webScrollViewStyle}>
      <View className="gap-4 px-6 pb-6 pt-2">
        {/* Subtitle */}
        {showSubtitle ? (
          <Text className="mb-2 text-sm text-text-secondary">{t('nutritionGoals.subtitle')}</Text>
        ) : null}

        {/* Total Daily Calories Card */}
        <View
          className="relative mb-6 overflow-hidden rounded-2xl border p-6"
          style={{
            borderColor: theme.colors.border.emerald,
            backgroundColor: theme.colors.background.cardElevated,
          }}
        >
          <LinearGradient
            colors={[theme.colors.status.indigo10, theme.colors.accent.secondary10]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View className="relative z-10 items-center">
            <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
              {t('nutritionGoals.totalDailyCalories')}
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-5xl font-extrabold tracking-tighter text-text-primary">
                {totalCalories.toLocaleString()}
              </Text>
              <Text className="text-lg font-semibold uppercase text-accent-primary">
                {t('food.common.kcal')}
              </Text>
            </View>
          </View>
        </View>

        {/* Eating Phase */}
        <View className="gap-2">
          <Text className="ml-1 text-sm font-medium text-text-secondary">
            {t('editFitnessDetails.eatingPhase')}
          </Text>
          <SegmentedControl
            options={[
              { label: t('editFitnessDetails.cut'), value: 'cut' },
              { label: t('editFitnessDetails.maintain'), value: 'maintain' },
              { label: t('editFitnessDetails.bulk'), value: 'bulk' },
            ]}
            value={eatingPhase}
            onValueChange={(val) => setEatingPhase(val as 'cut' | 'maintain' | 'bulk')}
          />
        </View>

        {/* Daily Macro Targets */}
        <Text
          className="mb-2 mt-8 font-bold uppercase tracking-widest text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('nutritionGoals.dailyMacroTargets')}
        </Text>
        <View className="gap-4">
          <MacroCard
            label={t('nutritionGoals.protein')}
            kcalPerGram={t('nutritionGoals.kcalPerGram.protein')}
            value={protein}
            min={0}
            max={300}
            color={theme.colors.macros.protein.bg}
            onChange={setProtein}
          />
          <MacroCard
            label={t('nutritionGoals.carbohydrates')}
            kcalPerGram={t('nutritionGoals.kcalPerGram.carbs')}
            value={carbs}
            min={0}
            max={500}
            color={theme.colors.macros.carbs.bg}
            onChange={setCarbs}
          />
          <MacroCard
            label={t('nutritionGoals.fats')}
            kcalPerGram={t('nutritionGoals.kcalPerGram.fats')}
            value={fats}
            min={0}
            max={150}
            color={theme.colors.macros.fat.bg}
            onChange={setFats}
          />
          <MacroCard
            label={t('food.macros.fiber')}
            kcalPerGram={t('nutritionGoals.kcalPerGram.fiber')}
            value={fiber}
            min={0}
            max={100}
            color={theme.colors.macros.fiber.bg}
            onChange={setFiber}
          />
        </View>

        {/* Macros Distribution Chart */}
        <MacrosDistributionChart protein={protein} carbs={carbs} fats={fats} fiber={fiber} />

        {/* Target Body Metrics */}
        <Text
          className="mb-2 mt-8 font-bold uppercase tracking-widest text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('nutritionGoals.targetBodyMetrics')}
        </Text>
        <View className="gap-4">
          <StepperInlineInput
            label={t('nutritionGoals.targetWeight')}
            subtitle={t('nutritionGoals.sublabels.targetWeight')}
            value={targetWeight}
            unit="kg"
            icon={showIcons ? Scale : undefined}
            iconSize="sm"
            onIncrement={() => setTargetWeight(Math.min(200, targetWeight + 1))}
            onDecrement={() => setTargetWeight(Math.max(30, targetWeight - 1))}
            onChangeValue={setTargetWeight}
          />
          <StepperInlineInput
            label={t('nutritionGoals.targetBodyFat')}
            subtitle={t('nutritionGoals.sublabels.targetBodyFat')}
            value={targetBodyFat}
            unit="%"
            icon={showIcons ? Percent : undefined}
            iconSize="sm"
            onIncrement={() => setTargetBodyFat(Math.min(50, targetBodyFat + 1))}
            onDecrement={() => setTargetBodyFat(Math.max(5, targetBodyFat - 1))}
            onChangeValue={setTargetBodyFat}
          />
          <StepperInlineInput
            label={t('nutritionGoals.targetBMI')}
            subtitle={t('nutritionGoals.sublabels.targetBMI')}
            value={targetBMI}
            unit="index"
            icon={showIcons ? TrendingUp : undefined}
            iconSize="sm"
            onIncrement={() => setTargetBMI(Math.min(40, targetBMI + 0.1))}
            onDecrement={() => setTargetBMI(Math.max(15, targetBMI - 0.1))}
            onChangeValue={setTargetBMI}
          />
          <StepperInlineInput
            label={t('nutritionGoals.targetFFMI')}
            subtitle={t('nutritionGoals.sublabels.targetFFMI')}
            value={targetFFMI}
            unit="index"
            icon={showIcons ? Activity : undefined}
            iconSize="sm"
            onIncrement={() => setTargetFFMI(Math.min(30, targetFFMI + 0.1))}
            onDecrement={() => setTargetFFMI(Math.max(15, targetFFMI - 0.1))}
            onChangeValue={setTargetFFMI}
          />
          {/* Target date for body metrics */}
          <Pressable
            onPress={() => setIsTargetDatePickerVisible(true)}
            className="flex-row items-center justify-between rounded-xl border border-emerald-900/20 bg-bg-card p-5"
          >
            <View className="flex-1 flex-row items-center gap-3 pr-3">
              {showIcons ? (
                <View
                  className="h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: theme.colors.status.emerald20 }}
                >
                  <Calendar size={theme.iconSize.sm} color={theme.colors.status.emeraldLight} />
                </View>
              ) : null}
              <View className="flex-1">
                <Text className="font-semibold text-white">{t('nutritionGoals.targetDate')}</Text>
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  {t('nutritionGoals.targetDateSublabel')}
                </Text>
              </View>
            </View>
            <View className="flex-shrink flex-row items-center gap-2">
              <Text className="text-text-secondary" numberOfLines={1}>
                {targetDate != null
                  ? format(new Date(targetDate), 'MMM d, yyyy')
                  : t('nutritionGoals.targetDateNotSet')}
              </Text>
              {targetDate != null ? (
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation();
                    setTargetDate(null);
                  }}
                >
                  <Text className="text-xs text-accent-primary">
                    {t('nutritionGoals.targetDateClear')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </View>

        <DatePickerModal
          visible={isTargetDatePickerVisible}
          onClose={() => setIsTargetDatePickerVisible(false)}
          selectedDate={targetDate != null ? new Date(targetDate) : new Date()}
          onDateSelect={(date) => {
            setTargetDate(date.getTime());
            setIsTargetDatePickerVisible(false);
          }}
        />

        {/* Save Button */}
        {showSaveButton ? (
          <View
            className="mt-8 border-t pt-6"
            style={{ borderTopColor: theme.colors.background.white5 }}
          >
            <Button
              label={t('nutritionGoals.saveGoals')}
              icon={ChevronRight}
              iconPosition="right"
              variant="gradientCta"
              size="md"
              width="full"
              onPress={handleSave}
            />
            <Text
              className="mt-4 text-center text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xs }}
            >
              {t('nutritionGoals.settingsNote')}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
