import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  Award,
  BookOpen,
  Check,
  Flame,
  Gauge,
  LucideIcon,
  Trophy,
  Wind,
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
import { type LiftingExperience } from '@/database/models/User';
import { useTheme } from '@/hooks/useTheme';
import { setCurrentOnboardingStep } from '@/utils/onboardingService';

type ExperienceOption = {
  value: LiftingExperience;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
};

type ActivityOption = {
  value: number;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
};

const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  {
    value: 'beginner',
    labelKey: 'onboarding.personalizedExperience.beginner',
    descKey: 'onboarding.personalizedExperience.beginnerDesc',
    icon: BookOpen,
  },
  {
    value: 'intermediate',
    labelKey: 'onboarding.personalizedExperience.intermediate',
    descKey: 'onboarding.personalizedExperience.intermediateDesc',
    icon: Award,
  },
  {
    value: 'advanced',
    labelKey: 'onboarding.personalizedExperience.advanced',
    descKey: 'onboarding.personalizedExperience.advancedDesc',
    icon: Trophy,
  },
];

const ACTIVITY_OPTIONS: ActivityOption[] = [
  {
    value: 1,
    labelKey: 'onboarding.personalizedExperience.sedentary',
    descKey: 'onboarding.personalizedExperience.sedentaryDesc',
    icon: Wind,
  },
  {
    value: 2,
    labelKey: 'onboarding.personalizedExperience.lightlyActive',
    descKey: 'onboarding.personalizedExperience.lightlyActiveDesc',
    icon: Gauge,
  },
  {
    value: 3,
    labelKey: 'onboarding.personalizedExperience.moderatelyActive',
    descKey: 'onboarding.personalizedExperience.moderatelyActiveDesc',
    icon: Flame,
  },
  {
    value: 4,
    labelKey: 'onboarding.personalizedExperience.veryActive',
    descKey: 'onboarding.personalizedExperience.veryActiveDesc',
    icon: Zap,
  },
  {
    value: 5,
    labelKey: 'onboarding.personalizedExperience.extremelyActive',
    descKey: 'onboarding.personalizedExperience.extremelyActiveDesc',
    icon: Trophy,
  },
];

export default function PersonalizedExperienceScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [experience, setExperience] = useState<LiftingExperience>('beginner');
  const [activityLevel, setActivityLevel] = useState(2);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      const existing = await AsyncStorage.getItem(PERSONALIZED_SETUP_DATA);
      const current = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem(
        PERSONALIZED_SETUP_DATA,
        JSON.stringify({ ...current, liftingExperience: experience, activityLevel })
      );

      await setCurrentOnboardingStep('/app/onboarding/personalized-experience');
      router.navigate('/app/onboarding/personalized-goals');
    } catch (e) {
      console.error('Error saving personalized experience:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={3} total={8} />

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
              {t('onboarding.personalizedExperience.title')}
            </Text>
            <Text
              className="mb-8"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {t('onboarding.personalizedExperience.subtitle')}
            </Text>

            {/* Training Experience */}
            <View className="mb-8 gap-3">
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: theme.colors.text.tertiary }}
              >
                {t('onboarding.personalizedExperience.experienceLabel')}
              </Text>

              {EXPERIENCE_OPTIONS.map((opt) => {
                const isSelected = experience === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setExperience(opt.value)}
                    className="flex-row items-center justify-between rounded-xl px-4 py-4"
                    style={{
                      backgroundColor: theme.colors.background.cardElevated,
                      borderWidth: 1.5,
                      borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: isSelected
                            ? theme.colors.accent.primary + '22'
                            : theme.colors.background.card,
                        }}
                      >
                        <opt.icon
                          size={18}
                          color={
                            isSelected ? theme.colors.accent.primary : theme.colors.text.secondary
                          }
                        />
                      </View>
                      <View>
                        <Text
                          className="font-semibold"
                          style={{
                            color: isSelected
                              ? theme.colors.accent.primary
                              : theme.colors.text.primary,
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
                    </View>

                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        borderWidth: 2,
                        borderColor: isSelected
                          ? theme.colors.accent.primary
                          : theme.colors.border.light,
                        backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                      }}
                    >
                      {isSelected ? <Check size={14} color={theme.colors.text.white} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Activity Level */}
            <View className="gap-3">
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: theme.colors.text.tertiary }}
              >
                {t('onboarding.personalizedExperience.activityLevelLabel')}
              </Text>

              {ACTIVITY_OPTIONS.map((opt) => {
                const isSelected = activityLevel === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setActivityLevel(opt.value)}
                    className="flex-row items-center justify-between rounded-xl px-4 py-4"
                    style={{
                      backgroundColor: theme.colors.background.cardElevated,
                      borderWidth: 1.5,
                      borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: isSelected
                            ? theme.colors.accent.primary + '22'
                            : theme.colors.background.card,
                        }}
                      >
                        <opt.icon
                          size={18}
                          color={
                            isSelected ? theme.colors.accent.primary : theme.colors.text.secondary
                          }
                        />
                      </View>
                      <View>
                        <Text
                          className="font-semibold"
                          style={{
                            color: isSelected
                              ? theme.colors.accent.primary
                              : theme.colors.text.primary,
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
                    </View>

                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        borderWidth: 2,
                        borderColor: isSelected
                          ? theme.colors.accent.primary
                          : theme.colors.border.light,
                        backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                      }}
                    >
                      {isSelected ? <Check size={14} color={theme.colors.text.white} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('onboarding.personalizedExperience.continue')}
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
