import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Activity, Calendar, ChevronRight, Percent, Scale, TrendingUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { type EatingPhase } from '../database/models';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import i18n from '../lang/lang';
import { displayToKg, kgToDisplay } from '../utils/unitConversion';
import { DatePickerModal } from './modals/DatePickerModal';
import { Button } from './theme/Button';
import { MacrosPizzaChart } from './theme/MacrosPizzaChart';
import { SegmentedControl } from './theme/SegmentedControl';
import { StepperInlineInput } from './theme/StepperInlineInput';

export type NutritionGoals = {
  totalCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  eatingPhase: EatingPhase;
  targetWeight: number;
  targetBodyFat: number;
  targetBMI: number;
  targetFFMI: number;
  targetDate?: number | null;
  goalStartDate?: number | null;
};

type NutritionGoalsModalBodyProps = {
  onSave?: (goals: NutritionGoals) => void;
  onFormChange?: (goals: NutritionGoals) => void;
  initialGoals?: Partial<NutritionGoals>;
  showSaveButton?: boolean;
  showSubtitle?: boolean;
  showGoalStartDate?: boolean;
};

function getMacroInsight(
  proteinPercentage: number,
  carbsPercentage: number,
  fatsPercentage: number
) {
  // Keto: Very low carbs (5-15%), high fat (55-65%), moderate protein (25-35%)
  if (carbsPercentage <= 15 && fatsPercentage >= 55 && fatsPercentage <= 65) {
    return {
      title: i18n.t('nutritionGoals.dietTypes.keto.title'),
      subtitle: i18n.t('nutritionGoals.dietTypes.keto.subtitle'),
    };
  }

  // Low Carb: Low carbs (10-25%), higher fat (45-60%)
  if (carbsPercentage <= 25 && carbsPercentage > 15 && fatsPercentage >= 45) {
    return {
      title: i18n.t('nutritionGoals.dietTypes.lowCarb.title'),
      subtitle: i18n.t('nutritionGoals.dietTypes.lowCarb.subtitle'),
    };
  }

  // High Protein: 35%+ protein
  if (proteinPercentage >= 35) {
    if (carbsPercentage >= 40) {
      return {
        title: i18n.t('nutritionGoals.dietTypes.highProteinMuscle.title'),
        subtitle: i18n.t('nutritionGoals.dietTypes.highProteinMuscle.subtitle'),
      };
    } else {
      return {
        title: i18n.t('nutritionGoals.dietTypes.highProteinFatLoss.title'),
        subtitle: i18n.t('nutritionGoals.dietTypes.highProteinFatLoss.subtitle'),
      };
    }
  }

  // High Carb: 50%+ carbs
  if (carbsPercentage >= 50) {
    return {
      title: i18n.t('nutritionGoals.dietTypes.highCarb.title'),
      subtitle: i18n.t('nutritionGoals.dietTypes.highCarb.subtitle'),
    };
  }

  // Balanced: More flexible range around balanced macros
  if (
    carbsPercentage >= 30 &&
    carbsPercentage <= 50 &&
    proteinPercentage >= 25 &&
    proteinPercentage <= 40 &&
    fatsPercentage >= 20 &&
    fatsPercentage <= 40
  ) {
    return {
      title: i18n.t('nutritionGoals.dietTypes.balanced.title'),
      subtitle: i18n.t('nutritionGoals.dietTypes.balanced.subtitle'),
    };
  }

  // Moderate Fat: Higher fat (40-50%), moderate protein/carbs
  if (fatsPercentage >= 40 && fatsPercentage <= 50) {
    return {
      title: i18n.t('nutritionGoals.dietTypes.moderateFat.title'),
      subtitle: i18n.t('nutritionGoals.dietTypes.moderateFat.subtitle'),
    };
  }

  // Low Fat: Low fat (<20%), higher protein/carbs
  if (fatsPercentage < 20) {
    return {
      title: i18n.t('nutritionGoals.dietTypes.lowFat.title'),
      subtitle: i18n.t('nutritionGoals.dietTypes.lowFat.subtitle'),
    };
  }

  // Default/Fallback
  return {
    title: i18n.t('nutritionGoals.dietTypes.custom.title'),
    subtitle: i18n.t('nutritionGoals.dietTypes.custom.subtitle'),
  };
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
  const theme = useTheme();
  const { t } = useTranslation();
  const total = protein + carbs + fats; // Exclude fiber from macro total
  const fiberTotal = total + fiber; // Include fiber for display percentages
  const proteinPercentage = total > 0 ? (protein / total) * 100 : 0;
  const carbsPercentage = total > 0 ? (carbs / total) * 100 : 0;
  const fatsPercentage = total > 0 ? (fats / total) * 100 : 0;
  const fiberPercentage = fiberTotal > 0 ? (fiber / fiberTotal) * 100 : 0;

  const macroInsight = getMacroInsight(proteinPercentage, carbsPercentage, fatsPercentage);

  return (
    <View className="items-center py-10">
      <Text className="mb-6 text-sm font-semibold uppercase tracking-widest text-text-secondary opacity-60">
        {t('nutritionGoals.macrosDistribution')}
      </Text>

      <MacrosPizzaChart
        protein={protein}
        carbs={carbs}
        fats={fats}
        fiber={fiber}
        insightMessage={macroInsight}
      />

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
  showGoalStartDate = false,
}: NutritionGoalsModalBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const { units } = useSettings();
  const showIcons = screenWidth >= 415;
  const defaultTargetWeightKg = 75;
  const [totalCalories, setTotalCalories] = useState(initialGoals?.totalCalories ?? 2450);
  const [protein, setProtein] = useState(initialGoals?.protein ?? 180);
  const [carbs, setCarbs] = useState(initialGoals?.carbs ?? 250);
  const [fats, setFats] = useState(initialGoals?.fats ?? 80);
  const [fiber, setFiber] = useState(initialGoals?.fiber ?? 30);
  const [eatingPhase, setEatingPhase] = useState<EatingPhase>(
    initialGoals?.eatingPhase ?? 'maintain'
  );
  const [targetWeight, setTargetWeight] = useState(
    initialGoals?.targetWeight != null
      ? kgToDisplay(initialGoals.targetWeight, units)
      : kgToDisplay(defaultTargetWeightKg, units)
  );
  const [targetBodyFat, setTargetBodyFat] = useState(initialGoals?.targetBodyFat ?? 12);
  const [targetBMI, setTargetBMI] = useState(initialGoals?.targetBMI ?? 23.5);
  const [targetFFMI, setTargetFFMI] = useState(initialGoals?.targetFFMI ?? 21.0);
  const [targetDate, setTargetDate] = useState<number | null>(initialGoals?.targetDate ?? null);
  const [goalStartDate, setGoalStartDate] = useState<number | null>(
    initialGoals?.goalStartDate ?? null
  );
  const [isTargetDatePickerVisible, setIsTargetDatePickerVisible] = useState(false);
  const [isGoalStartDatePickerVisible, setIsGoalStartDatePickerVisible] = useState(false);
  const isInitialMount = useRef(true);

  // Dynamically compute sensible max values for macros depending on eating phase
  const macroMax = useMemo(() => {
    switch (eatingPhase) {
      case 'cut':
        return {
          protein: 400,
          carbs: 350,
          fats: 150,
          fiber: 80,
        };
      case 'bulk':
        return {
          protein: 800,
          carbs: 1000,
          fats: 600,
          fiber: 200,
        };
      case 'maintain':
      default:
        return {
          protein: 600,
          carbs: 800,
          fats: 600,
          fiber: 200,
        };
    }
  }, [eatingPhase]);

  // Sync targetWeight from initialGoals when it or units change (e.g. modal opened with saved goal)
  useEffect(() => {
    if (initialGoals?.targetWeight != null) {
      setTargetWeight(kgToDisplay(initialGoals.targetWeight, units));
    }
  }, [initialGoals?.targetWeight, units]);

  // If the eating phase changes to a lower-max (e.g. bulk -> cut), clamp current macro values
  // so they never exceed the allowed maximum for the selected phase.
  useEffect(() => {
    setProtein((curr) => Math.min(curr, macroMax.protein));
    setCarbs((curr) => Math.min(curr, macroMax.carbs));
    setFats((curr) => Math.min(curr, macroMax.fats));
    setFiber((curr) => Math.min(curr, macroMax.fiber));
  }, [macroMax.protein, macroMax.carbs, macroMax.fats, macroMax.fiber]);

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
        goalStartDate,
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
    goalStartDate,
    onFormChange,
  ]);

  const handleSave = useCallback(() => {
    onSave?.({
      totalCalories,
      protein,
      carbs,
      fats,
      fiber,
      eatingPhase,
      targetWeight: displayToKg(targetWeight, units),
      targetBodyFat,
      targetBMI,
      targetFFMI,
      targetDate,
      goalStartDate,
    } as NutritionGoals);
  }, [
    carbs,
    eatingPhase,
    fats,
    fiber,
    goalStartDate,
    onSave,
    protein,
    targetBMI,
    targetBodyFat,
    targetDate,
    targetFFMI,
    targetWeight,
    totalCalories,
    units,
  ]);

  // Calculate total calories from macros (protein and carbs are 4 kcal/g, fats are 9 kcal/g, fiber is typically ~2 kcal/g or ignored, but we'll include it for accuracy if needed)
  // Skip recalculation on initial mount when initialGoals is provided to preserve the plan's targetCalories.
  useEffect(() => {
    if (isInitialMount.current && initialGoals?.totalCalories != null) {
      isInitialMount.current = false;
      return;
    }
    isInitialMount.current = false;
    // Note: Fiber is often included in the total carbs (4kcal/g) or sometimes calculated as 2kcal/g.
    // Most food labels include fiber in the carb count.
    const calculatedCalories = protein * 4 + carbs * 4 + fats * 9 + fiber * 2;
    setTotalCalories(Math.round(calculatedCalories));
  }, [protein, carbs, fats, fiber, initialGoals?.totalCalories]);

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
            onValueChange={(val) => setEatingPhase(val as EatingPhase)}
          />
        </View>

        {/* Goal Start Date (only shown in create mode) */}
        {showGoalStartDate ? (
          <Pressable
            onPress={() => setIsGoalStartDatePickerVisible(true)}
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
                <Text className="font-semibold text-white">
                  {t('nutritionGoals.goalStartDate')}
                </Text>
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  {t('nutritionGoals.goalStartDateSublabel')}
                </Text>
              </View>
            </View>
            <View className="flex-shrink flex-row items-center gap-2">
              <Text className="text-text-secondary" numberOfLines={1}>
                {goalStartDate != null
                  ? format(new Date(goalStartDate), 'MMM d, yyyy')
                  : t('nutritionGoals.goalStartDateToday')}
              </Text>
              {goalStartDate != null ? (
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation();
                    setGoalStartDate(null);
                  }}
                >
                  <Text className="text-xs text-accent-primary">
                    {t('nutritionGoals.targetDateClear')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        ) : null}

        {isGoalStartDatePickerVisible ? (
          <DatePickerModal
            visible={isGoalStartDatePickerVisible}
            onClose={() => setIsGoalStartDatePickerVisible(false)}
            selectedDate={goalStartDate != null ? new Date(goalStartDate) : new Date()}
            onDateSelect={(date) => {
              setGoalStartDate(date.getTime());
              setIsGoalStartDatePickerVisible(false);
            }}
          />
        ) : null}

        {/* Daily Macro Targets */}
        <Text
          className="mb-2 mt-8 font-bold uppercase tracking-widest text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('nutritionGoals.dailyMacroTargets')}
        </Text>
        <View className="gap-4">
          {/*TODO: add an icon for protein*/}
          <StepperInlineInput
            label={t('nutritionGoals.protein')}
            subtitle={t('nutritionGoals.kcalPerGram.protein')}
            value={protein}
            unit="g"
            onIncrement={() => setProtein(Math.min(macroMax.protein, protein + 1))}
            onDecrement={() => setProtein(Math.max(0, protein - 1))}
            onChangeValue={setProtein}
          />
          {/*TODO: add an icon for carbs*/}
          <StepperInlineInput
            label={t('nutritionGoals.carbohydrates')}
            subtitle={t('nutritionGoals.kcalPerGram.carbs')}
            value={carbs}
            unit="g"
            onIncrement={() => setCarbs(Math.min(macroMax.carbs, carbs + 1))}
            onDecrement={() => setCarbs(Math.max(0, carbs - 1))}
            onChangeValue={setCarbs}
          />
          {/*TODO: add an icon for fats*/}
          <StepperInlineInput
            label={t('nutritionGoals.fats')}
            subtitle={t('nutritionGoals.kcalPerGram.fats')}
            value={fats}
            unit="g"
            onIncrement={() => setFats(Math.min(macroMax.fats, fats + 1))}
            onDecrement={() => setFats(Math.max(0, fats - 1))}
            onChangeValue={setFats}
          />
          {/*TODO: add an icon for fiber*/}
          <StepperInlineInput
            label={t('food.macros.fiber')}
            subtitle={t('nutritionGoals.kcalPerGram.fiber')}
            value={fiber}
            unit="g"
            onIncrement={() => setFiber(Math.min(macroMax.fiber, fiber + 1))}
            onDecrement={() => setFiber(Math.max(0, fiber - 1))}
            onChangeValue={setFiber}
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
            unit={units === 'metric' ? 'kg' : 'lbs'}
            icon={showIcons ? Scale : undefined}
            iconSize="sm"
            onIncrement={() =>
              setTargetWeight(
                Math.min(kgToDisplay(200, units), Math.round((targetWeight + 1) * 10) / 10)
              )
            }
            onDecrement={() =>
              setTargetWeight(
                Math.max(kgToDisplay(30, units), Math.round((targetWeight - 1) * 10) / 10)
              )
            }
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

        {isTargetDatePickerVisible ? (
          <DatePickerModal
            visible={isTargetDatePickerVisible}
            onClose={() => setIsTargetDatePickerVisible(false)}
            selectedDate={targetDate != null ? new Date(targetDate) : new Date()}
            onDateSelect={(date) => {
              setTargetDate(date.getTime());
              setIsTargetDatePickerVisible(false);
            }}
          />
        ) : null}

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
