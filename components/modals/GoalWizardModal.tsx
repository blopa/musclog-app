import { addMonths, addWeeks } from 'date-fns';
import { ChevronLeft, Lightbulb, Scale, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { type NutritionGoals } from '@/components/NutritionGoalsBody';
import { Button } from '@/components/theme/Button';
import { StepperInlineInput } from '@/components/theme/StepperInlineInput';
import { type EatingPhase } from '@/database/models';
import { UserMetricService } from '@/database/services';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

type GoalType = 'lose' | 'maintain' | 'gain';
type WizardStepKey = 'goal_type' | 'goal_weight' | 'target_date';

type GoalWizardModalProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: (prefill: Partial<NutritionGoals>) => void;
};

const EATING_PHASE_MAP: Record<GoalType, EatingPhase> = {
  lose: 'cut',
  maintain: 'maintain',
  gain: 'bulk',
};

type GoalOptionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

function GoalOptionCard({ icon, title, description, selected, onPress }: GoalOptionCardProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
          backgroundColor: selected ? theme.colors.accent.primary10 : theme.colors.background.card,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            borderRadius: 12,
            padding: 10,
            backgroundColor: selected
              ? theme.colors.accent.primary20
              : theme.colors.background.secondaryDark,
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.bold,
              color: selected ? theme.colors.accent.primary : theme.colors.text.primary,
              marginBottom: 2,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
            }}
          >
            {description}
          </Text>
        </View>
        {selected ? (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: theme.colors.accent.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#fff',
              }}
            />
          </View>
        ) : (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: theme.colors.border.light,
            }}
          />
        )}
      </View>
    </Pressable>
  );
}

