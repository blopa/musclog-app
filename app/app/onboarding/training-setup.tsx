import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Activity,
  Check,
  Dumbbell,
  Home,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react-native';
import { type ComponentType, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { MaybeLaterButton } from '@/components/MaybeLaterButton';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { TRAINING_SETUP_DATA } from '@/constants/misc';
import type { WorkoutAutonomy } from '@/constants/settings';
import type { LiftingExperience } from '@/database/models/User';
import { useTheme } from '@/hooks/useTheme';
import { BREAK_LENGTH_LABEL_KEYS } from '@/utils/comeback/comebackCopy';
import { BREAK_LENGTHS, type BreakLength } from '@/utils/comeback/comebackState';
import {
  DEFAULT_TRAINING_DAYS,
  parseTrainingSetup,
  TRAINING_DAYS_OPTIONS,
  type TrainingLocation,
  type TrainingSetupData,
} from '@/utils/onboardingTraining';

type Mode = 'quick' | 'personalized';

type CardOption<T extends string> = {
  value: T;
  labelKey: string;
  descKey: string;
  icon: ComponentType<{ size?: number; color?: string }>;
};

const LOCATION_OPTIONS: CardOption<TrainingLocation>[] = [
  {
    value: 'gym',
    labelKey: 'onboarding.trainingSetup.location.gym',
    descKey: 'onboarding.trainingSetup.location.gymDesc',
    icon: Dumbbell,
  },
  {
    value: 'home',
    labelKey: 'onboarding.trainingSetup.location.home',
    descKey: 'onboarding.trainingSetup.location.homeDesc',
    icon: Home,
  },
  {
    value: 'minimal',
    labelKey: 'onboarding.trainingSetup.location.minimal',
    descKey: 'onboarding.trainingSetup.location.minimalDesc',
    icon: Activity,
  },
];

const AUTONOMY_OPTIONS: CardOption<WorkoutAutonomy>[] = [
  {
    value: 'suggest',
    labelKey: 'onboarding.trainingSetup.help.suggest',
    descKey: 'onboarding.trainingSetup.help.suggestDesc',
    icon: TrendingUp,
  },
  {
    value: 'manual',
    labelKey: 'onboarding.trainingSetup.help.manual',
    descKey: 'onboarding.trainingSetup.help.manualDesc',
    icon: SlidersHorizontal,
  },
];

const EXPERIENCE_VALUES: LiftingExperience[] = ['beginner', 'intermediate', 'advanced'];

/**
 * The one training screen shared by the quick and the personalized setup. It only collects: the
 * gym profile and the load-suggestion setting are written when the nutrition plan is accepted
 * (`applyTrainingSetup`), so stepping back and forth here never creates duplicates.
 */
export default function TrainingSetupScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    nextRoute?: string;
    quickStep?: string;
    quickTotal?: string;
  }>();

  const mode: Mode = params.mode === 'personalized' ? 'personalized' : 'quick';
  const defaultNextRoute =
    mode === 'quick' ? '/app/onboarding/quick-goals' : '/app/onboarding/personalized-experience';
  const nextRoute = params.nextRoute ? decodeURIComponent(params.nextRoute) : defaultNextRoute;
  const step = params.quickStep ? Number(params.quickStep) : 2;
  const defaultTotal = mode === 'quick' ? 7 : 10;
  const total = params.quickTotal ? Number(params.quickTotal) : defaultTotal;

  const [location, setLocation] = useState<TrainingLocation>('gym');
  const [experience, setExperience] = useState<LiftingExperience>('beginner');
  const [days, setDays] = useState<number>(DEFAULT_TRAINING_DAYS);
  const [autonomy, setAutonomy] = useState<WorkoutAutonomy>('suggest');
  const [comingBack, setComingBack] = useState(false);
  const [breakLength, setBreakLength] = useState<BreakLength>('1to3m');
  const [isSaving, setIsSaving] = useState(false);

  // Come back to what was answered before (here earlier, or in the AI setup) rather than defaults.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(TRAINING_SETUP_DATA).then((raw) => {
      const saved = parseTrainingSetup(raw);
      if (cancelled || !saved) {
        return;
      }

      setLocation(saved.location);
      setDays(saved.daysPerWeek);
      setAutonomy(saved.autonomy);
      if (saved.experience) {
        setExperience(saved.experience);
      }

      if (saved.comingBack) {
        setComingBack(true);
        setBreakLength(saved.comingBack.breakLength);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      const data: TrainingSetupData = {
        location,
        experience: mode === 'quick' ? experience : undefined,
        daysPerWeek: days,
        autonomy,
        ...(comingBack ? { comingBack: { breakLength } } : {}),
      };
      await AsyncStorage.setItem(TRAINING_SETUP_DATA, JSON.stringify(data));
      router.navigate(nextRoute as never);
    } catch (e) {
      console.error('Error saving training setup:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.removeItem(TRAINING_SETUP_DATA);
    } catch (e) {
      console.error('Error clearing training setup:', e);
    }

    router.navigate(nextRoute as never);
  };

  const renderCards = <T extends string>(
    options: CardOption<T>[],
    selected: T,
    onSelect: (value: T) => void
  ) => (
    <View className="gap-3">
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        const Icon = opt.icon;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            style={{
              backgroundColor: theme.colors.background.cardElevated,
              borderRadius: theme.borderRadius.xl,
              borderWidth: 1.5,
              borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon
              size={22}
              color={isSelected ? theme.colors.accent.primary : theme.colors.text.secondary}
            />
            <View className="flex-1">
              <Text
                className="font-semibold"
                style={{
                  color: isSelected ? theme.colors.accent.primary : theme.colors.text.primary,
                  fontSize: theme.typography.fontSize.base,
                }}
              >
                {t(opt.labelKey)}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {t(opt.descKey)}
              </Text>
            </View>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
                backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected ? <Check size={13} color={theme.colors.text.primary} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const sectionLabel = (key: string) => (
    <Text className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
      {t(key).toUpperCase()}
    </Text>
  );

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={step} total={total} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6">
            <Text className="mb-1 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
              {t('onboarding.trainingSetup.title')}
            </Text>
            <Text
              className="mb-8"
              style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
            >
              {t('onboarding.trainingSetup.subtitle')}
            </Text>

            <View className="mb-8 gap-3">
              {sectionLabel('onboarding.trainingSetup.locationLabel')}
              {renderCards(LOCATION_OPTIONS, location, setLocation)}
            </View>

            {mode === 'quick' ? (
              <View className="mb-8 gap-3">
                {sectionLabel('onboarding.trainingSetup.experienceLabel')}
                <SegmentedControl
                  options={EXPERIENCE_VALUES.map((value) => ({
                    value,
                    label: t(`onboarding.trainingSetup.experience.${value}`),
                  }))}
                  value={experience}
                  onValueChange={(v) => setExperience(v as LiftingExperience)}
                  variant="gradient"
                />
              </View>
            ) : null}

            <View className="mb-8 gap-3">
              {sectionLabel('onboarding.trainingSetup.daysLabel')}
              <SegmentedControl
                options={TRAINING_DAYS_OPTIONS.map((value) => ({
                  value: String(value),
                  label:
                    value === TRAINING_DAYS_OPTIONS[TRAINING_DAYS_OPTIONS.length - 1]
                      ? t('onboarding.trainingSetup.daysMax', { count: value })
                      : String(value),
                }))}
                value={String(days)}
                onValueChange={(v) => setDays(Number(v))}
                variant="gradient"
              />
            </View>

            <View className="mb-8 gap-3">
              {sectionLabel('onboarding.trainingSetup.comingBackLabel')}
              <ToggleInput
                items={[
                  {
                    key: 'coming-back',
                    label: t('onboarding.trainingSetup.comingBack'),
                    subtitle: t('onboarding.trainingSetup.comingBackDesc'),
                    value: comingBack,
                    onValueChange: setComingBack,
                  },
                ]}
              />
              {comingBack ? (
                <View className="gap-2">
                  <Text
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.fontSize.sm,
                    }}
                  >
                    {t('onboarding.trainingSetup.breakLengthLabel')}
                  </Text>
                  {BREAK_LENGTHS.map((value) => (
                    <ListRow
                      key={value}
                      title={t(BREAK_LENGTH_LABEL_KEYS[value])}
                      selected={breakLength === value}
                      onPress={() => setBreakLength(value)}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            <View className="mb-4 gap-3">
              {sectionLabel('onboarding.trainingSetup.helpLabel')}
              {renderCards(AUTONOMY_OPTIONS, autonomy, setAutonomy)}
            </View>

            <Text
              style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs }}
            >
              {t('onboarding.trainingSetup.changeLater')}
            </Text>
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('onboarding.trainingSetup.continue')}
            onPress={handleContinue}
            variant="gradientCta"
            size="md"
            width="full"
            disabled={isSaving}
            loading={isSaving}
          />
          <MaybeLaterButton onPress={handleSkip} text={t('onboarding.trainingSetup.skip')} />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
