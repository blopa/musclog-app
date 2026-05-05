import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  Check,
  Dumbbell,
  Equal,
  Flame,
  Heart,
  LucideIcon,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { PERSONALIZED_SETUP_DATA } from '@/constants/misc';
import { type FitnessGoal, type WeightGoal } from '@/database/models/User';
import { useTheme } from '@/hooks/useTheme';
import { setCurrentOnboardingStep } from '@/utils/onboardingService';

type FitnessOption = {
  value: FitnessGoal;
  labelKey: string;
  icon: LucideIcon;
};

const FITNESS_OPTIONS: FitnessOption[] = [
  { value: 'hypertrophy', labelKey: 'onboarding.quickGoals.buildMuscle', icon: Dumbbell },
  { value: 'strength', labelKey: 'onboarding.quickGoals.strength', icon: Zap },
  { value: 'endurance', labelKey: 'onboarding.quickGoals.endurance', icon: Flame },
  { value: 'general', labelKey: 'onboarding.quickGoals.general', icon: Heart },
];

type WeightOption = {
  value: WeightGoal;
  labelKey: string;
  icon: LucideIcon;
};

const WEIGHT_OPTIONS: WeightOption[] = [
  { value: 'lose', labelKey: 'onboarding.quickGoals.lose', icon: TrendingDown },
  { value: 'maintain', labelKey: 'onboarding.quickGoals.maintain', icon: Equal },
  { value: 'gain', labelKey: 'onboarding.quickGoals.gain', icon: TrendingUp },
];

export default function PersonalizedGoalsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>('general');
  const [weightGoal, setWeightGoal] = useState<WeightGoal>('maintain');
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      const existing = await AsyncStorage.getItem(PERSONALIZED_SETUP_DATA);
      const current = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem(
        PERSONALIZED_SETUP_DATA,
        JSON.stringify({ ...current, fitnessGoal, weightGoal })
      );

      await setCurrentOnboardingStep('/app/onboarding/personalized-goals');
      router.navigate('/app/onboarding/personalized-body-stats');
    } catch (e) {
      console.error('Error saving personalized goals:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={4} total={9} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6">
            <Text
              className="mb-1 text-3xl font-black tracking-tight"
              style={{ color: theme.colors.text.white }}
            >
              {t('onboarding.quickGoals.title')}
            </Text>
            <Text
              className="mb-8"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {t('onboarding.quickGoals.subtitle')}
            </Text>

            {/* Fitness Focus */}
            <View className="mb-8 gap-3">
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: theme.colors.text.tertiary }}
              >
                {t('onboarding.quickGoals.fitnessFocus').toUpperCase()}
              </Text>

              <View className="flex-row flex-wrap gap-3">
                {FITNESS_OPTIONS.map((opt) => {
                  const isSelected = fitnessGoal === opt.value;
                  const iconColor = isSelected
                    ? theme.colors.accent.primary
                    : theme.colors.text.secondary;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setFitnessGoal(opt.value)}
                      style={{
                        width: '47%',
                        backgroundColor: theme.colors.background.cardElevated,
                        borderRadius: theme.borderRadius.xl,
                        borderWidth: 1.5,
                        borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <View className="flex-row items-center gap-2">
                        <opt.icon size={18} color={iconColor} />
                        <Text
                          className="font-semibold"
                          style={{
                            color: isSelected
                              ? theme.colors.accent.primary
                              : theme.colors.text.primary,
                            fontSize: theme.typography.fontSize.sm,
                          }}
                        >
                          {t(opt.labelKey)}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.border.light,
                          backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected ? <Check size={12} color={theme.colors.text.white} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Weight Goal */}
            <View className="gap-3">
              <View className="flex-row items-center gap-1">
                <Text
                  className="text-xs font-semibold tracking-widest"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  {t('onboarding.quickGoals.weightGoal').toUpperCase()}
                </Text>
                <Text style={{ color: theme.colors.status.error, fontSize: 12 }}>*</Text>
              </View>

              <View className="flex-row gap-3">
                {WEIGHT_OPTIONS.map((opt) => {
                  const isSelected = weightGoal === opt.value;
                  const iconColor = isSelected
                    ? theme.colors.accent.primary
                    : theme.colors.text.secondary;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setWeightGoal(opt.value)}
                      className="flex-1 items-center justify-center rounded-xl py-4"
                      style={{
                        backgroundColor: theme.colors.background.cardElevated,
                        borderWidth: 1.5,
                        borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
                        gap: 6,
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <opt.icon size={20} color={iconColor} />
                      <Text
                        className="font-semibold"
                        style={{
                          color: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.text.primary,
                          fontSize: theme.typography.fontSize.sm,
                        }}
                      >
                        {t(opt.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('onboarding.quickGoals.continue')}
            onPress={handleContinue}
            variant="gradientCta"
            size="md"
            width="full"
            disabled={isSaving}
            loading={isSaving}
          />
          <View style={{ height: theme.spacing.margin.md }} />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