export function GoalWizardModal({ visible, onClose, onComplete }: GoalWizardModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units, weightUnit } = useSettings();

  const defaultWeightDisplay = units === 'imperial' ? 154 : 70;

  // DB state
  const [isLoadingWeight, setIsLoadingWeight] = useState(true);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [hasBodyFatData, setHasBodyFatData] = useState(false);

  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  // Goal weight in display units; initialized from DB weight when available
  const [goalWeightDisplay, setGoalWeightDisplay] = useState(defaultWeightDisplay);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [hasManuallySetTargetDate, setHasManuallySetTargetDate] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Load current weight from DB when modal opens
  useEffect(() => {
    if (!visible) {
      // Reset when closed
      setCurrentStepIndex(0);
      setGoalType(null);
      setGoalWeightDisplay(defaultWeightDisplay);
      setTargetDate(null);
      setHasManuallySetTargetDate(false);
      return;
    }

    setIsLoadingWeight(true);
    Promise.all([
      UserMetricService.getUserBodyWeightKgForVolume(),
      UserMetricService.getLatest('body_fat'),
    ])
      .then(([kg, bodyFatMetric]) => {
        if (kg > 0) {
          setCurrentWeightKg(kg);
          setGoalWeightDisplay(Math.round(kgToDisplay(kg, units) * 10) / 10);
        } else {
          setCurrentWeightKg(null);
          setGoalWeightDisplay(defaultWeightDisplay);
        }
        setHasBodyFatData(bodyFatMetric !== null);
      })
      .catch(() => {
        setCurrentWeightKg(null);
        setHasBodyFatData(false);
        setGoalWeightDisplay(defaultWeightDisplay);
      })
      .finally(() => setIsLoadingWeight(false));
  }, [visible, units, defaultWeightDisplay]);

  // Steps: goal_type → goal_weight (only if lose/gain) → target_date
  const steps = useMemo<WizardStepKey[]>(() => {
    const s: WizardStepKey[] = ['goal_type'];
    if (goalType && goalType !== 'maintain') {
      s.push('goal_weight');
    }
    s.push('target_date');
    return s;
  }, [goalType]);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const progress = (currentStepIndex + 1) / steps.length;

  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 'goal_type':
        return goalType !== null;
      case 'goal_weight':
        return goalWeightDisplay > 0;
      case 'target_date':
        return targetDate !== null;
      default:
        return true;
    }
  }, [currentStep, goalType, goalWeightDisplay, targetDate]);

  // Estimate how many weeks the goal will take based on weight delta and available data.
  // Lose: 0.75% of body weight/week (midpoint of 0.5–1%) if BF data exists; else 0.5 kg/week.
  // Gain: 0.25 kg/week (conservative lean-bulk rate).
  const calculateEstimatedTargetDate = (weightDisplay: number = goalWeightDisplay): Date | null => {
    if (!goalType || goalType === 'maintain' || !currentWeightKg) {
      return null;
    }

    const goalWeightKg = displayToKg(weightDisplay, units);
    const weightDeltaKg = Math.abs(goalWeightKg - currentWeightKg);
    if (weightDeltaKg <= 0) {
      return null;
    }

    let weeklyRateKg: number;
    if (goalType === 'lose') {
      weeklyRateKg = hasBodyFatData
        ? currentWeightKg * 0.0075 // 0.75% of body weight — midpoint of 0.5–1%
        : 0.5;
    } else {
      weeklyRateKg = 0.25; // conservative lean-bulk rate
    }

    const weeksNeeded = Math.ceil(weightDeltaKg / Math.max(weeklyRateKg, 0.01));
    return addWeeks(new Date(), weeksNeeded);
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = steps[currentStepIndex + 1];
      // Auto-fill target date when transitioning to target_date if not manually set
      if (nextStep === 'target_date' && targetDate === null && !hasManuallySetTargetDate) {
        const estimated = calculateEstimatedTargetDate();
        if (estimated) {
          setTargetDate(estimated);
        }
      }
      setCurrentStepIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (isFirstStep) {
      onClose();
    } else {
      setCurrentStepIndex((i) => i - 1);
    }
  };

  const handleComplete = () => {
    const gType = goalType ?? 'maintain';
    const eatingPhase = EATING_PHASE_MAP[gType];

    const targetWeightKg = gType !== 'maintain' ? displayToKg(goalWeightDisplay, units) : null;

    const prefill: Partial<NutritionGoals> = {
      eatingPhase,
      targetWeight: targetWeightKg,
      targetDate: targetDate ? targetDate.getTime() : null,
    };

    onComplete(prefill);
  };

  const renderStepTitle = () => {
    if (currentStep === 'goal_weight') {
      return (
        <Text
          style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.primary,
            marginBottom: 6,
            lineHeight: 36,
          }}
        >
          {t('goalsManagement.goalWizard.goalWeight.titleMain')}{' '}
          <Text style={{ color: theme.colors.accent.primary }}>
            {t('goalsManagement.goalWizard.goalWeight.titleAccent')}
          </Text>
        </Text>
      );
    }

    const stepMeta: Record<WizardStepKey, string> = {
      goal_type: t('goalsManagement.goalWizard.goalType.title'),
      goal_weight: '',
      target_date: t('goalsManagement.goalWizard.targetDate.title'),
    };

    return (
      <Text
        style={{
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.primary,
          marginBottom: 6,
        }}
      >
        {stepMeta[currentStep]}
      </Text>
    );
  };

  const stepSubtitles: Record<WizardStepKey, string> = {
    goal_type: t('goalsManagement.goalWizard.goalType.subtitle'),
    goal_weight: t('goalsManagement.goalWizard.goalWeight.subtitle'),
    target_date: t('goalsManagement.goalWizard.targetDate.subtitle'),
  };

  const renderGoalTypeStep = () => (
    <View style={{ gap: 12 }}>
      <GoalOptionCard
        selected={goalType === 'lose'}
        onPress={() => setGoalType('lose')}
        icon={
          <TrendingDown
            size={theme.iconSize.md}
            color={goalType === 'lose' ? theme.colors.accent.primary : theme.colors.text.secondary}
          />
        }
        title={t('goalsManagement.goalWizard.goalType.lose')}
        description={t('goalsManagement.goalWizard.goalType.loseDescription')}
      />
      <GoalOptionCard
        selected={goalType === 'maintain'}
        onPress={() => setGoalType('maintain')}
        icon={
          <Scale
            size={theme.iconSize.md}
            color={
              goalType === 'maintain' ? theme.colors.accent.primary : theme.colors.text.secondary
            }
          />
        }
        title={t('goalsManagement.goalWizard.goalType.maintain')}
        description={t('goalsManagement.goalWizard.goalType.maintainDescription')}
      />
      <GoalOptionCard
        selected={goalType === 'gain'}
        onPress={() => setGoalType('gain')}
        icon={
          <TrendingUp
            size={theme.iconSize.md}
            color={goalType === 'gain' ? theme.colors.accent.primary : theme.colors.text.secondary}
          />
        }
        title={t('goalsManagement.goalWizard.goalType.gain')}
        description={t('goalsManagement.goalWizard.goalType.gainDescription')}
      />
    </View>
  );

  const renderGoalWeightStep = () => {
    const currentWeightDisplay =
      currentWeightKg !== null ? Math.round(kgToDisplay(currentWeightKg, units) * 10) / 10 : null;

    const tipKey =
      goalType === 'gain'
        ? 'goalsManagement.goalWizard.goalWeight.tipGain'
        : 'goalsManagement.goalWizard.goalWeight.tipLoseBF';

    return (
      <View style={{ gap: 16 }}>
        {/* Current weight reference row */}
        {currentWeightDisplay !== null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
              backgroundColor: theme.colors.background.secondaryDark,
              paddingHorizontal: 18,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.secondary,
              }}
            >
              {t('goalsManagement.goalWizard.goalWeight.currentWeightLabel')}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
              }}
            >
              {currentWeightDisplay}{' '}
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.normal,
                  color: theme.colors.text.secondary,
                }}
              >
                {weightUnit}
              </Text>
            </Text>
          </View>
        ) : null}

        {/* Goal weight stepper */}
        <View
          style={{
            borderRadius: 16,
            backgroundColor: theme.colors.background.card,
            borderWidth: 1,
            borderColor: theme.colors.border.light,
            overflow: 'hidden',
          }}
        >
          <StepperInlineInput
            label={t('goalsManagement.goalWizard.goalWeight.label')}
            value={goalWeightDisplay}
            onIncrement={() =>
              setGoalWeightDisplay((v) => Math.min(500, Math.round((v + 0.5) * 10) / 10))
            }
            onDecrement={() =>
              setGoalWeightDisplay((v) => Math.max(20, Math.round((v - 0.5) * 10) / 10))
            }
            onChangeValue={(v) => setGoalWeightDisplay(Math.max(20, v))}
            unit={weightUnit}
            step={0.5}
            maxFractionDigits={1}
          />
        </View>

        {/* Tip card */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            borderRadius: 14,
            backgroundColor: theme.colors.background.secondaryDark,
            borderWidth: 1,
            borderColor: theme.colors.border.light,
            paddingHorizontal: 14,
            paddingVertical: 14,
            marginTop: 4,
          }}
        >
          <View
            style={{
              borderRadius: 8,
              padding: 6,
              backgroundColor: theme.colors.accent.primary20,
              marginTop: 1,
            }}
          >
            <Lightbulb size={theme.iconSize.sm} color={theme.colors.accent.primary} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
              lineHeight: 20,
            }}
          >
            {t(tipKey)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTargetDateStep = () => {
    const estimatedDate = calculateEstimatedTargetDate();
    const displayDate = targetDate ?? estimatedDate ?? addMonths(new Date(), 3);

    return (
      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <Text className="text-text-secondary text-xs font-bold tracking-wider uppercase">
            {t('goalsManagement.goalWizard.targetDate.label')}
          </Text>
        </View>

        <DatePickerInput
          selectedDate={displayDate}
          onPress={() => setDatePickerVisible(true)}
          onClear={() => setTargetDate(null)}
          hideLabel
          variant="default"
          unset={targetDate === null}
          unsetPlaceholder={t('goalsManagement.goalWizard.targetDate.notSet')}
          dateDisplay="single-line"
          showClearButton
        />

        <DatePickerModal
          visible={datePickerVisible}
          onClose={() => setDatePickerVisible(false)}
          selectedDate={displayDate}
          onDateSelect={(date) => {
            setTargetDate(date);
            setHasManuallySetTargetDate(true);
            setDatePickerVisible(false);
          }}
          minYear={new Date().getFullYear()}
          maxYear={new Date().getFullYear() + 10}
          quickDates={[
            {
              label: t('common.oneMonthFromNow'),
              date: addMonths(new Date(), 1),
            },
            {
              label: t('common.monthsFromNow', { count: 3 }),
              date: addMonths(new Date(), 3),
            },
            {
              label: t('common.monthsFromNow', { count: 6 }),
              date: addMonths(new Date(), 6),
            },
          ]}
        />
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'goal_type':
        return renderGoalTypeStep();
      case 'goal_weight':
        return renderGoalWeightStep();
      case 'target_date':
        return renderTargetDateStep();
      default:
        return null;
    }
  };

  const footer = (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Button
        label={isFirstStep ? t('common.cancel') : t('goalsManagement.goalWizard.back')}
        variant="outline"
        size="md"
        width="flex-1"
        icon={isFirstStep ? undefined : ChevronLeft}
        iconPosition="left"
        onPress={handleBack}
      />
      <Button
        label={t('goalsManagement.goalWizard.next')}
        variant="gradientCta"
        size="md"
        width="flex-1"
        disabled={!canAdvance}
        onPress={handleNext}
      />
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('goalsManagement.goalWizard.title')}
      scrollable={false}
      footer={footer}
    >
      {isLoadingWeight ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        >
          {/* Progress bar */}
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.border.light,
              marginBottom: 28,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.accent.primary,
                width: `${progress * 100}%`,
              }}
            />
          </View>

          {/* Step indicator */}
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.accent.primary,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            {t('goalsManagement.goalWizard.step', {
              current: currentStepIndex + 1,
              total: steps.length,
            })}
          </Text>

          {/* Step title — two-color for goal_weight, plain for others */}
          {renderStepTitle()}

          {/* Step subtitle */}
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
              marginBottom: 32,
              lineHeight: 20,
            }}
          >
            {stepSubtitles[currentStep]}
          </Text>

          {/* Step content */}
          {renderStepContent()}
        </ScrollView>
      )}
    </FullScreenModal>
  );
}
